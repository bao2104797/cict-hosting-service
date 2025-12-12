package my_spring_app.my_spring_app.service.impl;

import my_spring_app.my_spring_app.dto.reponse.AnsibleStatusResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleOperationResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleTaskStatusResponse;
import my_spring_app.my_spring_app.dto.reponse.PlaybookListResponse;
import my_spring_app.my_spring_app.dto.reponse.PlaybookResponse;
import my_spring_app.my_spring_app.dto.request.InstallAnsibleRequest;
import my_spring_app.my_spring_app.dto.request.InitAnsibleRequest;
import my_spring_app.my_spring_app.dto.request.SaveAnsibleConfigRequest;
import my_spring_app.my_spring_app.dto.request.VerifyAnsibleConfigRequest;
import my_spring_app.my_spring_app.dto.request.SavePlaybookRequest;
import my_spring_app.my_spring_app.dto.request.DeletePlaybookRequest;
import my_spring_app.my_spring_app.dto.request.ExecutePlaybookRequest;
import my_spring_app.my_spring_app.dto.request.InstallK8sRequest;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.service.AnsibleService;
import my_spring_app.my_spring_app.service.ServerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.jcraft.jsch.Session;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.util.Config;
import io.kubernetes.client.openapi.Configuration;
import java.io.File;
import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Service implementation cho Ansible
 * Xử lý các nghiệp vụ liên quan đến quản lý Ansible
 */
@Service
public class AnsibleServiceImpl extends BaseKubernetesService implements AnsibleService {

    @Autowired
    private ServerRepository serverRepository;
    
    @Autowired
    private ServerService serverService;
    
    private final ExecutorService initTaskExecutor = Executors.newFixedThreadPool(4);
    private final ExecutorService playbookTaskExecutor = Executors.newFixedThreadPool(2);
    private final ConcurrentMap<String, TaskStatus> initTaskCache = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, TaskStatus> playbookTaskCache = new ConcurrentHashMap<>();

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

    /**
     * Kiểm tra trạng thái Ansible trên controller server (server có role ANSIBLE hoặc MASTER).
     * 
     * Quy trình xử lý:
     * 1. Tìm server có role ANSIBLE và status ONLINE (ưu tiên)
     * 2. Nếu không có ANSIBLE, tìm server có role MASTER và status ONLINE
     * 3. Kết nối SSH đến server đó
     * 4. Thực thi lệnh "ansible --version" để kiểm tra xem Ansible có được cài đặt không
     * 5. Parse output để lấy version (ví dụ: "ansible 2.15.0")
     * 6. Trả về AnsibleStatusResponse với thông tin installed, version, controllerHost, controllerRole
     * 
     * @return AnsibleStatusResponse chứa thông tin trạng thái Ansible
     */
    @Override
    public AnsibleStatusResponse getAnsibleStatus() {
        AnsibleStatusResponse response = new AnsibleStatusResponse();
        
        try {
            // Bước 1: Tìm server có role ANSIBLE và status ONLINE (ưu tiên)
            List<ServerEntity> allServers = serverRepository.findAll();
            ServerEntity controllerServer = allServers.stream()
                    .filter(s -> s != null 
                            && "ANSIBLE".equals(s.getRole())
                            && s.getStatus() == ServerEntity.ServerStatus.ONLINE)
                    .findFirst()
                    .orElse(null);
            
            // Bước 2: Nếu không có ANSIBLE, tìm server có role MASTER và status ONLINE
            if (controllerServer == null) {
                controllerServer = allServers.stream()
                        .filter(s -> s != null 
                                && "MASTER".equals(s.getRole())
                                && s.getStatus() == ServerEntity.ServerStatus.ONLINE)
                        .findFirst()
                        .orElse(null);
            }
            
            // Nếu không tìm thấy controller server
            if (controllerServer == null) {
                response.setInstalled(false);
                response.setError("Không tìm thấy server controller (ANSIBLE hoặc MASTER) với trạng thái ONLINE. Vui lòng thêm server với role ANSIBLE hoặc MASTER và đảm bảo server đang online.");
                return response;
            }
            
            // Set thông tin controller
            response.setControllerHost(controllerServer.getIp());
            response.setControllerRole(controllerServer.getRole());
            
            // Bước 3: Kết nối SSH và kiểm tra Ansible - tái sử dụng execCommand từ ServerService
            try {
                Long controllerServerId = controllerServer.getId();
                
                // Bước 4: Thực thi lệnh "ansible --version"
                String ansibleVersionCmd = "ansible --version 2>&1 || echo 'NOT_INSTALLED'";
                String versionOutput = serverService.execCommand(controllerServerId, ansibleVersionCmd, 10000);
                
                // Bước 5: Parse output để lấy version
                if (versionOutput != null && !versionOutput.trim().isEmpty() && !versionOutput.contains("NOT_INSTALLED")) {
                    // Parse version từ output (ví dụ: "ansible 2.15.0" hoặc "ansible [core 2.15.0]")
                    String version = "Unknown";
                    if (versionOutput.contains("ansible")) {
                        // Tìm pattern version: "ansible [core 2.15.0]" hoặc "ansible 2.15.0"
                        Pattern pattern = Pattern.compile("ansible.*?([0-9]+\\.[0-9]+\\.[0-9]+)");
                        java.util.regex.Matcher matcher = pattern.matcher(versionOutput);
                        if (matcher.find()) {
                            version = matcher.group(1);
                        } else {
                            // Fallback: tìm bất kỳ version pattern nào
                            pattern = Pattern.compile("([0-9]+\\.[0-9]+\\.[0-9]+)");
                            matcher = pattern.matcher(versionOutput);
                            if (matcher.find()) {
                                version = matcher.group(1);
                            }
                        }
                    }
                    
                    response.setInstalled(true);
                    response.setVersion(version);
                } else {
                    // Ansible chưa được cài đặt
                    response.setInstalled(false);
                }
            } catch (Exception e) {
                // Nếu không thể kết nối hoặc thực thi lệnh, coi như chưa cài đặt
                System.err.println("Lỗi khi kiểm tra Ansible status: " + e.getMessage());
                response.setInstalled(false);
                response.setError("Không thể kiểm tra trạng thái Ansible: " + e.getMessage());
            }
        } catch (Exception e) {
            System.err.println("Lỗi khi lấy Ansible status: " + e.getMessage());
            response.setInstalled(false);
            response.setError("Đã xảy ra lỗi. Vui lòng thử lại sau.");
        }
        
        return response;
    }

    @Override
    public AnsibleOperationResponse installAnsible(InstallAnsibleRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            // Tìm controller server
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            String host = controllerServer.getIp();
            Long serverId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            
            System.out.println("========================================");
            System.out.println("[INSTALL ANSIBLE] Bắt đầu cài đặt Ansible trên " + host);
            System.out.println("========================================");
            
            // Bước 1: Cập nhật các gói hệ thống
            System.out.println("[INSTALL ANSIBLE] Bước 1/4: Cập nhật package manager...");
            String updateCmd = "apt update -y";
            String updateResult = executeCommandWithAuth(serverId, updateCmd, sudoPassword, 30000);
            System.out.println("[INSTALL ANSIBLE] ✓ Đã cập nhật package manager");
            if (updateResult != null && !updateResult.trim().isEmpty()) {
                System.out.println("[INSTALL ANSIBLE] Output: " + updateResult.substring(0, Math.min(200, updateResult.length())));
            }
            
            // Bước 2: Cài đặt Python và pip
            System.out.println("[INSTALL ANSIBLE] Bước 2/4: Cài đặt Python và pip...");
            String pythonCmd = "apt install -y python3 python3-pip python3-venv";
            String pythonResult = executeCommandWithAuth(serverId, pythonCmd, sudoPassword, 30000);
            System.out.println("[INSTALL ANSIBLE] ✓ Đã cài đặt Python và pip");
            if (pythonResult != null && !pythonResult.trim().isEmpty()) {
                System.out.println("[INSTALL ANSIBLE] Output: " + pythonResult.substring(0, Math.min(200, pythonResult.length())));
            }
            
            // Bước 3: Cài đặt Ansible
            System.out.println("[INSTALL ANSIBLE] Bước 3/4: Cài đặt Ansible...");
            String ansibleCmd = "pip3 install --upgrade ansible";
            String ansibleResult = executeCommandWithAuth(serverId, ansibleCmd, sudoPassword, 60000);
            System.out.println("[INSTALL ANSIBLE] ✓ Đã cài đặt Ansible");
            if (ansibleResult != null && !ansibleResult.trim().isEmpty()) {
                System.out.println("[INSTALL ANSIBLE] Output: " + ansibleResult.substring(0, Math.min(200, ansibleResult.length())));
            }
            
            // Bước 4: Kiểm tra lại kết quả cài đặt
            System.out.println("[INSTALL ANSIBLE] Bước 4/4: Kiểm tra cài đặt...");
            String checkCmd = "ansible --version";
            String checkResult = executeCommandWithAuth(serverId, checkCmd, null, 10000);
            System.out.println("[INSTALL ANSIBLE] ✓ Kiểm tra cài đặt hoàn tất");
            if (checkResult != null && !checkResult.trim().isEmpty()) {
                System.out.println("[INSTALL ANSIBLE] Ansible version: " + checkResult);
            }
            
            System.out.println("========================================");
            System.out.println("[INSTALL ANSIBLE] ✅ Hoàn thành cài đặt Ansible trên " + host);
            System.out.println("========================================");
            
            response.setSuccess(true);
            response.setMessage("Đã cài đặt Ansible thành công trên " + host + ". Version: " + (checkResult != null ? checkResult : "Unknown"));
            
        } catch (Exception e) {
            System.err.println("[INSTALL ANSIBLE] ❌ Lỗi: " + e.getMessage());
            e.printStackTrace();
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi cài đặt Ansible: " + e.getMessage());
        }
        
        return response;
    }
    
    @Override
    public AnsibleOperationResponse reinstallAnsible(InstallAnsibleRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            // Tìm controller server
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            String host = controllerServer.getIp();
            Long serverId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            
            System.out.println("========================================");
            System.out.println("[REINSTALL ANSIBLE] Bắt đầu cài đặt lại Ansible trên " + host);
            System.out.println("========================================");
            
            // Bước 1: Cập nhật pip để đảm bảo có phiên bản mới nhất
            System.out.println("[REINSTALL ANSIBLE] Bước 1/3: Cập nhật pip...");
            String updatePipCmd = "pip3 install --upgrade pip";
            String pipResult = executeCommandWithAuth(serverId, updatePipCmd, sudoPassword, 30000);
            System.out.println("[REINSTALL ANSIBLE] ✓ Đã cập nhật pip");
            if (pipResult != null && !pipResult.trim().isEmpty()) {
                System.out.println("[REINSTALL ANSIBLE] Output: " + pipResult.substring(0, Math.min(200, pipResult.length())));
            }
            
            // Bước 2: Cài đặt lại/upgrade Ansible (pip3 install --upgrade sẽ tự động upgrade)
            System.out.println("[REINSTALL ANSIBLE] Bước 2/3: Cài đặt lại/nâng cấp Ansible...");
            String ansibleCmd = "pip3 install --upgrade ansible";
            String ansibleResult = executeCommandWithAuth(serverId, ansibleCmd, sudoPassword, 60000);
            System.out.println("[REINSTALL ANSIBLE] ✓ Đã cài đặt lại/nâng cấp Ansible");
            if (ansibleResult != null && !ansibleResult.trim().isEmpty()) {
                System.out.println("[REINSTALL ANSIBLE] Output: " + ansibleResult.substring(0, Math.min(200, ansibleResult.length())));
            }
            
            // Bước 3: Kiểm tra lại kết quả cài đặt
            System.out.println("[REINSTALL ANSIBLE] Bước 3/3: Kiểm tra phiên bản Ansible sau khi cài đặt lại...");
            String checkCmd = "ansible --version";
            String checkResult = executeCommandWithAuth(serverId, checkCmd, null, 10000);
            System.out.println("[REINSTALL ANSIBLE] ✓ Kiểm tra hoàn tất");
            if (checkResult != null && !checkResult.trim().isEmpty()) {
                System.out.println("[REINSTALL ANSIBLE] Ansible version: " + checkResult);
            }
            
            System.out.println("========================================");
            System.out.println("[REINSTALL ANSIBLE] ✅ Hoàn thành cài đặt lại Ansible trên " + host);
            System.out.println("========================================");
            
            response.setSuccess(true);
            response.setMessage("Đã cài đặt lại Ansible thành công trên " + host + ". Version: " + (checkResult != null ? checkResult : "Unknown"));
            
        } catch (Exception e) {
            System.err.println("[REINSTALL ANSIBLE] ❌ Lỗi: " + e.getMessage());
            e.printStackTrace();
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi cài đặt lại Ansible: " + e.getMessage());
        }
        
        return response;
    }
    
    @Override
    public AnsibleOperationResponse uninstallAnsible(InstallAnsibleRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            // Tìm controller server
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            String host = controllerServer.getIp();
            Long serverId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            
            System.out.println("========================================");
            System.out.println("[UNINSTALL ANSIBLE] Bắt đầu gỡ cài đặt Ansible trên " + host);
            System.out.println("========================================");
            
            // Bước 0: Kiểm tra hiện trạng cài đặt
            System.out.println("[UNINSTALL ANSIBLE] Bước 0/4: Kiểm tra hiện trạng Ansible...");
            String checkWhichCmd = "which -a ansible || true";
            String whichResult = executeCommandWithAuth(serverId, checkWhichCmd, sudoPassword, 8000);
            System.out.println("[UNINSTALL ANSIBLE] which ansible: " + (whichResult != null ? whichResult : "NOT_FOUND"));
            
            String checkPipCmd = "pip3 show ansible || true";
            String pipShowResult = executeCommandWithAuth(serverId, checkPipCmd, sudoPassword, 8000);
            System.out.println("[UNINSTALL ANSIBLE] pip3 show ansible: " + (pipShowResult != null && !pipShowResult.trim().isEmpty() ? "FOUND" : "NOT_FOUND"));
            
            String checkCoreCmd = "pip3 show ansible-core || true";
            String coreShowResult = executeCommandWithAuth(serverId, checkCoreCmd, sudoPassword, 8000);
            System.out.println("[UNINSTALL ANSIBLE] pip3 show ansible-core: " + (coreShowResult != null && !coreShowResult.trim().isEmpty() ? "FOUND" : "NOT_FOUND"));
            
            // Bước 1: Gỡ Ansible bằng pip (bao gồm các tên gói phổ biến)
            System.out.println("[UNINSTALL ANSIBLE] Bước 1/4: Gỡ Ansible bằng pip...");
            executeCommandWithAuth(serverId, "pip3 uninstall -y ansible ansible-core ansible-base ansible-lint ansible-runner || true", sudoPassword, 120000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã gỡ các package ansible chính");
            
            executeCommandWithAuth(serverId, "pip3 uninstall -y community.general community.kubernetes || true", sudoPassword, 60000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã gỡ các collection");
            
            executeCommandWithAuth(serverId, "pip3 uninstall -y ansible-collections-community ansible-collections-kubernetes || true", sudoPassword, 60000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã gỡ các collection packages");
            
            executeCommandWithAuth(serverId, "pip3 uninstall -y ansible-runner-http ansible-runner-kubernetes || true", sudoPassword, 60000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã gỡ các runner packages");
            
            // Bước 2: Nếu cài qua apt thì gỡ thêm bằng apt
            System.out.println("[UNINSTALL ANSIBLE] Bước 2/4: Gỡ Ansible bằng apt (nếu có)...");
            executeCommandWithAuth(serverId, "apt-get remove -y ansible ansible-core || true", sudoPassword, 60000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã remove bằng apt");
            
            executeCommandWithAuth(serverId, "apt-get purge -y ansible ansible-core || true", sudoPassword, 60000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã purge bằng apt");
            
            executeCommandWithAuth(serverId, "apt autoremove -y || true", sudoPassword, 60000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã autoremove");
            
            executeCommandWithAuth(serverId, "apt autoclean || true", sudoPassword, 60000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã autoclean");
            
            // Bước 3: Dọn dẹp các file/binary còn sót
            System.out.println("[UNINSTALL ANSIBLE] Bước 3/4: Dọn dẹp thư mục cấu hình/collections...");
            executeCommandWithAuth(serverId, "rm -rf ~/.ansible ~/.local/bin/ansible ~/.local/bin/ansible-playbook /usr/bin/ansible /usr/bin/ansible-playbook /usr/local/bin/ansible /usr/local/bin/ansible-playbook /usr/share/ansible /etc/ansible || true", sudoPassword, 60000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã xóa các binary và thư mục chính");
            
            executeCommandWithAuth(serverId, "bash -lc 'shopt -s nullglob; rm -rf /usr/local/lib/python3*/dist-packages/ansible* /usr/lib/python3*/dist-packages/ansible*' || true", sudoPassword, 30000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã xóa các Python packages");
            
            executeCommandWithAuth(serverId, "rm -rf ~/.ansible/collections ~/.ansible/cache ~/.ansible/tmp || true", sudoPassword, 30000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã xóa collections và cache");
            
            executeCommandWithAuth(serverId, "rm -rf /var/cache/ansible /tmp/ansible* || true", sudoPassword, 30000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã xóa cache hệ thống");
            
            executeCommandWithAuth(serverId, "rm -rf /etc/ansible/hosts /etc/ansible/ansible.cfg /etc/ansible/group_vars /etc/ansible/host_vars || true", sudoPassword, 30000);
            System.out.println("[UNINSTALL ANSIBLE] ✓ Đã xóa các file cấu hình");
            
            // Bước 4: Kiểm tra lại bằng command -v
            System.out.println("[UNINSTALL ANSIBLE] Bước 4/4: Kiểm tra sau khi gỡ...");
            String pathCheckCmd = "bash -lc 'command -v ansible >/dev/null 2>&1 && { echo FOUND $(command -v ansible); } || echo NOT_FOUND'";
            String pathCheck = executeCommandWithAuth(serverId, pathCheckCmd, sudoPassword, 10000);
            System.out.println("[UNINSTALL ANSIBLE] Kiểm tra PATH: " + (pathCheck != null ? pathCheck : "UNKNOWN"));
            
            String checkBinariesCmd = "which ansible-playbook ansible-galaxy ansible-vault ansible-console || true";
            String binariesCheck = executeCommandWithAuth(serverId, checkBinariesCmd, sudoPassword, 5000);
            System.out.println("[UNINSTALL ANSIBLE] Kiểm tra binaries: " + (binariesCheck != null && !binariesCheck.trim().isEmpty() ? binariesCheck : "NOT_FOUND"));
            
            String checkPipListCmd = "pip3 list | grep -i ansible || echo 'No ansible packages found'";
            String pipListCheck = executeCommandWithAuth(serverId, checkPipListCmd, sudoPassword, 5000);
            System.out.println("[UNINSTALL ANSIBLE] Kiểm tra pip packages: " + (pipListCheck != null ? pipListCheck.substring(0, Math.min(100, pipListCheck.length())) : "UNKNOWN"));
            
            String checkDpkgCmd = "dpkg -l | grep -i ansible || echo 'No ansible packages found'";
            String dpkgCheck = executeCommandWithAuth(serverId, checkDpkgCmd, sudoPassword, 5000);
            System.out.println("[UNINSTALL ANSIBLE] Kiểm tra dpkg packages: " + (dpkgCheck != null ? dpkgCheck.substring(0, Math.min(100, dpkgCheck.length())) : "UNKNOWN"));
            
            System.out.println("========================================");
            if (pathCheck != null && pathCheck.contains("FOUND ")) {
                System.out.println("[UNINSTALL ANSIBLE] ⚠️ Ansible vẫn còn trên hệ thống: " + pathCheck.trim());
                response.setSuccess(false);
                response.setMessage("Ansible vẫn còn trên hệ thống: " + pathCheck.trim());
            } else {
                System.out.println("[UNINSTALL ANSIBLE] ✅ Hoàn thành gỡ cài đặt Ansible trên " + host);
                response.setSuccess(true);
                response.setMessage("Đã gỡ Ansible thành công khỏi " + host + " (ansible không còn trong PATH)");
            }
            System.out.println("========================================");
            
        } catch (Exception e) {
            System.err.println("[UNINSTALL ANSIBLE] ❌ Lỗi: " + e.getMessage());
            e.printStackTrace();
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi gỡ Ansible: " + e.getMessage());
        }
        
        return response;
    }
    
    /**
     * Tìm controller server theo host hoặc tự động tìm
     */
    private ServerEntity findControllerServer(String controllerHost) {
        List<ServerEntity> allServers = serverRepository.findAll();
        
        // Nếu có controllerHost, tìm theo IP
        if (controllerHost != null && !controllerHost.trim().isEmpty()) {
            return allServers.stream()
                    .filter(s -> s != null && controllerHost.equals(s.getIp()))
                    .findFirst()
                    .orElse(null);
        }
        
        // Tự động tìm: ưu tiên ANSIBLE, sau đó MASTER
        ServerEntity controllerServer = allServers.stream()
                .filter(s -> s != null 
                        && "ANSIBLE".equals(s.getRole())
                        && s.getStatus() == ServerEntity.ServerStatus.ONLINE)
                .findFirst()
                .orElse(null);
        
        if (controllerServer == null) {
            controllerServer = allServers.stream()
                    .filter(s -> s != null 
                            && "MASTER".equals(s.getRole())
                            && s.getStatus() == ServerEntity.ServerStatus.ONLINE)
                    .findFirst()
                    .orElse(null);
        }
        
        return controllerServer;
    }
    
    /**
     * Thực thi command với authentication (SSH key hoặc password)
     * Tái sử dụng execCommand từ ServerService
     */
    private String executeCommandWithAuth(Long serverId, String command, String sudoPassword, int timeoutMs) {
        // Kiểm tra xem command có cần sudo không
        // Các command cần sudo: apt, pip, apt-get, mkdir, tee, chmod, chown, cat (khi đọc file trong /etc/)
        boolean needsSudo = command.startsWith("apt") || command.startsWith("pip") || 
                           command.startsWith("apt-get") || command.startsWith("mkdir") ||
                           command.startsWith("tee") || command.startsWith("chmod") ||
                           command.startsWith("chown") || command.startsWith("rm ") ||
                           command.startsWith("cp ") || command.startsWith("mv ") ||
                           (command.startsWith("cat") && command.contains("/etc/"));
        
        String finalCommand = ensureSudoIfNeeded(serverId, command, sudoPassword, needsSudo);
        
        // Tái sử dụng execCommand từ ServerService (đã có logging chi tiết output)
        try {
            return serverService.execCommand(serverId, finalCommand, timeoutMs);
        } catch (Exception e) {
            throw new RuntimeException("Lỗi khi thực thi command: " + e.getMessage(), e);
        }
    }
    
    private String ensureSudoIfNeeded(Long serverId, String command, String sudoPassword, boolean needsSudo) {
        if (!needsSudo) {
            return command;
        }
        
        String trimmed = command.trim();
        if (trimmed.startsWith("sudo ") || trimmed.contains("| sudo -S ")) {
            return command;
        }
        
        try {
            my_spring_app.my_spring_app.dto.reponse.ServerAuthStatusResponse authStatus = 
                serverService.checkServerAuthStatus(serverId);
            if (authStatus.isHasSshKey()
                    && authStatus.getHasSudoNopasswd() != null
                    && authStatus.getHasSudoNopasswd()) {
                return "sudo " + command;
            }
        } catch (Exception ignored) {
        }
        
        if (sudoPassword != null && !sudoPassword.trim().isEmpty()) {
                String escapedPassword = sudoPassword.replace("'", "'\"'\"'");
            return "echo '" + escapedPassword + "' | sudo -S " + command;
        }
        
        return command;
    }
    
    // ==================== Init Ansible (4 steps) ====================
    
    @Override
    public AnsibleOperationResponse initAnsibleStep1(InitAnsibleRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
        TaskStatus taskStatus = createInitTask(taskId, null);
        taskStatus.appendLog("Bắt đầu bước 1...\n");
        taskStatus.setProgress(5);
        initTaskExecutor.submit(() -> runInitAnsibleStep1(request, controllerServer, taskStatus));
        
        response.setSuccess(true);
        response.setMessage("Đang thực hiện bước 1. Theo dõi tiến trình bằng taskId.");
        return response;
    }
    
    @Override
    public AnsibleOperationResponse initAnsibleStep2(InitAnsibleRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        ServerEntity controllerServer = findControllerServer(request.getControllerHost());
        if (controllerServer == null) {
                response.setSuccess(false);
            response.setError("Không tìm thấy controller server");
            response.setMessage("Không tìm thấy controller server");
                return response;
            }
        
        TaskStatus taskStatus = createInitTask(taskId, null);
        taskStatus.appendLog("Bắt đầu bước 2...\n");
        taskStatus.setProgress(5);
        initTaskExecutor.submit(() -> runInitAnsibleStep2(request, controllerServer, taskStatus));
            
            response.setSuccess(true);
        response.setMessage("Đang thực hiện bước 2. Theo dõi tiến trình bằng taskId.");
        return response;
    }
    
    @Override
    public AnsibleOperationResponse initAnsibleStep3(InitAnsibleRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        ServerEntity controllerServer = findControllerServer(request.getControllerHost());
        if (controllerServer == null) {
            response.setSuccess(false);
            response.setError("Không tìm thấy controller server");
            response.setMessage("Không tìm thấy controller server");
            return response;
        }
        
        TaskStatus taskStatus = createInitTask(taskId, null);
        taskStatus.appendLog("Bắt đầu bước 3...\n");
        taskStatus.setProgress(5);
        initTaskExecutor.submit(() -> runInitAnsibleStep3(request, controllerServer, taskStatus));
        
        response.setSuccess(true);
        response.setMessage("Đang thực hiện bước 3. Theo dõi tiến trình bằng taskId.");
        return response;
    }
    
    @Override
    public AnsibleOperationResponse initAnsibleStep4(InitAnsibleRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
        TaskStatus taskStatus = createInitTask(taskId, null);
        taskStatus.appendLog("Bắt đầu bước 4...\n");
        taskStatus.setProgress(5);
        initTaskExecutor.submit(() -> runInitAnsibleStep4(controllerServer, taskStatus));
        
        response.setSuccess(true);
        response.setMessage("Đang thực hiện bước 4. Theo dõi tiến trình bằng taskId.");
        return response;
    }
    
    /**
     * Escape shell string cho single quotes (giống file mẫu)
     */
    private String escapeShellForSingleQuotes(String s) {
        if (s == null) {
            return "''";
        }
        return "'" + s.replace("'", "'\\''") + "'";
    }
    
    private void appendCommandLog(TaskStatus taskStatus, String description, String command, String output) {
        if (taskStatus == null) {
            return;
        }
        StringBuilder buffer = new StringBuilder();
        if (description != null && !description.isBlank()) {
            buffer.append(description).append("\n");
        }
        if (command != null && !command.isBlank()) {
            //buffer.append("$ ").append(command).append("\n");
        }
        if (output != null && !output.trim().isEmpty()) {
            buffer.append(output.trim()).append("\n");
        } else {
            buffer.append("\n");
        }
        buffer.append("\n");
        taskStatus.appendLog(buffer.toString());
    }
    
    private void runInitAnsibleStep1(InitAnsibleRequest request, ServerEntity controllerServer, TaskStatus taskStatus) {
        try {
            Long serverId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            
            String mkdirCmd1 = "sudo mkdir -p /etc/ansible/{playbooks,roles,group_vars,host_vars}";
            String mkdirMainResult = executeCommandWithAuth(serverId, mkdirCmd1, sudoPassword, 15000);
            appendCommandLog(taskStatus, "Tạo các thư mục cấu hình chính", mkdirCmd1, mkdirMainResult);
            taskStatus.setProgress(25);
            
            String mkdirCmd2 = "sudo mkdir -p ~/.ansible";
            String mkdirHome = executeCommandWithAuth(serverId, mkdirCmd2, sudoPassword, 8000);
            appendCommandLog(taskStatus, "Tạo thư mục ~/.ansible", mkdirCmd2, mkdirHome);
            taskStatus.setProgress(45);
            
            String chmodCmd = "sudo chmod -R 755 /etc/ansible";
            String chmodOutput = executeCommandWithAuth(serverId, chmodCmd, sudoPassword, 8000);
            appendCommandLog(taskStatus, "Thay đổi quyền truy cập thư mục /etc/ansible", chmodCmd, chmodOutput);
            taskStatus.setProgress(65);
            
            String verifyCmd = "bash -lc 'for d in /etc/ansible /etc/ansible/group_vars /etc/ansible/host_vars /etc/ansible/playbooks /etc/ansible/roles; do [ -d \"$d\" ] || { echo MISSING:$d; exit 1; }; done; echo OK'";
            String verifyResult = executeCommandWithAuth(serverId, verifyCmd, sudoPassword, 8000);
            appendCommandLog(taskStatus, "Kiểm tra các thư mục vừa tạo", verifyCmd, verifyResult);
            
            if (verifyResult == null || !verifyResult.contains("OK")) {
                taskStatus.markFailed("Xác minh cấu trúc thư mục thất bại: " + verifyResult);
                return;
            }
            
            taskStatus.setProgress(100);
            taskStatus.markCompleted("✅ Hoàn tất bước 1.\n");
        } catch (Exception e) {
            taskStatus.markFailed("Lỗi khi tạo cấu trúc thư mục: " + e.getMessage());
        }
    }
    
    private void runInitAnsibleStep2(InitAnsibleRequest request, ServerEntity controllerServer, TaskStatus taskStatus) {
        try {
            Long serverId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            String controllerUsername = controllerServer.getUsername() != null ? controllerServer.getUsername() : "root";
            
            String ansibleCfg = "[defaults]\n" +
                        "inventory      = /etc/ansible/hosts\n" +
                        "roles_path     = /etc/ansible/roles\n" +
                    "remote_user    = " + controllerUsername + "\n" +
                        "host_key_checking = False\n" +
                        "retry_files_enabled = False\n" +
                        "timeout = 45\n" +
                        "nocows = 1\n" +
                        "forks = 10\n" +
                        "interpreter_python = /usr/bin/python3\n" +
                        "\n" +
                        "# Hiển thị log rõ ràng, có thời gian từng task\n" +
                        "stdout_callback = yaml\n" +
                        "callbacks_enabled = timer, profile_tasks\n" +
                        "\n" +
                        "# Tự động kết thúc nếu gặp lỗi nghiêm trọng\n" +
                        "any_errors_fatal = True\n" +
                        "\n" +
                        "# Ẩn cảnh báo \"deprecation\" khi chạy các module builtin\n" +
                        "deprecation_warnings = False\n";
            
                List<ServerEntity> availableServers = serverRepository.findAll().stream()
                        .filter(s -> s != null && "AVAILABLE".equals(s.getClusterStatus()))
                        .collect(Collectors.toList());
                
            StringBuilder hostsBuilder = new StringBuilder();
                hostsBuilder.append("[master]\n");
                for (ServerEntity s : availableServers) {
                    if ("MASTER".equals(s.getRole())) {
                        String hostname = s.getUsername() != null ? s.getUsername() : s.getIp();
                        hostsBuilder.append(hostname)
                                .append(" ansible_host=").append(s.getIp())
                                .append(" ansible_user=").append(s.getUsername() != null ? s.getUsername() : "root");
                        if (s.getPort() != null) {
                            hostsBuilder.append(" ansible_ssh_port=").append(s.getPort());
                        }
                        hostsBuilder.append("\n");
                    }
                }
                hostsBuilder.append("\n[workers]\n");
                for (ServerEntity s : availableServers) {
                    if ("WORKER".equals(s.getRole())) {
                        String hostname = s.getUsername() != null ? s.getUsername() : s.getIp();
                        hostsBuilder.append(hostname)
                                .append(" ansible_host=").append(s.getIp())
                                .append(" ansible_user=").append(s.getUsername() != null ? s.getUsername() : "root");
                        if (s.getPort() != null) {
                            hostsBuilder.append(" ansible_ssh_port=").append(s.getPort());
                        }
                        hostsBuilder.append("\n");
                    }
                }
                hostsBuilder.append("\n[all:vars]\n")
                        .append("ansible_python_interpreter=/usr/bin/python3\n")
                        .append("ansible_ssh_private_key_file=/home/")
                    .append(controllerUsername)
                        .append("/.ssh/id_rsa\n");
            String ansibleInventory = hostsBuilder.toString();
            String ansibleVars = "";
            
            taskStatus.appendLog("Nội dung ansible.cfg:\n" + ansibleCfg + "\n\n");
            taskStatus.appendLog("Nội dung inventory:\n" + ansibleInventory + "\n");
            taskStatus.setProgress(20);
            
            String escapedCfg = ansibleCfg.replace("'", "'\"'\"'").replace("$", "\\$");
            String escapedInventory = ansibleInventory.replace("'", "'\"'\"'").replace("$", "\\$");
            String escapedVars = ansibleVars.replace("'", "'\"'\"'").replace("$", "\\$");
            
            String mkdirCmd = "mkdir -p /etc/ansible/group_vars";
            String mkdirResult = executeCommandWithAuth(serverId, mkdirCmd, sudoPassword, 8000);
            appendCommandLog(taskStatus, "Đảm bảo /etc/ansible/group_vars tồn tại", mkdirCmd, mkdirResult);
            taskStatus.setProgress(35);
            
            String writeCfgCmd = "tee /etc/ansible/ansible.cfg > /dev/null << 'EOFCFG'\n" + escapedCfg + "\nEOFCFG";
            String cfgWriteResult = executeCommandWithAuth(serverId, writeCfgCmd, sudoPassword, 20000);
            appendCommandLog(taskStatus, "Ghi file /etc/ansible/ansible.cfg", writeCfgCmd, cfgWriteResult);
            taskStatus.setProgress(45);
            
            String verifyCfgCmd = "bash -lc '[ -s /etc/ansible/ansible.cfg ] && echo OK || echo FAIL'";
            String verifyCfg = executeCommandWithAuth(serverId, verifyCfgCmd, sudoPassword, 6000);
            appendCommandLog(taskStatus, "Kiểm tra ansible.cfg", verifyCfgCmd, verifyCfg);
            if (verifyCfg == null || !verifyCfg.contains("OK")) {
                taskStatus.markFailed("Không xác minh được ansible.cfg");
                return;
            }
            taskStatus.setProgress(55);
            
            String writeInventoryCmd = "tee /etc/ansible/hosts > /dev/null << 'EOFINV'\n" + escapedInventory + "\nEOFINV";
            String invWriteResult = executeCommandWithAuth(serverId, writeInventoryCmd, sudoPassword, 20000);
            appendCommandLog(taskStatus, "Ghi file /etc/ansible/hosts", writeInventoryCmd, invWriteResult);
            taskStatus.setProgress(65);
            
            String verifyHostsCmd = "bash -lc '[ -s /etc/ansible/hosts ] && echo OK || echo FAIL'";
            String verifyHosts = executeCommandWithAuth(serverId, verifyHostsCmd, sudoPassword, 6000);
            appendCommandLog(taskStatus, "Kiểm tra hosts file", verifyHostsCmd, verifyHosts);
            if (verifyHosts == null || !verifyHosts.contains("OK")) {
                taskStatus.markFailed("Không xác minh được hosts file");
                return;
            }
            taskStatus.setProgress(80);
            
            if (ansibleVars != null && !ansibleVars.trim().isEmpty()) {
                String writeVarsCmd = "tee /etc/ansible/group_vars/all.yml > /dev/null << 'EOFVARS'\n" + escapedVars + "\nEOFVARS";
                String varsWriteResult = executeCommandWithAuth(serverId, writeVarsCmd, sudoPassword, 10000);
                appendCommandLog(taskStatus, "Ghi file group_vars/all.yml", writeVarsCmd, varsWriteResult);
                
                String verifyVarsCmd = "bash -lc '[ -s /etc/ansible/group_vars/all.yml ] && echo OK || echo FAIL'";
                String verifyVars = executeCommandWithAuth(serverId, verifyVarsCmd, sudoPassword, 6000);
                appendCommandLog(taskStatus, "Kiểm tra group_vars/all.yml", verifyVarsCmd, verifyVars);
                if (verifyVars == null || !verifyVars.contains("OK")) {
                    taskStatus.markFailed("Không xác minh được group_vars/all.yml");
                    return;
                }
            }
            
            taskStatus.setProgress(100);
            taskStatus.markCompleted("✅ Hoàn tất bước 2.\n");
        } catch (Exception e) {
            taskStatus.markFailed("Lỗi khi ghi cấu hình: " + e.getMessage());
        }
    }
    
    private void runInitAnsibleStep3(InitAnsibleRequest request, ServerEntity controllerServer, TaskStatus taskStatus) {
        try {
            Long controllerServerId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            
            List<ServerEntity> allAvailableServers = serverRepository.findAll().stream()
                    .filter(s -> s != null && "AVAILABLE".equals(s.getClusterStatus()))
                    .collect(Collectors.toList());
            
            boolean isAnsibleController = "ANSIBLE".equals(controllerServer.getRole());
            List<ServerEntity> targetServers = new ArrayList<>();
            for (ServerEntity s : allAvailableServers) {
                if (s.getId().equals(controllerServer.getId())) {
                    continue;
                }
                boolean shouldInclude = isAnsibleController
                        ? ("MASTER".equals(s.getRole()) || "WORKER".equals(s.getRole()))
                        : "WORKER".equals(s.getRole());
                if (shouldInclude) {
                    targetServers.add(s);
                }
            }
            
            if (request.getServerIds() != null && !request.getServerIds().isEmpty()) {
                targetServers = targetServers.stream()
                        .filter(s -> request.getServerIds().contains(s.getId()))
                        .collect(Collectors.toList());
            }
            
            if (targetServers.isEmpty()) {
                taskStatus.markFailed("Không có server nào để phân phối SSH key");
                return;
            }
            taskStatus.appendLog("Số server mục tiêu: " + targetServers.size() + "\n");
            taskStatus.setProgress(10);
            
            String ensureKeyCmd = "bash -lc 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && [ -f ~/.ssh/id_rsa.pub ] || ssh-keygen -t rsa -b 2048 -N \"\" -f ~/.ssh/id_rsa -q'";
            String ensureKeyResult = executeCommandWithAuth(controllerServerId, ensureKeyCmd, sudoPassword, 20000);
            appendCommandLog(taskStatus, "Đảm bảo controller có SSH key", ensureKeyCmd, ensureKeyResult);
            
            String getPubKeyCmd = "bash -lc 'cat ~/.ssh/id_rsa.pub'";
            String publicKey = executeCommandWithAuth(controllerServerId, getPubKeyCmd, null, 10000);
            appendCommandLog(taskStatus, "Đọc public key trên controller", getPubKeyCmd, publicKey);
            
            if (publicKey == null || publicKey.trim().isEmpty()) {
                taskStatus.markFailed("Không thể đọc public key từ controller server");
                return;
            }
            publicKey = publicKey.trim();
            
            try {
                String[] partsCore = publicKey.split(" ", 3);
                String core = (partsCore.length > 1 ? partsCore[1] : publicKey.trim());
                String matchTokenMaster = escapeShellForSingleQuotes(core);
                String fullKeyMaster = escapeShellForSingleQuotes(publicKey.trim());
                String ensureSelfAuth = "bash -lc \"mkdir -p $HOME/.ssh && chmod 700 $HOME/.ssh && touch $HOME/.ssh/authorized_keys && chmod 600 $HOME/.ssh/authorized_keys; " +
                        "if grep -Fq " + matchTokenMaster +
                        " $HOME/.ssh/authorized_keys; then echo EXIST; else printf '%s\\n' " + fullKeyMaster +
                        " | tee -a $HOME/.ssh/authorized_keys >/dev/null; fi\"";
                String selfAuthResult = executeCommandWithAuth(controllerServerId, ensureSelfAuth, sudoPassword, 15000);
                appendCommandLog(taskStatus, "Đảm bảo controller có thể kết nối đến chính nó", ensureSelfAuth, selfAuthResult);
            } catch (Exception ignored) {
            }
            
            String keyCore = null;
            try {
                String[] parts = publicKey.split(" ", 3);
                if (parts.length > 1) {
                    keyCore = parts[1];
                }
            } catch (Exception ignored) {}
            
            int successCount = 0;
            int failCount = 0;
            int skipped = 0;
            List<String> errors = new ArrayList<>();
            int processed = 0;
            
            for (ServerEntity targetServer : targetServers) {
                processed++;
                taskStatus.appendLog("→ Phân phối SSH key đến " + (targetServer.getName() != null ? targetServer.getName() : targetServer.getIp())
                        + " (IP: " + targetServer.getIp() + ")\n");
                try {
                    String matchToken = (keyCore != null ? escapeShellForSingleQuotes(keyCore) : escapeShellForSingleQuotes(publicKey));
                    String fullKeyQuoted = escapeShellForSingleQuotes(publicKey);
                    String addKeyCmd = "bash -lc \"mkdir -p $HOME/.ssh && chmod 700 $HOME/.ssh && touch $HOME/.ssh/authorized_keys && chmod 600 $HOME/.ssh/authorized_keys; " +
                            "if grep -Fq " + matchToken +
                            " $HOME/.ssh/authorized_keys; then echo EXIST; else printf '%s\\n' " + fullKeyQuoted +
                            " | tee -a $HOME/.ssh/authorized_keys >/dev/null; fi\"";
                    
                    try {
                        String addOutput = serverService.execCommand(targetServer.getId(), addKeyCmd, 20000);
                        appendCommandLog(taskStatus, "Thêm public key vào authorized_keys", addKeyCmd, addOutput);
                    } catch (Exception e) {
                        skipped++;
                        errors.add(targetServer.getIp() + ": Không thể kết nối - " + e.getMessage());
                        taskStatus.appendLog("   ⚠️ Bỏ qua: " + e.getMessage() + "\n");
                        continue;
                    }
                    
                    String verifyCmd = "bash -lc \"if grep -Fq " + matchToken +
                            " $HOME/.ssh/authorized_keys; then echo OK; else echo FAIL; fi\"";
                    String verify = null;
                    try {
                        verify = serverService.execCommand(targetServer.getId(), verifyCmd, 12000);
                        appendCommandLog(taskStatus, "Kiểm tra key trên node", verifyCmd, verify);
                    } catch (Exception e) {
                        appendCommandLog(taskStatus, "Kiểm tra key trên node", verifyCmd, e.getMessage());
                    }
                    
                    if (verify != null && verify.contains("OK")) {
                        successCount++;
                        taskStatus.appendLog("   ✅ Thành công\n");
                    } else {
                        failCount++;
                        errors.add(targetServer.getIp() + ": Không xác minh được");
                        taskStatus.appendLog("   ❌ Không xác minh được key\n");
                    }
                } catch (Exception e) {
                    failCount++;
                    errors.add(targetServer.getIp() + ": " + e.getMessage());
                    taskStatus.appendLog("   ❌ Lỗi: " + e.getMessage() + "\n");
                } finally {
                    int progress = 10 + (processed * 80 / targetServers.size());
                    taskStatus.setProgress(Math.min(90, progress));
                }
            }
            
            if (failCount == 0 && skipped == 0) {
                taskStatus.setProgress(100);
                taskStatus.markCompleted("✅ Đã phân phối SSH key thành công đến " + successCount + " server(s)\n");
            } else {
                String summary = "Tổng kết: " + successCount + " OK, " + failCount + " FAILED, " + skipped + " SKIPPED";
                taskStatus.appendLog(summary + "\n");
                if (!errors.isEmpty()) {
                    taskStatus.appendLog("Chi tiết lỗi: " + String.join("; ", errors) + "\n");
                }
                if (failCount >= targetServers.size()) {
                    taskStatus.markFailed("Phân phối SSH key thất bại cho tất cả servers");
                } else {
                    taskStatus.setProgress(100);
                    taskStatus.markCompleted("Hoàn tất với một số lỗi. Vui lòng kiểm tra log chi tiết.\n");
                }
            }
        } catch (Exception e) {
            taskStatus.markFailed("Lỗi khi phân phối SSH key: " + e.getMessage());
        }
    }
    
    private void runInitAnsibleStep4(ServerEntity controllerServer, TaskStatus taskStatus) {
        try {
            Long controllerServerId = controllerServer.getId();
            
            String checkHostsCmd = "bash -lc '[ -s /etc/ansible/hosts ] && echo OK || echo EMPTY'";
            String hostsCheck = executeCommandWithAuth(controllerServerId, checkHostsCmd, null, 5000);
            appendCommandLog(taskStatus, "Kiểm tra file hosts trước khi ping", checkHostsCmd, hostsCheck);
            if (hostsCheck == null || !hostsCheck.contains("OK")) {
                taskStatus.markFailed("File hosts không tồn tại hoặc rỗng. Vui lòng khởi tạo cấu hình trước.");
                return;
            }
            
            taskStatus.setProgress(40);
            String pingCmd = "bash -lc 'ansible all -m ping -i /etc/ansible/hosts -T 5'";
            try {
                // Thu thập output để phân tích
                StringBuilder pingOutput = new StringBuilder();
                String fullOutput = serverService.execCommand(
                    controllerServer.getId(), 
                    pingCmd, 
                    60000, 
                    chunk -> {
                        pingOutput.append(chunk);
                        taskStatus.appendLog(chunk);
                    }
                );
                
                // Thêm full output vào nếu chưa có
                if (fullOutput != null && !fullOutput.isEmpty()) {
                    pingOutput.append(fullOutput);
                }
                
                String outputText = pingOutput.toString();
                
                // Kiểm tra xem có host nào ping thất bại không
                java.util.List<String> failedHosts = new java.util.ArrayList<>();
                java.util.List<String> unreachableHosts = new java.util.ArrayList<>();
                java.util.Map<String, String> failedHostMessages = new java.util.HashMap<>();
                java.util.Map<String, String> unreachableHostMessages = new java.util.HashMap<>();
                
                // Parse output để tìm các host bị lỗi và message lỗi
                // Pattern: hostname | FAILED! => { ... "msg": "error message" ... }
                // Pattern: hostname | UNREACHABLE! => { ... "msg": "error message" ... }
                String[] lines = outputText.split("\n");
                String currentHost = null;
                String currentStatus = null;
                StringBuilder jsonBlock = new StringBuilder();
                boolean inJsonBlock = false;
                
                for (String line : lines) {
                    String trimmedLine = line.trim();
                    
                    // Tìm dòng bắt đầu với hostname và status
                    if (trimmedLine.contains("| FAILED!") || trimmedLine.contains("| UNREACHABLE!")) {
                        // Lưu block JSON trước đó nếu có
                        if (currentHost != null && inJsonBlock) {
                            String jsonStr = jsonBlock.toString();
                            String errorMsg = extractErrorMessage(jsonStr);
                            if (currentStatus != null && currentStatus.contains("FAILED")) {
                                if (!failedHosts.contains(currentHost)) {
                                    failedHosts.add(currentHost);
                                    failedHostMessages.put(currentHost, errorMsg);
                                }
                            } else if (currentStatus != null && currentStatus.contains("UNREACHABLE")) {
                                if (!unreachableHosts.contains(currentHost)) {
                                    unreachableHosts.add(currentHost);
                                    unreachableHostMessages.put(currentHost, errorMsg);
                                }
                            }
                        }
                        
                        // Parse hostname và status mới
                        int pipeIndex = trimmedLine.indexOf("|");
                        if (pipeIndex > 0) {
                            currentHost = trimmedLine.substring(0, pipeIndex).trim();
                            if (trimmedLine.contains("FAILED")) {
                                currentStatus = "FAILED";
                            } else if (trimmedLine.contains("UNREACHABLE")) {
                                currentStatus = "UNREACHABLE";
                            }
                            jsonBlock = new StringBuilder();
                            inJsonBlock = true;
                            
                            // Lấy phần JSON sau "=>"
                            int arrowIndex = trimmedLine.indexOf("=>");
                            if (arrowIndex > 0 && trimmedLine.length() > arrowIndex + 2) {
                                String afterArrow = trimmedLine.substring(arrowIndex + 2).trim();
                                if (afterArrow.startsWith("{")) {
                                    jsonBlock.append(afterArrow);
                                }
                            }
                        }
                    } else if (inJsonBlock && currentHost != null) {
                        // Tiếp tục thu thập JSON block
                        jsonBlock.append(line).append("\n");
                        
                        // Kiểm tra xem đã kết thúc JSON block chưa (dòng chỉ có "}")
                        if (trimmedLine.equals("}")) {
                            String jsonStr = jsonBlock.toString();
                            String errorMsg = extractErrorMessage(jsonStr);
                            if (currentStatus != null && currentStatus.contains("FAILED")) {
                                if (!failedHosts.contains(currentHost)) {
                                    failedHosts.add(currentHost);
                                    failedHostMessages.put(currentHost, errorMsg);
                                }
                            } else if (currentStatus != null && currentStatus.contains("UNREACHABLE")) {
                                if (!unreachableHosts.contains(currentHost)) {
                                    unreachableHosts.add(currentHost);
                                    unreachableHostMessages.put(currentHost, errorMsg);
                                }
                            }
                            inJsonBlock = false;
                            currentHost = null;
                            currentStatus = null;
                            jsonBlock = new StringBuilder();
                        }
                    }
                }
                
                // Xử lý block cuối cùng nếu còn
                if (currentHost != null && inJsonBlock) {
                    String jsonStr = jsonBlock.toString();
                    String errorMsg = extractErrorMessage(jsonStr);
                    if (currentStatus != null && currentStatus.contains("FAILED")) {
                        if (!failedHosts.contains(currentHost)) {
                            failedHosts.add(currentHost);
                            failedHostMessages.put(currentHost, errorMsg);
                        }
                    } else if (currentStatus != null && currentStatus.contains("UNREACHABLE")) {
                        if (!unreachableHosts.contains(currentHost)) {
                            unreachableHosts.add(currentHost);
                            unreachableHostMessages.put(currentHost, errorMsg);
                        }
                    }
                }
                
                // Báo lỗi nếu có host nào ping thất bại - chỉ hiển thị hostname + message lỗi
                if (!failedHosts.isEmpty() || !unreachableHosts.isEmpty()) {
                    StringBuilder errorMsg = new StringBuilder();
                    errorMsg.append("Ping thất bại:\n");
                    
                    if (!failedHosts.isEmpty()) {
                        for (String host : failedHosts) {
                            errorMsg.append("   • ").append(host);
                            String msg = failedHostMessages.get(host);
                            if (msg != null && !msg.isEmpty()) {
                                errorMsg.append(": ").append(msg);
                            }
                            errorMsg.append("\n");
                        }
                    }
                    
                    if (!unreachableHosts.isEmpty()) {
                        for (String host : unreachableHosts) {
                            errorMsg.append("   • ").append(host);
                            String msg = unreachableHostMessages.get(host);
                            if (msg != null && !msg.isEmpty()) {
                                errorMsg.append(": ").append(msg);
                            }
                            errorMsg.append("\n");
                        }
                    }
                    
                    taskStatus.markFailed(errorMsg.toString().trim());
                    return;
                }
                
                // Kiểm tra xem có ít nhất một host SUCCESS không
                boolean hasSuccess = outputText.contains("SUCCESS") && outputText.contains("ping");
                if (!hasSuccess) {
                    taskStatus.markFailed("Không có host nào ping thành công. Vui lòng kiểm tra lại cấu hình.");
                    return;
                }
                
                taskStatus.setProgress(100);
                taskStatus.markCompleted("✅ Ping hoàn tất thành công cho tất cả hosts.\n");
            } catch (Exception pingError) {

                taskStatus.markFailed("Lỗi khi thực thi ping: " + pingError.getMessage());
            }
        } catch (Exception e) {
            taskStatus.markFailed("Lỗi khi ping nodes: " + e.getMessage());
        }
    }
    
    /**
     * Extract error message từ JSON block của Ansible output
     * Tìm field "msg" trong JSON
     */
    private String extractErrorMessage(String jsonBlock) {
        if (jsonBlock == null || jsonBlock.isEmpty()) {
            return "";
        }
        
        // Tìm pattern "msg": "message content"
        // Hoặc "msg": 'message content'
        Pattern msgPattern = Pattern.compile("\"msg\"\\s*:\\s*\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
        java.util.regex.Matcher matcher = msgPattern.matcher(jsonBlock);
        if (matcher.find()) {
            return matcher.group(1);
        }
        
        // Thử pattern với single quote
        Pattern msgPattern2 = Pattern.compile("'msg'\\s*:\\s*'([^']+)'", Pattern.CASE_INSENSITIVE);
        matcher = msgPattern2.matcher(jsonBlock);
        if (matcher.find()) {
            return matcher.group(1);
        }
        
        return "";
    }
    
    private void runPlaybookExecution(ExecutePlaybookRequest request, ServerEntity controllerServer, TaskStatus taskStatus) {
        try {
            Long serverId = controllerServer.getId();
            String filename = request.getFilename().trim();
            String sudoPassword = request.getSudoPassword();
            
            StringBuilder commandBuilder = new StringBuilder();
            commandBuilder.append("bash -lc 'cd /etc/ansible && ansible-playbook /etc/ansible/playbooks/")
                    .append(filename)
                    .append("'");
            
            if (request.getExtraVars() != null && !request.getExtraVars().trim().isEmpty()) {
                String escaped = request.getExtraVars().replace("\"", "\\\"");
                int lastQuoteIndex = commandBuilder.lastIndexOf("'");
                commandBuilder.insert(lastQuoteIndex, " -e \"" + escaped + "\"");
            }
            
            String baseCommand = commandBuilder.toString();
            String finalCommand = ensureSudoIfNeeded(serverId, baseCommand, sudoPassword, true);
            
            taskStatus.appendLog("▶️ " + baseCommand + "\n");
            taskStatus.setProgress(25);
            serverService.execCommand(serverId, finalCommand, 300000, chunk -> taskStatus.appendLog(chunk));
            
            taskStatus.setProgress(100);
            taskStatus.markCompleted("🎉 Đã thực thi playbook thành công: " + filename + "\n");
        } catch (Exception e) {
            taskStatus.markFailed("Lỗi khi thực thi playbook: " + e.getMessage());
        }
    }
    
    
    private TaskStatus createInitTask(String taskId, String title) {
        TaskStatus status = new TaskStatus(taskId);
        if (title != null && !title.isBlank()) {
            status.appendLog(title + "\n");
        }
        initTaskCache.put(taskId, status);
        return status;
    }
    
    private TaskStatus createPlaybookTask(String taskId, String title) {
        TaskStatus status = new TaskStatus(taskId);
        if (title != null && !title.isBlank()) {
            status.appendLog(title + "\n");
        }
        playbookTaskCache.put(taskId, status);
        return status;
    }
    
    private static class TaskStatus {
        private final String taskId;
        private final StringBuilder logs = new StringBuilder();
        private final long startTime = System.currentTimeMillis();
        private volatile Long endTime;
        private volatile String status = "running";
        private volatile int progress = 0;
        private volatile String error;
        
        TaskStatus(String taskId) {
            this.taskId = taskId;
        }
        
        synchronized void appendLog(String text) {
            logs.append(text);
        }
        
        synchronized String snapshotLogs() {
            return logs.toString();
        }
        
        void setProgress(int progress) {
            this.progress = Math.max(0, Math.min(100, progress));
        }
        
        void markCompleted(String message) {
            this.status = "completed";
            this.endTime = System.currentTimeMillis();
            if (message != null && !message.isBlank()) {
                appendLog(message.endsWith("\n") ? message : message + "\n");
        }
        }
        
        void markFailed(String message) {
            this.status = "failed";
            this.error = message;
            this.endTime = System.currentTimeMillis();
            if (message != null && !message.isBlank()) {
                appendLog("❌ " + message + (message.endsWith("\n") ? "" : "\n"));
            }
        }
        
        @SuppressWarnings("unused")
        String getTaskId() {
            return taskId;
        }
        
        String getStatus() {
            return status;
        }
        
        int getProgress() {
            return progress;
        }
        
        long getStartTime() {
            return startTime;
        }
        
        Long getEndTime() {
            return endTime;
        }
        
        String getError() {
            return error;
        }
    }
    
    @Override
    public AnsibleTaskStatusResponse getInitTaskStatus(String taskId) {
        AnsibleTaskStatusResponse response = new AnsibleTaskStatusResponse();
        response.setTaskId(taskId);
        TaskStatus status = initTaskCache.get(taskId);
        if (status == null) {
            response.setSuccess(false);
            response.setStatus("not_found");
            response.setLogs("");
            response.setProgress(0);
            response.setError("Không tìm thấy task hoặc task đã hết hạn");
            return response;
        }
        
        response.setSuccess(true);
        response.setStatus(status.getStatus());
        response.setProgress(status.getProgress());
        response.setLogs(status.snapshotLogs());
        response.setStartTime(status.getStartTime());
        response.setEndTime(status.getEndTime());
        response.setError(status.getError());
        return response;
    }
    
    @Override
    public AnsibleTaskStatusResponse getPlaybookTaskStatus(String taskId) {
        AnsibleTaskStatusResponse response = new AnsibleTaskStatusResponse();
        response.setTaskId(taskId);
        TaskStatus status = playbookTaskCache.get(taskId);
        if (status == null) {
            response.setSuccess(false);
            response.setStatus("not_found");
            response.setLogs("");
            response.setProgress(0);
            response.setError("Không tìm thấy task hoặc task đã hết hạn");
            return response;
        }
        
        response.setSuccess(true);
        response.setStatus(status.getStatus());
        response.setProgress(status.getProgress());
        response.setLogs(status.snapshotLogs());
        response.setStartTime(status.getStartTime());
        response.setEndTime(status.getEndTime());
        response.setError(status.getError());
        return response;
    }
    
    // ==================== Config Ansible ====================
    
    @Override
    public AnsibleOperationResponse saveAnsibleConfig(SaveAnsibleConfigRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            Long serverId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            
            // Ghi thẳng nội dung (heredoc với quote đơn giữ nguyên mọi ký tự)
            String cfgContent = Optional.ofNullable(request.getAnsibleCfg()).orElse("");
            String inventoryContent = Optional.ofNullable(request.getAnsibleInventory()).orElse("");
            String varsContent = Optional.ofNullable(request.getAnsibleVars()).orElse("");
            
            String writeCfgCmd = "sudo tee /etc/ansible/ansible.cfg > /dev/null << 'EOFCFG'\n" + cfgContent + "\nEOFCFG";
            executeCommandWithAuth(serverId, writeCfgCmd, sudoPassword, 10000);
            
            String writeInventoryCmd = "sudo tee /etc/ansible/hosts > /dev/null << 'EOFINV'\n" + inventoryContent + "\nEOFINV";
            executeCommandWithAuth(serverId, writeInventoryCmd, sudoPassword, 10000);
            
            String writeVarsCmd = "sudo tee /etc/ansible/group_vars/all.yml > /dev/null << 'EOFVARS'\n" + varsContent + "\nEOFVARS";
            executeCommandWithAuth(serverId, writeVarsCmd, sudoPassword, 10000);
            
            response.setSuccess(true);
            response.setMessage("Đã lưu cấu hình Ansible thành công");
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi lưu cấu hình: " + e.getMessage());
        }
        
        return response;
    }
    
    @Override
    public AnsibleOperationResponse verifyAnsibleConfig(VerifyAnsibleConfigRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            // Verify bằng cách kiểm tra syntax của ansible.cfg và inventory
            // Tạm thời chỉ kiểm tra cơ bản
            if (request.getAnsibleCfg() == null || request.getAnsibleCfg().trim().isEmpty()) {
                response.setSuccess(false);
                response.setError("Ansible config không được để trống");
                response.setMessage("Ansible config không được để trống");
                return response;
            }
            
            if (request.getAnsibleInventory() == null || request.getAnsibleInventory().trim().isEmpty()) {
                response.setSuccess(false);
                response.setError("Ansible inventory không được để trống");
                response.setMessage("Ansible inventory không được để trống");
                return response;
            }
            
            // Kiểm tra syntax inventory bằng ansible-inventory
            Long serverId = controllerServer.getId();
            String tempInventory = "/tmp/ansible_inventory_verify_" + System.currentTimeMillis();
            String inventoryContent = Optional.ofNullable(request.getAnsibleInventory()).orElse("");
            String writeTempCmd = "sudo tee " + tempInventory + " > /dev/null << 'EOFTEMP'\n" + inventoryContent + "\nEOFTEMP";
            executeCommandWithAuth(serverId, writeTempCmd, null, 10000);
            
            try {
                String verifyCmd = "ansible-inventory -i " + tempInventory + " --list > /dev/null 2>&1";
                executeCommandWithAuth(serverId, verifyCmd, null, 10000);
                response.setSuccess(true);
                response.setMessage("Cấu hình Ansible hợp lệ");
            } catch (Exception e) {
                response.setSuccess(false);
                response.setError("Cấu hình Ansible không hợp lệ: " + e.getMessage());
                response.setMessage("Cấu hình Ansible không hợp lệ: " + e.getMessage());
            } finally {
                // Xóa file tạm
                try {
                    executeCommandWithAuth(serverId, "sudo rm -f " + tempInventory, null, 5000);
                } catch (Exception ignored) {
                }
            }
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi verify cấu hình: " + e.getMessage());
        }
        
        return response;
    }
    
    @Override
    public my_spring_app.my_spring_app.dto.reponse.AnsibleConfigResponse getAnsibleConfig(String controllerHost) {
        my_spring_app.my_spring_app.dto.reponse.AnsibleConfigResponse response = 
            new my_spring_app.my_spring_app.dto.reponse.AnsibleConfigResponse();
        
        try {
            ServerEntity controllerServer = findControllerServer(controllerHost);
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                return response;
            }
            
            Long serverId = controllerServer.getId();
            response.setControllerHost(controllerServer.getIp());
            
            // Đọc ansible.cfg (cần sudo để đọc file trong /etc/ansible)
            String cfg = "";
            try {
                // Sử dụng sudo cat để đọc file trong /etc/ansible
                String readCfgCmd = "cat /etc/ansible/ansible.cfg 2>/dev/null || echo ''";
                cfg = executeCommandWithAuth(serverId, readCfgCmd, null, 10000);
                if (cfg == null || cfg.trim().isEmpty() || cfg.trim().equals("''")) {
                    cfg = "";
                }
            } catch (Exception e) {
                System.err.println("Lỗi khi đọc ansible.cfg: " + e.getMessage());
                cfg = "";
            }
            
            // Đọc hosts file (cần sudo để đọc file trong /etc/ansible)
            String inventory = "";
            try {
                String readInventoryCmd = "cat /etc/ansible/hosts 2>/dev/null || echo ''";
                inventory = executeCommandWithAuth(serverId, readInventoryCmd, null, 10000);
                if (inventory == null || inventory.trim().isEmpty() || inventory.trim().equals("''")) {
                    inventory = "";
                }
            } catch (Exception e) {
                System.err.println("Lỗi khi đọc hosts: " + e.getMessage());
                inventory = "";
            }
            
            // Đọc group_vars/all.yml (cần sudo để đọc file trong /etc/ansible)
            String vars = "";
            try {
                String readVarsCmd = "cat /etc/ansible/group_vars/all.yml 2>/dev/null || echo ''";
                vars = executeCommandWithAuth(serverId, readVarsCmd, null, 10000);
                if (vars == null || vars.trim().isEmpty() || vars.trim().equals("''")) {
                    vars = "";
                }
            } catch (Exception e) {
                System.err.println("Lỗi khi đọc group_vars/all.yml: " + e.getMessage());
                vars = "";
            }
            
            response.setSuccess(true);
            response.setAnsibleCfg(cfg);
            response.setAnsibleInventory(inventory);
            response.setAnsibleVars(vars);
            
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError(e.getMessage());
        }
        
        return response;
    }
    
    // ==================== Playbook ====================
    
    @Override
    public PlaybookListResponse getPlaybooks(String controllerHost) {
        PlaybookListResponse response = new PlaybookListResponse();
        List<PlaybookResponse> playbooks = new ArrayList<>();
        
        try {
            ServerEntity controllerServer = findControllerServer(controllerHost);
            if (controllerServer == null) {
                response.setPlaybooks(playbooks);
                response.setTotal(0);
                return response;
            }
            
            Long serverId = controllerServer.getId();
            
            // Liệt kê các file playbook
            String listCmd = "sudo ls -1 /etc/ansible/playbooks/*.yml /etc/ansible/playbooks/*.yaml 2>/dev/null || echo ''";
            String fileList = executeCommandWithAuth(serverId, listCmd, null, 10000);
            
            if (fileList != null && !fileList.trim().isEmpty()) {
                String[] files = fileList.trim().split("\\n");
                for (String filePath : files) {
                    if (filePath.trim().isEmpty()) continue;
                    
                    try {
                        String filename = filePath.substring(filePath.lastIndexOf('/') + 1);
                        String readCmd = "sudo cat " + filePath;
                        String content = executeCommandWithAuth(serverId, readCmd, null, 10000);
                        
                        PlaybookResponse playbook = new PlaybookResponse();
                        playbook.setName(filename);
                        playbook.setContent(content != null ? content : "");
                        playbook.setSize((long) (content != null ? content.length() : 0));
                        playbooks.add(playbook);
                    } catch (Exception e) {
                        // Bỏ qua file lỗi
                        System.err.println("Lỗi khi đọc playbook " + filePath + ": " + e.getMessage());
                    }
                }
            }
            
            response.setPlaybooks(playbooks);
            response.setTotal(playbooks.size());
        } catch (Exception e) {
            System.err.println("Lỗi khi lấy danh sách playbooks: " + e.getMessage());
            response.setPlaybooks(playbooks);
            response.setTotal(0);
        }
        
        return response;
    }
    
    @Override
    public AnsibleOperationResponse savePlaybook(SavePlaybookRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            Long serverId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            
            // Đảm bảo filename có extension .yml hoặc .yaml
            String filename = request.getFilename();
            if (filename == null || filename.trim().isEmpty()) {
                response.setSuccess(false);
                response.setError("Tên file không được để trống");
                response.setMessage("Tên file không được để trống");
                return response;
            }
            
            if (!filename.toLowerCase().endsWith(".yml") && !filename.toLowerCase().endsWith(".yaml")) {
                filename = filename + ".yml";
            }
            
            // Tạo thư mục playbooks nếu chưa có
            String mkdirCmd = "sudo mkdir -p /etc/ansible/playbooks";
            executeCommandWithAuth(serverId, mkdirCmd, sudoPassword, 10000);
            
            // Ghi file playbook
            String filePath = "/etc/ansible/playbooks/" + filename;
            String playbookContent = Optional.ofNullable(request.getContent()).orElse("");
            String writeCmd = "sudo tee " + filePath + " > /dev/null << 'EOFPB'\n" + playbookContent + "\nEOFPB";
            executeCommandWithAuth(serverId, writeCmd, sudoPassword, 10000);
            
            response.setSuccess(true);
            response.setMessage("Đã lưu playbook thành công: " + filename);
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi lưu playbook: " + e.getMessage());
        }
        
        return response;
    }

    @Override
    public AnsibleOperationResponse uploadPlaybook(MultipartFile file, String controllerHost, String sudoPassword) {
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(UUID.randomUUID().toString());
        if (file == null || file.isEmpty()) {
            response.setSuccess(false);
            response.setError("File playbook không hợp lệ");
            response.setMessage("File playbook không hợp lệ");
            return response;
        }

        try {
            String originalName = file.getOriginalFilename();
            String filename = (originalName != null && !originalName.isBlank()) ? originalName.trim() : ("playbook-" + System.currentTimeMillis() + ".yml");
            if (!filename.toLowerCase().endsWith(".yml") && !filename.toLowerCase().endsWith(".yaml")) {
                filename = filename + ".yml";
            }

            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            SavePlaybookRequest saveRequest = new SavePlaybookRequest(controllerHost, sudoPassword, filename, content);
            AnsibleOperationResponse saveResponse = savePlaybook(saveRequest);
            if (saveResponse.getMessage() == null || saveResponse.getMessage().isBlank()) {
                saveResponse.setMessage("Đã tải lên playbook " + filename);
            }
            return saveResponse;
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError("Lỗi khi upload playbook: " + e.getMessage());
            response.setMessage("Lỗi khi upload playbook: " + e.getMessage());
            return response;
        }
    }
    
    @Override
    public AnsibleOperationResponse deletePlaybook(DeletePlaybookRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            Long serverId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            
            String filename = request.getFilename();
            if (filename == null || filename.trim().isEmpty()) {
                response.setSuccess(false);
                response.setError("Tên file không được để trống");
                response.setMessage("Tên file không được để trống");
                return response;
            }
            
            String filePath = "/etc/ansible/playbooks/" + filename;
            String deleteCmd = "sudo rm -f " + filePath;
            executeCommandWithAuth(serverId, deleteCmd, sudoPassword, 10000);
            
            response.setSuccess(true);
            response.setMessage("Đã xóa playbook thành công: " + filename);
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi xóa playbook: " + e.getMessage());
        }
        
        return response;
    }
    
    @Override
    public AnsibleOperationResponse executePlaybook(ExecutePlaybookRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            String filename = request.getFilename();
            if (filename == null || filename.trim().isEmpty()) {
                response.setSuccess(false);
                response.setError("Tên file không được để trống");
                response.setMessage("Tên file không được để trống");
                return response;
            }
            
            TaskStatus taskStatus = createPlaybookTask(taskId, "Bắt đầu thực thi playbook: " + filename);
            taskStatus.setProgress(5);
            playbookTaskExecutor.submit(() -> runPlaybookExecution(request, controllerServer, taskStatus));
            
            response.setSuccess(true);
            response.setMessage("Đang thực thi playbook. Theo dõi tiến trình bằng taskId.");
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi thực thi playbook: " + e.getMessage());
        }
        
        return response;
    }
    
    // ==================== Install K8s ====================
    
    @Override
    public AnsibleOperationResponse installK8sTab1(InstallK8sRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            Long serverId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            
            // Chuẩn bị môi trường: update hosts, hostname, disable swap, etc.
            String prepCmd = "sudo bash -c '" +
                    "apt-get update -y && " +
                    "apt-get install -y apt-transport-https ca-certificates curl && " +
                    "swapoff -a && " +
                    "sed -i '/ swap / s/^/#/' /etc/fstab'";
            
            executeCommandWithAuth(serverId, prepCmd, sudoPassword, 60000);
            
            response.setSuccess(true);
            response.setMessage("Đã chuẩn bị môi trường thành công");
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi chuẩn bị môi trường: " + e.getMessage());
        }
        
        return response;
    }
    
    @Override
    public AnsibleOperationResponse installK8sTab2(InstallK8sRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            Long serverId = controllerServer.getId();
            String sudoPassword = request.getSudoPassword();
            
            String k8sVersion = request.getK8sVersion() != null ? request.getK8sVersion() : "1.28.0";
            // Extract major.minor version (e.g., "1.28" from "1.28.0")
            String k8sVersionShort = k8sVersion.substring(0, k8sVersion.lastIndexOf('.'));
            
            // Cài đặt K8s components
            String installCmd = "sudo bash -c '" +
                    "curl -fsSL https://pkgs.k8s.io/core:/stable:/v" + k8sVersionShort + "/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg && " +
                    "echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v" + k8sVersionShort + "/deb/ /' | tee /etc/apt/sources.list.d/kubernetes.list && " +
                    "apt-get update -y && " +
                    "apt-get install -y kubelet=" + k8sVersion + "-00 kubeadm=" + k8sVersion + "-00 kubectl=" + k8sVersion + "-00 && " +
                    "apt-mark hold kubelet kubeadm kubectl'";
            
            executeCommandWithAuth(serverId, installCmd, sudoPassword, 120000);
            
            response.setSuccess(true);
            response.setMessage("Đã cài đặt K8s components thành công");
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi cài đặt K8s components: " + e.getMessage());
        }
        
        return response;
    }
    
    @Override
    public AnsibleOperationResponse installK8sTab3(InstallK8sRequest request) {
        String taskId = UUID.randomUUID().toString();
        AnsibleOperationResponse response = new AnsibleOperationResponse();
        response.setTaskId(taskId);
        
        try {
            ServerEntity controllerServer = findControllerServer(request.getControllerHost());
            if (controllerServer == null) {
                response.setSuccess(false);
                response.setError("Không tìm thấy controller server");
                response.setMessage("Không tìm thấy controller server");
                return response;
            }
            
            // Lấy master node IP
            String masterNodeIp = request.getMasterNodeIp();
            if (masterNodeIp == null || masterNodeIp.trim().isEmpty()) {
                // Tự động tìm master node
                ServerEntity masterServer = serverRepository.findAll().stream()
                        .filter(s -> s != null && "MASTER".equals(s.getRole()) && "AVAILABLE".equals(s.getClusterStatus()))
                        .findFirst()
                        .orElse(null);
                if (masterServer != null) {
                    masterNodeIp = masterServer.getIp();
                } else {
                    response.setSuccess(false);
                    response.setError("Không tìm thấy master node");
                    response.setMessage("Không tìm thấy master node");
                    return response;
                }
            }
            
            // Lấy danh sách worker nodes
            List<String> workerNodeIps = request.getWorkerNodeIps();
            if (workerNodeIps == null || workerNodeIps.isEmpty()) {
                workerNodeIps = serverRepository.findAll().stream()
                        .filter(s -> s != null && "WORKER".equals(s.getRole()) && "AVAILABLE".equals(s.getClusterStatus()))
                        .map(ServerEntity::getIp)
                        .collect(Collectors.toList());
            }
            
            if (workerNodeIps.isEmpty()) {
                response.setSuccess(false);
                response.setError("Không có worker node nào để join");
                response.setMessage("Không có worker node nào để join");
                return response;
            }
            
            // Lấy join command từ master node (giả sử đã có token)
            // Trong thực tế, cần lấy từ master node sau khi init
            String joinCommand = "kubeadm join " + masterNodeIp + ":6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>";
            
            // Thực thi join command trên các worker nodes
            int successCount = 0;
            int failCount = 0;
            List<String> errors = new ArrayList<>();
            
            for (String workerIp : workerNodeIps) {
                try {
                    ServerEntity workerServer = serverRepository.findAll().stream()
                            .filter(s -> s != null && workerIp.equals(s.getIp()))
                            .findFirst()
                            .orElse(null);
                    
                    if (workerServer != null) {
                        // Thực thi join command trên worker node
                        String sudoPassword = request.getSudoPassword();
                        Long workerServerId = workerServer.getId();
                        executeCommandWithAuth(workerServerId, "sudo " + joinCommand, sudoPassword, 120000);
                        successCount++;
                    } else {
                        failCount++;
                        errors.add(workerIp + ": Không tìm thấy server");
                    }
                } catch (Exception e) {
                    failCount++;
                    errors.add(workerIp + ": " + e.getMessage());
                }
            }
            
            if (failCount == 0) {
                response.setSuccess(true);
                response.setMessage("Đã join thành công " + successCount + " worker node(s) vào cluster");
            } else {
                response.setSuccess(failCount < workerNodeIps.size());
                response.setMessage("Đã join thành công " + successCount + "/" + workerNodeIps.size() + " worker node(s). Lỗi: " + String.join("; ", errors));
                response.setError(String.join("; ", errors));
            }
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setMessage("Lỗi khi join worker nodes: " + e.getMessage());
        }
        
        return response;
    }
}

