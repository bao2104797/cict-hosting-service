@PostMapping("/setup-ansible")
public ResponseEntity<List<String>> setupAnsibleOnK8sNodes() {
    List<String> logs = serverService.setupAnsibleOnK8sNodes();
    return ResponseEntity.ok(logs);
}

@PostMapping("/install-kubernetes-kubespray")
public ResponseEntity<List<String>> installKubernetesWithKubespray() {
    List<String> logs = serverService.installKubernetesWithKubespray();
    return ResponseEntity.ok(logs);
}

@PostMapping("/install-k8s-addons")
public ResponseEntity<List<String>> installK8sAddons() {
    List<String> logs = serverService.installK8sAddons();
    return ResponseEntity.ok(logs);
}

@PostMapping("/install-metrics-server")
public ResponseEntity<List<String>> installMetricsServer() {
    List<String> logs = serverService.installMetricsServer();
    return ResponseEntity.ok(logs);
}

@PostMapping("/install-docker")
public ResponseEntity<List<String>> installDocker() {
    List<String> logs = serverService.installDocker();
    return ResponseEntity.ok(logs);
}