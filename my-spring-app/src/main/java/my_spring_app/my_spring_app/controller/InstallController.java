package my_spring_app.my_spring_app.controller;

import my_spring_app.my_spring_app.dto.reponse.InstallStatusResponse;
import my_spring_app.my_spring_app.dto.reponse.InstallTaskResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleConfigResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleOperationResponse;
import my_spring_app.my_spring_app.dto.reponse.DockerStatusResponse;
import my_spring_app.my_spring_app.dto.request.SaveAnsibleConfigRequest;
import my_spring_app.my_spring_app.service.InstallService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/install")
public class InstallController {

    private final InstallService installService;

    public InstallController(InstallService installService) {
        this.installService = installService;
    }

    /**
     * Endpoint để poll status của install task
     */
    @GetMapping("/status/{taskId}")
    public ResponseEntity<InstallStatusResponse> getInstallStatus(@PathVariable String taskId) {
        InstallStatusResponse response = installService.getInstallStatus(taskId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/setup-ansible")
    public ResponseEntity<InstallTaskResponse> setupAnsibleOnK8sNodes() {
        String taskId = UUID.randomUUID().toString();
        // Chạy async
        CompletableFuture.runAsync(() -> {
            installService.setupAnsibleOnK8sNodes(taskId);
        });
        InstallTaskResponse response = new InstallTaskResponse(taskId, "running", "Đã bắt đầu cài đặt Ansible");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/uninstall-ansible")
    public ResponseEntity<InstallTaskResponse> uninstallAnsibleFromK8sNodes() {
        String taskId = UUID.randomUUID().toString();
        // Chạy async
        CompletableFuture.runAsync(() -> {
            installService.uninstallAnsibleFromK8sNodes(taskId);
        });
        InstallTaskResponse response = new InstallTaskResponse(taskId, "running", "Đã bắt đầu gỡ cài đặt Ansible");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/install-kubernetes-kubespray")
    public ResponseEntity<InstallTaskResponse> installKubernetesWithKubespray() {
        String taskId = UUID.randomUUID().toString();
        CompletableFuture.runAsync(() -> {
            installService.installKubernetesWithKubespray(taskId);
        });
        InstallTaskResponse response = new InstallTaskResponse(taskId, "running", "Đã bắt đầu cài đặt Kubernetes");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/uninstall-kubernetes-kubespray")
    public ResponseEntity<InstallTaskResponse> uninstallKubernetesFromK8sNodes() {
        String taskId = UUID.randomUUID().toString();
        CompletableFuture.runAsync(() -> {
            installService.uninstallKubernetesFromK8sNodes(taskId);
        });
        InstallTaskResponse response = new InstallTaskResponse(taskId, "running", "Đã bắt đầu gỡ cài đặt Kubernetes");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/install-k8s-addons")
    public ResponseEntity<InstallTaskResponse> installK8sAddons() {
        String taskId = UUID.randomUUID().toString();
        CompletableFuture.runAsync(() -> {
            installService.installK8sAddons(taskId);
        });
        InstallTaskResponse response = new InstallTaskResponse(taskId, "running", "Đã bắt đầu cài đặt K8s Addons");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/uninstall-k8s-addons")
    public ResponseEntity<InstallTaskResponse> uninstallK8sAddons() {
        String taskId = UUID.randomUUID().toString();
        CompletableFuture.runAsync(() -> {
            installService.uninstallK8sAddons(taskId);
        });
        InstallTaskResponse response = new InstallTaskResponse(taskId, "running", "Đã bắt đầu gỡ cài đặt K8s Addons");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/install-metrics-server")
    public ResponseEntity<InstallTaskResponse> installMetricsServer() {
        String taskId = UUID.randomUUID().toString();
        CompletableFuture.runAsync(() -> {
            installService.installMetricsServer(taskId);
        });
        InstallTaskResponse response = new InstallTaskResponse(taskId, "running", "Đã bắt đầu cài đặt Metrics Server");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/uninstall-metrics-server")
    public ResponseEntity<InstallTaskResponse> uninstallMetricsServer() {
        String taskId = UUID.randomUUID().toString();
        CompletableFuture.runAsync(() -> {
            installService.uninstallMetricsServer(taskId);
        });
        InstallTaskResponse response = new InstallTaskResponse(taskId, "running", "Đã bắt đầu gỡ cài đặt Metrics Server");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/install-docker")
    public ResponseEntity<InstallTaskResponse> installDocker() {
        String taskId = UUID.randomUUID().toString();
        CompletableFuture.runAsync(() -> {
            installService.installDocker(taskId);
        });
        InstallTaskResponse response = new InstallTaskResponse(taskId, "running", "Đã bắt đầu cài đặt Docker");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/uninstall-docker")
    public ResponseEntity<InstallTaskResponse> uninstallDocker() {
        String taskId = UUID.randomUUID().toString();
        CompletableFuture.runAsync(() -> {
            installService.uninstallDocker(taskId);
        });
        InstallTaskResponse response = new InstallTaskResponse(taskId, "running", "Đã bắt đầu gỡ cài đặt Docker");
        return ResponseEntity.ok(response);
    }

    /**
     * Kiểm tra trạng thái Docker trên server có role=DOCKER.
     */
    @GetMapping("/docker/status")
    public ResponseEntity<DockerStatusResponse> getDockerStatus() {
        DockerStatusResponse response = installService.getDockerStatus();
        return ResponseEntity.ok(response);
    }

    // ==================== Ansible Config ====================

    /**
     * Lấy nội dung các file cấu hình Ansible từ ~/ansible-k8s/
     * @return AnsibleConfigResponse chứa nội dung ansible.cfg, hosts.ini, và group_vars/all.yml
     */
    @GetMapping("/ansible/config")
    public ResponseEntity<AnsibleConfigResponse> getAnsibleConfig() {
        AnsibleConfigResponse response = installService.getAnsibleConfig();
        return ResponseEntity.ok(response);
    }

    /**
     * Lưu nội dung các file cấu hình Ansible vào ~/ansible-k8s/
     * @param request SaveAnsibleConfigRequest chứa nội dung các file và sudo password (nếu cần)
     * @return AnsibleOperationResponse với kết quả
     */
    @PostMapping("/ansible/config")
    public ResponseEntity<AnsibleOperationResponse> saveAnsibleConfig(@org.springframework.web.bind.annotation.RequestBody SaveAnsibleConfigRequest request) {
        AnsibleOperationResponse response = installService.saveAnsibleConfig(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Tạo lại ansible.cfg và hosts.ini dựa trên danh sách MASTER/WORKER hiện tại
     */
    @PostMapping("/ansible/config/regenerate")
    public ResponseEntity<AnsibleOperationResponse> regenerateAnsibleConfig() {
        AnsibleOperationResponse response = installService.regenerateAnsibleConfig();
        return ResponseEntity.ok(response);
    }
}

