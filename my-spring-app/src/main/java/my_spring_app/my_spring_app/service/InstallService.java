package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.InstallStatusResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleConfigResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleOperationResponse;
import my_spring_app.my_spring_app.dto.reponse.DockerStatusResponse;
import my_spring_app.my_spring_app.dto.request.SaveAnsibleConfigRequest;

public interface InstallService {
    // Methods cũ (backward compatibility)
    java.util.List<String> setupAnsibleOnK8sNodes();
    java.util.List<String> uninstallAnsibleFromK8sNodes();
    java.util.List<String> installKubernetesWithKubespray();
    java.util.List<String> uninstallKubernetesFromK8sNodes();
    java.util.List<String> installK8sAddons();
    java.util.List<String> uninstallK8sAddons();
    java.util.List<String> installMetricsServer();
    java.util.List<String> uninstallMetricsServer();
    java.util.List<String> installDocker();
    java.util.List<String> uninstallDocker();
    
    // Methods mới với taskId để hỗ trợ polling
    void setupAnsibleOnK8sNodes(String taskId);
    void uninstallAnsibleFromK8sNodes(String taskId);
    void installKubernetesWithKubespray(String taskId);
    void uninstallKubernetesFromK8sNodes(String taskId);
    void installK8sAddons(String taskId);
    void uninstallK8sAddons(String taskId);
    void installMetricsServer(String taskId);
    void uninstallMetricsServer(String taskId);
    void installDocker(String taskId);
    void uninstallDocker(String taskId);
    
    // Method để poll status
    InstallStatusResponse getInstallStatus(String taskId);
    
    // Methods để xem và chỉnh sửa cấu hình Ansible
    /**
     * Lấy nội dung các file cấu hình Ansible từ ~/ansible-k8s/
     * @return AnsibleConfigResponse chứa nội dung ansible.cfg, hosts.ini, và group_vars/all.yml
     */
    AnsibleConfigResponse getAnsibleConfig();
    
    /**
     * Lưu nội dung các file cấu hình Ansible vào ~/ansible-k8s/
     * @param request SaveAnsibleConfigRequest chứa nội dung các file và sudo password (nếu cần)
     * @return AnsibleOperationResponse với kết quả
     */
    AnsibleOperationResponse saveAnsibleConfig(SaveAnsibleConfigRequest request);

    /**
     * Tạo lại ansible.cfg, hosts.ini và group_vars/all.yml (nếu có) dựa trên danh sách MASTER/WORKER hiện tại.
     * @return AnsibleOperationResponse với kết quả
     */
    AnsibleOperationResponse regenerateAnsibleConfig();

    // Docker status
    /**
     * Kiểm tra trạng thái Docker trên server có role=DOCKER.
     * @return DockerStatusResponse chứa thông tin installed, version, dockerHost, dockerRole, error
     */
    DockerStatusResponse getDockerStatus();
}

