package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.Channel;
import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import my_spring_app.my_spring_app.dto.reponse.BackendRequestResponse;
import my_spring_app.my_spring_app.dto.request.CreateBackendRequest;
import my_spring_app.my_spring_app.entity.BackendRequestEntity;
import my_spring_app.my_spring_app.entity.ProjectBackendEntity;
import my_spring_app.my_spring_app.entity.ProjectEntity;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.repository.BackendRequestRepository;
import my_spring_app.my_spring_app.repository.ProjectBackendRepository;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.service.BackendRequestService;
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

@Service
public class BackendRequestServiceImpl extends BaseKubernetesService implements BackendRequestService {

    private final BackendRequestRepository backendRequestRepository;
    private final ProjectBackendRepository projectBackendRepository;
    private final ServerRepository serverRepository;

    @Autowired
    public BackendRequestServiceImpl(BackendRequestRepository backendRequestRepository,
                                     ProjectBackendRepository projectBackendRepository,
                                     ServerRepository serverRepository) {
        this.backendRequestRepository = backendRequestRepository;
        this.projectBackendRepository = projectBackendRepository;
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
    public BackendRequestResponse createRequest(CreateBackendRequest requestDto) {
        if (requestDto == null) {
            throw new RuntimeException("Request không được để trống");
        }

        Long backendId = requestDto.getBackendId();
        Integer newReplicas = requestDto.getNewReplicas();

        if (backendId == null) {
            throw new RuntimeException("backendId không được để trống");
        }
        if (newReplicas == null || newReplicas <= 0) {
            throw new RuntimeException("newReplicas phải lớn hơn 0");
        }

        ProjectBackendEntity backend = projectBackendRepository.findById(backendId)
                .orElseThrow(() -> new RuntimeException("Backend project không tồn tại với id: " + backendId));

        int currentReplicas = backend.getReplicas() != null ? backend.getReplicas() : 0;
        if (newReplicas == currentReplicas) {
            throw new RuntimeException("newReplicas phải khác số replicas hiện tại");
        }
        Integer maxReplicas = backend.getMaxReplicas();
        if (maxReplicas != null && newReplicas > maxReplicas) {
            throw new RuntimeException("newReplicas vượt quá giới hạn maxReplicas của backend");
        }

        BackendRequestEntity entity = new BackendRequestEntity();
        entity.setBackend(backend);
        entity.setOldReplicas(currentReplicas);
        entity.setNewReplicas(newReplicas);
        entity.setStatus("PENDING");

        BackendRequestEntity saved = backendRequestRepository.save(entity);
        return buildResponse(saved);
    }

    @Override
    public BackendRequestResponse approveRequest(Long requestId) {
        if (requestId == null) {
            throw new RuntimeException("requestId không được để trống");
        }

        BackendRequestEntity request = backendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Backend request không tồn tại với id: " + requestId));

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("Chỉ có thể phê duyệt request đang ở trạng thái PENDING");
        }

        ProjectBackendEntity backend = request.getBackend();
        if (backend == null) {
            throw new RuntimeException("Request không gắn với backend hợp lệ");
        }

        ProjectEntity project = backend.getProject();
        if (project == null || project.getNamespace() == null || project.getNamespace().isBlank()) {
            throw new RuntimeException("Backend không có namespace hợp lệ");
        }

        String namespace = project.getNamespace().trim();
        String uuid = backend.getUuid_k8s();
        if (uuid == null || uuid.isBlank()) {
            throw new RuntimeException("Backend không có uuid_k8s. Không thể cập nhật HPA");
        }
        String hpaName = "app-" + uuid + "-hpa";
        Integer newReplicas = request.getNewReplicas();

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
            throw new RuntimeException("Không thể cập nhật HPA cho backend: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }

        backend.setMaxReplicas(backend.getMaxReplicas()); // giữa giá trị cũ
        backend.setReplicas(newReplicas);
        projectBackendRepository.save(backend);

        request.setStatus("APPROVED");
        backendRequestRepository.save(request);

        return buildResponse(request);
    }

    @Override
    public BackendRequestResponse rejectRequest(Long requestId, String reason) {
        if (requestId == null) {
            throw new RuntimeException("requestId không được để trống");
        }

        BackendRequestEntity request = backendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Backend request không tồn tại với id: " + requestId));

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("Chỉ có thể từ chối request đang ở trạng thái PENDING");
        }
        if (reason == null || reason.isBlank()) {
            throw new RuntimeException("Lý do từ chối không được để trống");
        }

        request.setStatus("REJECTED");
        request.setReasonReject(reason.trim());
        backendRequestRepository.save(request);
        return buildResponse(request);
    }

    @Override
    public BackendRequestResponse cancelRequest(Long requestId) {
        if (requestId == null) {
            throw new RuntimeException("requestId không được để trống");
        }

        BackendRequestEntity request = backendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Backend request không tồn tại với id: " + requestId));

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("Chỉ có thể hủy request đang ở trạng thái PENDING");
        }

        request.setStatus("CANCELLED");
        backendRequestRepository.save(request);
        return buildResponse(request);
    }

    @Override
    public List<BackendRequestResponse> listRequests(String status) {
        List<BackendRequestEntity> entities;
        if (status != null && !status.isBlank()) {
            entities = backendRequestRepository.findAllByStatusOrderByCreatedAtDesc(status.trim().toUpperCase());
        } else {
            entities = backendRequestRepository.findAllByOrderByCreatedAtDesc();
        }
        return entities.stream()
                .map(this::buildResponse)
                .collect(Collectors.toList());
    }

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

    private String escapeSingleQuotes(String input) {
        return input.replace("'", "'\"'\"'");
    }

    private BackendRequestResponse buildResponse(BackendRequestEntity entity) {
        ProjectBackendEntity backend = entity.getBackend();
        ProjectEntity project = backend != null ? backend.getProject() : null;

        return BackendRequestResponse.builder()
                .id(entity.getId())
                .backendId(backend != null ? backend.getId() : null)
                .backendName(backend != null ? backend.getProjectName() : null)
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

