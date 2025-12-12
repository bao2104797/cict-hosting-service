package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.Channel;
import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import my_spring_app.my_spring_app.dto.reponse.FrontendRequestResponse;
import my_spring_app.my_spring_app.dto.request.CreateFrontendRequest;
import my_spring_app.my_spring_app.entity.FrontendRequestEntity;
import my_spring_app.my_spring_app.entity.ProjectEntity;
import my_spring_app.my_spring_app.entity.ProjectFrontendEntity;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.repository.FrontendRequestRepository;
import my_spring_app.my_spring_app.repository.ProjectFrontendRepository;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.service.FrontendRequestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.util.Config;
import io.kubernetes.client.openapi.Configuration;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.stream.Collectors;

/**
 * Service xử lý request scale frontend:
 *  - createRequest: ghi nhận yêu cầu scale, chờ admin phê duyệt.
 *  - approveRequest: patch HPA trên cluster qua SSH và cập nhật DB.
 */
@Service
public class FrontendRequestServiceImpl extends BaseKubernetesService implements FrontendRequestService {

    private final FrontendRequestRepository frontendRequestRepository;
    private final ProjectFrontendRepository projectFrontendRepository;
    private final ServerRepository serverRepository;

    @Autowired
    public FrontendRequestServiceImpl(FrontendRequestRepository frontendRequestRepository,
                                      ProjectFrontendRepository projectFrontendRepository,
                                      ServerRepository serverRepository) {
        this.frontendRequestRepository = frontendRequestRepository;
        this.projectFrontendRepository = projectFrontendRepository;
        this.serverRepository = serverRepository;
    }

    /**
     * Override method createKubernetesClient để thay thế server URL trong kubeconfig
     * trước khi feed cho Java Kubernetes client
     */
    @Override
    protected ApiClient createKubernetesClient(Session session) throws Exception {
        String kubeconfigPath = "~/.kube/config";
        File tempKubeconfig = null;
        try {
            String kubeconfigContent = executeCommand(session, "cat " + kubeconfigPath, false);
            if (kubeconfigContent == null || kubeconfigContent.trim().isEmpty()) {
                String[] alternativePaths = {
                        "/etc/kubernetes/admin.conf",
                        "/root/.kube/config",
                        "$HOME/.kube/config"
                };
                for (String altPath : alternativePaths) {
                    try {
                        kubeconfigContent = executeCommand(session, "cat " + altPath, true);
                        if (kubeconfigContent != null && !kubeconfigContent.trim().isEmpty()) {
                            break;
                        }
                    } catch (Exception ignored) {
                    }
                }
                if (kubeconfigContent == null || kubeconfigContent.trim().isEmpty()) {
                    throw new RuntimeException("Không thể đọc kubeconfig từ master server.");
                }
            }

            // Lấy IP MASTER và thay thế server URL trong kubeconfig trước khi sử dụng
            Optional<ServerEntity> masterOpt = serverRepository.findByRole("MASTER");
            if (masterOpt.isPresent()) {
                String masterIp = masterOpt.get().getIp();
                kubeconfigContent = replaceKubeconfigServer(kubeconfigContent, masterIp);
            } else {
                System.err.println("[createKubernetesClient] WARNING: Không tìm thấy server MASTER để thay server URL trong kubeconfig");
            }

            tempKubeconfig = File.createTempFile("kubeconfig-", ".yaml");
            try (FileWriter writer = new FileWriter(tempKubeconfig)) {
                writer.write(kubeconfigContent);
            }

            ApiClient client = Config.fromConfig(tempKubeconfig.getAbsolutePath());
            Configuration.setDefaultApiClient(client);
            return client;
        } finally {
            if (tempKubeconfig != null && tempKubeconfig.exists()) {
                if (!tempKubeconfig.delete()) {
                    tempKubeconfig.deleteOnExit();
                }
            }
        }
    }

    @Override
    public FrontendRequestResponse createRequest(CreateFrontendRequest requestDto) {
        if (requestDto == null) {
            throw new RuntimeException("Request không được để trống");
        }

        Long frontendId = requestDto.getFrontendId();
        Integer newReplicas = requestDto.getNewReplicas();

        // Kiểm tra tham số đầu vào cơ bản
        if (frontendId == null) {
            throw new RuntimeException("frontendId không được để trống");
        }
        if (newReplicas == null || newReplicas <= 0) {
            throw new RuntimeException("newReplicas phải lớn hơn 0");
        }

        // Lấy thông tin frontend hiện tại để lấy replicas/maxReplicas
        ProjectFrontendEntity frontend = projectFrontendRepository.findById(frontendId)
                .orElseThrow(() -> new RuntimeException("Frontend project không tồn tại với id: " + frontendId));

        int currentReplicas = frontend.getReplicas() != null ? frontend.getReplicas() : 0;
        if (newReplicas == currentReplicas) {
            throw new RuntimeException("newReplicas phải khác số replicas hiện tại");
        }
        Integer maxReplicas = frontend.getMaxReplicas();
        if (maxReplicas != null && newReplicas > maxReplicas) {
            throw new RuntimeException("newReplicas vượt quá giới hạn maxReplicas của frontend");
        }

        // Ghi nhận request với trạng thái PENDING để admin xử lý sau
        FrontendRequestEntity request = new FrontendRequestEntity();
        request.setFrontend(frontend);
        request.setOldReplicas(currentReplicas);
        request.setNewReplicas(newReplicas);
        request.setStatus("PENDING");

        FrontendRequestEntity saved = frontendRequestRepository.save(request);
        return buildResponse(saved);
    }

    @Override
    public FrontendRequestResponse approveRequest(Long requestId) {
        if (requestId == null) {
            throw new RuntimeException("requestId không được để trống");
        }

        FrontendRequestEntity request = frontendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Frontend request không tồn tại với id: " + requestId));

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("Chỉ có thể phê duyệt request đang ở trạng thái PENDING");
        }

        ProjectFrontendEntity frontend = request.getFrontend();
        if (frontend == null) {
            throw new RuntimeException("Request không gắn với frontend hợp lệ");
        }

        ProjectEntity project = frontend.getProject();
        if (project == null || project.getNamespace() == null || project.getNamespace().isBlank()) {
            throw new RuntimeException("Frontend không có namespace hợp lệ");
        }

        String namespace = project.getNamespace().trim();
        String uuid = frontend.getUuid_k8s();
        if (uuid == null || uuid.isBlank()) {
            throw new RuntimeException("Frontend không có uuid_k8s. Không thể cập nhật HPA");
        }
        String hpaName = "app-" + uuid + "-hpa";
        Integer newReplicas = request.getNewReplicas();

        // Kết nối tới master server và patch HPA
        Optional<ServerEntity> masterServerOpt = serverRepository.findByRole("MASTER");
        ServerEntity masterServer = masterServerOpt
                .orElseThrow(() -> new RuntimeException("Không tìm thấy server MASTER. Không thể cập nhật HPA"));

        Session session = null;
        try {
            session = openSshSession(masterServer);
            String patchJson = String.format("{\"spec\": {\"maxReplicas\": %d}}", newReplicas);
            String command = String.format("kubectl -n %s patch hpa %s -p '%s'",
                    namespace,
                    hpaName,
                    escapeSingleQuotes(patchJson));
            executeCommand(session, command);
        } catch (Exception e) {
            throw new RuntimeException("Không thể cập nhật HPA cho frontend: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }

        // Cập nhật dữ liệu trong database sau khi patch thành công
        frontend.setMaxReplicas(frontend.getMaxReplicas()); // giữa giá trị cũ
        frontend.setReplicas(newReplicas);
        projectFrontendRepository.save(frontend);

        request.setStatus("APPROVED");
        frontendRequestRepository.save(request);

        return buildResponse(request);
    }

    @Override
    public FrontendRequestResponse rejectRequest(Long requestId, String reason) {
        if (requestId == null) {
            throw new RuntimeException("requestId không được để trống");
        }
        FrontendRequestEntity request = frontendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Frontend request không tồn tại với id: " + requestId));

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("Chỉ có thể từ chối request đang ở trạng thái PENDING");
        }

        if (reason == null || reason.isBlank()) {
            throw new RuntimeException("Lý do từ chối không được để trống");
        }

        request.setStatus("REJECTED");
        request.setReasonReject(reason.trim());
        frontendRequestRepository.save(request);
        return buildResponse(request);
    }

    @Override
    public FrontendRequestResponse cancelRequest(Long requestId) {
        if (requestId == null) {
            throw new RuntimeException("requestId không được để trống");
        }

        FrontendRequestEntity request = frontendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Frontend request không tồn tại với id: " + requestId));

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("Chỉ có thể hủy request đang ở trạng thái PENDING");
        }

        request.setStatus("CANCELLED");
        frontendRequestRepository.save(request);
        return buildResponse(request);
    }

    @Override
    public List<FrontendRequestResponse> listRequests(String status) {
        List<FrontendRequestEntity> entities;
        if (status != null && !status.isBlank()) {
            entities = frontendRequestRepository.findAllByStatusOrderByCreatedAtDesc(status.trim().toUpperCase());
        } else {
            entities = frontendRequestRepository.findAllByOrderByCreatedAtDesc();
        }
        return entities.stream()
                .map(this::buildResponse)
                .collect(Collectors.toList());
    }

    // Tạo SSH session đến MASTER dựa trên thông tin lưu trong DB
    private Session openSshSession(ServerEntity masterServer) throws Exception {
        JSch jsch = new JSch();
        Session session = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
        session.setPassword(masterServer.getPassword());
        Properties config = new Properties();
        config.put("StrictHostKeyChecking", "no");
        session.setConfig(config);
        session.setTimeout(7000);
        session.connect();
        return session;
    }

    // Thực thi lệnh SSH và kiểm tra exit code
    private void executeCommand(Session session, String command) throws Exception {
        Channel channel = null;
        ChannelExec channelExec = null;
        try {
            channel = session.openChannel("exec");
            channelExec = (ChannelExec) channel;
            channelExec.setCommand(command);
            InputStream inputStream = channelExec.getInputStream();
            channelExec.setErrStream(System.err);
            channelExec.connect();

            byte[] buffer = new byte[1024];
            while (true) {
                while (inputStream.available() > 0) {
                    int i = inputStream.read(buffer, 0, 1024);
                    if (i < 0) {
                        break;
                    }
                }
                if (channelExec.isClosed()) {
                    if (inputStream.available() > 0) {
                        continue;
                    }
                    int exitStatus = channelExec.getExitStatus();
                    if (exitStatus != 0) {
                        throw new RuntimeException("Command exited with status " + exitStatus);
                    }
                    break;
                }
                Thread.sleep(100);
            }
        } finally {
            if (channelExec != null && channelExec.isConnected()) {
                channelExec.disconnect();
            }
        }
    }

    // Escape ký tự ' để chèn JSON vào câu lệnh shell an toàn hơn
    private String escapeSingleQuotes(String input) {
        return input.replace("'", "'\"'\"'");
    }

    private FrontendRequestResponse buildResponse(FrontendRequestEntity entity) {
        ProjectFrontendEntity frontend = entity.getFrontend();
        ProjectEntity project = frontend != null ? frontend.getProject() : null;

        return FrontendRequestResponse.builder()
                .id(entity.getId())
                .frontendId(frontend != null ? frontend.getId() : null)
                .frontendName(frontend != null ? frontend.getProjectName() : null)
                .projectName(project != null ? project.getProjectName() : null)
                .username(project != null && project.getUser() != null ? project.getUser().getUsername() : null)
                .oldReplicas(entity.getOldReplicas())
                .newReplicas(entity.getNewReplicas())
                .status(entity.getStatus())
                .reasonReject(entity.getReasonReject())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
