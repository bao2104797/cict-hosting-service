package my_spring_app.my_spring_app.controller;

import my_spring_app.my_spring_app.service.InstallService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/install")
public class InstallController {

    private final InstallService installService;

    public InstallController(InstallService installService) {
        this.installService = installService;
    }

    @PostMapping("/setup-ansible")
    public ResponseEntity<List<String>> setupAnsibleOnK8sNodes() {
        List<String> logs = installService.setupAnsibleOnK8sNodes();
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/uninstall-ansible")
    public ResponseEntity<List<String>> uninstallAnsibleFromK8sNodes() {
        List<String> logs = installService.uninstallAnsibleFromK8sNodes();
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/install-kubernetes-kubespray")
    public ResponseEntity<List<String>> installKubernetesWithKubespray() {
        List<String> logs = installService.installKubernetesWithKubespray();
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/uninstall-kubernetes-kubespray")
    public ResponseEntity<List<String>> uninstallKubernetesFromK8sNodes() {
        List<String> logs = installService.uninstallKubernetesFromK8sNodes();
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/install-k8s-addons")
    public ResponseEntity<List<String>> installK8sAddons() {
        List<String> logs = installService.installK8sAddons();
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/uninstall-k8s-addons")
    public ResponseEntity<List<String>> uninstallK8sAddons() {
        List<String> logs = installService.uninstallK8sAddons();
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/install-metrics-server")
    public ResponseEntity<List<String>> installMetricsServer() {
        List<String> logs = installService.installMetricsServer();
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/uninstall-metrics-server")
    public ResponseEntity<List<String>> uninstallMetricsServer() {
        List<String> logs = installService.uninstallMetricsServer();
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/install-docker")
    public ResponseEntity<List<String>> installDocker() {
        List<String> logs = installService.installDocker();
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/uninstall-docker")
    public ResponseEntity<List<String>> uninstallDocker() {
        List<String> logs = installService.uninstallDocker();
        return ResponseEntity.ok(logs);
    }
}

