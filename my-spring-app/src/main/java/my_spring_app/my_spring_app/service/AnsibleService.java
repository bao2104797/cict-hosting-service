package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.AnsibleStatusResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleOperationResponse;
import my_spring_app.my_spring_app.dto.reponse.PlaybookListResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleTaskStatusResponse;
import my_spring_app.my_spring_app.dto.request.InstallAnsibleRequest;
import my_spring_app.my_spring_app.dto.request.InitAnsibleRequest;
import my_spring_app.my_spring_app.dto.request.SaveAnsibleConfigRequest;
import my_spring_app.my_spring_app.dto.request.VerifyAnsibleConfigRequest;
import my_spring_app.my_spring_app.dto.request.SavePlaybookRequest;
import my_spring_app.my_spring_app.dto.request.DeletePlaybookRequest;
import my_spring_app.my_spring_app.dto.request.ExecutePlaybookRequest;
import my_spring_app.my_spring_app.dto.request.InstallK8sRequest;
import org.springframework.web.multipart.MultipartFile;

public interface AnsibleService {
    /**
     * Kiểm tra trạng thái Ansible trên controller server (server có role ANSIBLE hoặc MASTER).
     * 
     * @return AnsibleStatusResponse chứa thông tin trạng thái Ansible (installed, version, controllerHost, controllerRole)
     */
    AnsibleStatusResponse getAnsibleStatus();
    
    /**
     * Cài đặt Ansible trên controller server
     * @param request InstallAnsibleRequest chứa controllerHost và sudoPassword
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse installAnsible(InstallAnsibleRequest request);
    
    /**
     * Cài đặt lại Ansible trên controller server
     * @param request InstallAnsibleRequest chứa controllerHost và sudoPassword
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse reinstallAnsible(InstallAnsibleRequest request);
    
    /**
     * Gỡ Ansible khỏi controller server
     * @param request InstallAnsibleRequest chứa controllerHost và sudoPassword
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse uninstallAnsible(InstallAnsibleRequest request);
    
    // ==================== Init Ansible (4 steps) ====================
    
    /**
     * Init Ansible Step 1: Tạo cấu trúc thư mục
     * @param request InitAnsibleRequest chứa controllerHost và sudoPassword
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse initAnsibleStep1(InitAnsibleRequest request);
    
    /**
     * Init Ansible Step 2: Ghi cấu hình mặc định
     * @param request InitAnsibleRequest chứa controllerHost, sudoPassword, và config content
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse initAnsibleStep2(InitAnsibleRequest request);
    
    /**
     * Init Ansible Step 3: Phân phối SSH key
     * @param request InitAnsibleRequest chứa controllerHost, sudoPassword, và serverIds
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse initAnsibleStep3(InitAnsibleRequest request);
    
    /**
     * Init Ansible Step 4: Ping nodes
     * @param request InitAnsibleRequest chứa controllerHost và serverIds
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse initAnsibleStep4(InitAnsibleRequest request);
    
    /**
     * Lấy trạng thái thực thi của một task init Ansible
     * @param taskId Task ID được trả về khi bắt đầu bước init
     * @return Trạng thái task bao gồm logs realtime
     */
    AnsibleTaskStatusResponse getInitTaskStatus(String taskId);
    
    /**
     * Lấy trạng thái thực thi của playbook
     * @param taskId Task ID nhận được khi bắt đầu thực thi playbook
     * @return Trạng thái task bao gồm logs realtime
     */
    AnsibleTaskStatusResponse getPlaybookTaskStatus(String taskId);
    
    // ==================== Config Ansible ====================
    
    /**
     * Lưu cấu hình Ansible
     * @param request SaveAnsibleConfigRequest chứa controllerHost, sudoPassword, và config content
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse saveAnsibleConfig(SaveAnsibleConfigRequest request);
    
    /**
     * Verify cấu hình Ansible
     * @param request VerifyAnsibleConfigRequest chứa controllerHost và config content
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse verifyAnsibleConfig(VerifyAnsibleConfigRequest request);
    
    /**
     * Đọc cấu hình Ansible từ server
     * @param controllerHost IP address của controller (optional)
     * @return AnsibleConfigResponse chứa nội dung các file cấu hình
     */
    my_spring_app.my_spring_app.dto.reponse.AnsibleConfigResponse getAnsibleConfig(String controllerHost);
    
    // ==================== Playbook ====================
    
    /**
     * Lấy danh sách playbooks
     * @param controllerHost IP address của controller server (optional)
     * @return PlaybookListResponse chứa danh sách playbooks
     */
    PlaybookListResponse getPlaybooks(String controllerHost);
    
    /**
     * Lưu playbook
     * @param request SavePlaybookRequest chứa controllerHost, sudoPassword, filename, và content
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse savePlaybook(SavePlaybookRequest request);
    
    /**
     * Upload một file playbook từ client
     * @param file nội dung file
     * @param controllerHost IP controller
     * @param sudoPassword sudo password (optional)
     * @return AnsibleOperationResponse với kết quả upload
     */
    AnsibleOperationResponse uploadPlaybook(MultipartFile file, String controllerHost, String sudoPassword);
    
    /**
     * Xóa playbook
     * @param request DeletePlaybookRequest chứa controllerHost, sudoPassword, và filename
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse deletePlaybook(DeletePlaybookRequest request);
    
    /**
     * Thực thi playbook
     * @param request ExecutePlaybookRequest chứa controllerHost, sudoPassword, filename, và extraVars
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse executePlaybook(ExecutePlaybookRequest request);
    
    // ==================== Install K8s ====================
    
    /**
     * Install K8s Tab 1: Chuẩn bị môi trường
     * @param request InstallK8sRequest chứa controllerHost, sudoPassword, và các thông số K8s
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse installK8sTab1(InstallK8sRequest request);
    
    /**
     * Install K8s Tab 2: Cài đặt K8s components
     * @param request InstallK8sRequest chứa controllerHost, sudoPassword, và các thông số K8s
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse installK8sTab2(InstallK8sRequest request);
    
    /**
     * Install K8s Tab 3: Join worker nodes
     * @param request InstallK8sRequest chứa controllerHost, sudoPassword, masterNodeIp, và workerNodeIps
     * @return AnsibleOperationResponse với taskId và message
     */
    AnsibleOperationResponse installK8sTab3(InstallK8sRequest request);
}
