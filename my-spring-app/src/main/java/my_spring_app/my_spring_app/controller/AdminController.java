package my_spring_app.my_spring_app.controller;

import my_spring_app.my_spring_app.dto.reponse.AdminOverviewResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminProjectResourceDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminUserProjectListResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminUserProjectSummaryResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminUserUsageResponse;
import my_spring_app.my_spring_app.dto.reponse.ClusterCapacityResponse;
import my_spring_app.my_spring_app.dto.reponse.ClusterAllocatableResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminDatabaseDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminBackendDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminFrontendDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.DashboardMetricsResponse;
import my_spring_app.my_spring_app.dto.reponse.NodeListResponse;
import my_spring_app.my_spring_app.dto.reponse.NodeResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceListResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.DeploymentListResponse;
import my_spring_app.my_spring_app.dto.reponse.DeploymentResponse;
import my_spring_app.my_spring_app.dto.reponse.DeploymentDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.PodListResponse;
import my_spring_app.my_spring_app.dto.reponse.PodResponse;
import my_spring_app.my_spring_app.dto.reponse.PodDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetListResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceListResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.IngressListResponse;
import my_spring_app.my_spring_app.dto.reponse.IngressResponse;
import my_spring_app.my_spring_app.dto.reponse.IngressDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.PVCListResponse;
import my_spring_app.my_spring_app.dto.reponse.PVCResponse;
import my_spring_app.my_spring_app.dto.reponse.PVCDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.PVListResponse;
import my_spring_app.my_spring_app.dto.reponse.PVResponse;
import my_spring_app.my_spring_app.dto.reponse.PVDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleStatusResponse;
import my_spring_app.my_spring_app.dto.reponse.ClusterInfoResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleConfigResponse;
import my_spring_app.my_spring_app.dto.reponse.ServerAuthStatusResponse;
import my_spring_app.my_spring_app.dto.reponse.AnsibleOperationResponse;
import my_spring_app.my_spring_app.dto.reponse.PlaybookListResponse;
import my_spring_app.my_spring_app.dto.request.InstallAnsibleRequest;
import my_spring_app.my_spring_app.dto.request.InitAnsibleRequest;
import my_spring_app.my_spring_app.dto.request.SaveAnsibleConfigRequest;
import my_spring_app.my_spring_app.dto.request.VerifyAnsibleConfigRequest;
import my_spring_app.my_spring_app.dto.request.SavePlaybookRequest;
import my_spring_app.my_spring_app.dto.request.DeletePlaybookRequest;
import my_spring_app.my_spring_app.dto.request.ExecutePlaybookRequest;
import my_spring_app.my_spring_app.dto.request.InstallK8sRequest;
import my_spring_app.my_spring_app.dto.request.NamespaceRequest;
import my_spring_app.my_spring_app.dto.request.ScaleRequest;
import my_spring_app.my_spring_app.dto.request.IngressRequest;
import my_spring_app.my_spring_app.dto.request.DeploymentRequest;
import my_spring_app.my_spring_app.dto.request.PodRequest;
import my_spring_app.my_spring_app.dto.request.StatefulsetRequest;
import my_spring_app.my_spring_app.dto.request.ServiceRequest;
import my_spring_app.my_spring_app.dto.request.PVCRequest;
import my_spring_app.my_spring_app.dto.request.PVRequest;
import my_spring_app.my_spring_app.service.AdminService;
import my_spring_app.my_spring_app.service.AnsibleService;
import my_spring_app.my_spring_app.service.ServerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @Autowired
    private AnsibleService ansibleService;
    
    @Autowired
    private ServerService serverService;

    // User Services - Services
    // Cluster & Overview - Overview
    @GetMapping("/user-services/overview")
    public ResponseEntity<AdminOverviewResponse> getOverview() {
        AdminOverviewResponse response = adminService.getOverview();
        return ResponseEntity.ok(response);
    }

    // User Services - Services
    @GetMapping("/user-services/users")
    public ResponseEntity<AdminUserUsageResponse> getUserUsage() {
        AdminUserUsageResponse response = adminService.getUserResourceOverview();
        return ResponseEntity.ok(response);
    }

    // User Services - Services
    @GetMapping("/user-services/user-summary")
    public ResponseEntity<AdminUserProjectSummaryResponse> getUserSummary(@RequestParam Long userId) {
        AdminUserProjectSummaryResponse response = adminService.getUserProjectSummary(userId);
        return ResponseEntity.ok(response);
    }

    // User Services - Services
    @GetMapping("/user-services/user-projects")
    public ResponseEntity<AdminUserProjectListResponse> getUserProjects(@RequestParam Long userId) {
        AdminUserProjectListResponse response = adminService.getUserProjectsDetail(userId);
        return ResponseEntity.ok(response);
    }

    // User Services - Services
    @GetMapping("/user-services/project-resources")
    public ResponseEntity<AdminProjectResourceDetailResponse> getProjectResources(@RequestParam Long projectId) {
        AdminProjectResourceDetailResponse response = adminService.getProjectResourceDetail(projectId);
        return ResponseEntity.ok(response);
    }

    // Cluster Services - Services
    // Cluster & Overview - Overview
    @GetMapping("/cluster/capacity")
    public ResponseEntity<ClusterCapacityResponse> getClusterCapacity() {
        ClusterCapacityResponse response = adminService.getClusterCapacity();
        return ResponseEntity.ok(response);
    }

    // Cluster Services - Services
    // Cluster & Overview - Overview
    @GetMapping("/cluster/allocatable")
    public ResponseEntity<ClusterAllocatableResponse> getClusterAllocatable() {
        ClusterAllocatableResponse response = adminService.getClusterAllocatable();
        return ResponseEntity.ok(response);
    }

    // Infrastructure - Cluster Info
    @GetMapping("/cluster/info")
    public ResponseEntity<ClusterInfoResponse> getClusterInfo() {
        ClusterInfoResponse response = adminService.getClusterInfo();
        return ResponseEntity.ok(response);
    }

    // User Services - Services
    @GetMapping("/database/detail")
    public ResponseEntity<AdminDatabaseDetailResponse> getDatabaseDetail(@RequestParam Long databaseId) {
        AdminDatabaseDetailResponse response = adminService.getDatabaseDetail(databaseId);
        return ResponseEntity.ok(response);
    }

    // User Services - Services
    @GetMapping("/backend/detail")
    public ResponseEntity<AdminBackendDetailResponse> getBackendDetail(@RequestParam Long backendId) {
        AdminBackendDetailResponse response = adminService.getBackendDetail(backendId);
        return ResponseEntity.ok(response);
    }

    // User Services - Services
    @GetMapping("/frontend/detail")
    public ResponseEntity<AdminFrontendDetailResponse> getFrontendDetail(@RequestParam Long frontendId) {
        AdminFrontendDetailResponse response = adminService.getFrontendDetail(frontendId);
        return ResponseEntity.ok(response);
    }

    // Cluster & Overview - Overview
    @GetMapping("/dashboard/metrics")
    public ResponseEntity<DashboardMetricsResponse> getDashboardMetrics() {
        DashboardMetricsResponse response = adminService.getDashboardMetrics();
        return ResponseEntity.ok(response);
    }

    // Cluster & Overview  - Nodes
    @GetMapping("/cluster/nodes")
    public ResponseEntity<NodeListResponse> getNodes() {
        NodeListResponse response = adminService.getNodes();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/cluster/nodes/{name}")
    public ResponseEntity<NodeResponse> getNode(@PathVariable String name) {
        NodeResponse response = adminService.getNode(name);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/cluster/nodes/join/{serverId}")
    public ResponseEntity<?> joinNodeToK8s(@PathVariable Long serverId) {
        try {
            adminService.joinNodeToK8s(serverId);
            return ResponseEntity.ok(Map.of("message", "Đã join node vào K8s cluster thành công"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "JOIN_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi join node: " + e.getMessage()));
        }
    }

    @DeleteMapping("/cluster/nodes/{nodeName}")
    public ResponseEntity<?> removeNodeFromK8s(@PathVariable String nodeName, @RequestParam(required = false) String ip) {
        try {
            adminService.removeNodeFromK8s(nodeName, ip);
            return ResponseEntity.ok(Map.of("message", "Đã xóa node khỏi K8s cluster thành công"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "REMOVE_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi xóa node: " + e.getMessage()));
        }
    }

    // Cluster & Overview  - Namespaces
    @GetMapping("/cluster/namespaces")
    public ResponseEntity<NamespaceListResponse> getNamespaces() {
        NamespaceListResponse response = adminService.getNamespaces();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/cluster/namespaces/{name}")
    public ResponseEntity<NamespaceDetailResponse> getNamespace(@PathVariable String name) {
        NamespaceDetailResponse response = adminService.getNamespace(name);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/cluster/namespaces")
    public ResponseEntity<NamespaceResponse> createNamespace(@Valid @RequestBody NamespaceRequest request) {
        NamespaceResponse response = adminService.createNamespace(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/cluster/namespaces/yaml")
    public ResponseEntity<NamespaceResponse> createNamespaceFromYaml(@RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        NamespaceResponse response = adminService.createNamespaceFromYaml(yaml);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/cluster/namespaces/{name}/yaml")
    public ResponseEntity<NamespaceResponse> updateNamespaceFromYaml(
            @PathVariable String name,
            @RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        NamespaceResponse response = adminService.updateNamespaceFromYaml(name, yaml);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/cluster/namespaces/{name}")
    public ResponseEntity<Void> deleteNamespace(@PathVariable String name) {
        adminService.deleteNamespace(name);
        return ResponseEntity.noContent().build();
    }

    // Workloads - Deployments
    @GetMapping("/workloads/deployments")
    public ResponseEntity<DeploymentListResponse> getDeployments() {
        DeploymentListResponse response = adminService.getDeployments();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/workloads/deployments/{namespace}/{name}")
    public ResponseEntity<DeploymentResponse> getDeployment(@PathVariable String namespace,
            @PathVariable String name) {
        DeploymentResponse response = adminService.getDeployment(namespace, name);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/workloads/deployments/{namespace}/{name}/detail")
    public ResponseEntity<DeploymentDetailResponse> getDeploymentDetail(
            @PathVariable String namespace, @PathVariable String name) {
        DeploymentDetailResponse response = adminService.getDeploymentDetail(namespace, name);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/workloads/deployments")
    public ResponseEntity<DeploymentResponse> createDeployment(@Valid @RequestBody DeploymentRequest request) {
        DeploymentResponse response = adminService.createDeployment(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/workloads/deployments/yaml")
    public ResponseEntity<DeploymentResponse> createDeploymentFromYaml(@RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        DeploymentResponse response = adminService.createDeploymentFromYaml(yaml);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/workloads/deployments/{namespace}/{name}/scale")
    public ResponseEntity<DeploymentResponse> scaleDeployment(@PathVariable String namespace,
            @PathVariable String name, @Valid @RequestBody ScaleRequest request) {
        DeploymentResponse response = adminService.scaleDeployment(namespace, name, request.getReplicas());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/workloads/deployments/{namespace}/{name}/yaml")
    public ResponseEntity<DeploymentResponse> updateDeploymentFromYaml(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        DeploymentResponse response = adminService.updateDeploymentFromYaml(namespace, name, yaml);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/workloads/deployments/{namespace}/{name}")
    public ResponseEntity<Void> deleteDeployment(@PathVariable String namespace, @PathVariable String name) {
        adminService.deleteDeployment(namespace, name);
        return ResponseEntity.noContent().build();
    }

    // Workloads - Pods
    @GetMapping("/workloads/pods")
    public ResponseEntity<PodListResponse> getPods() {
        PodListResponse response = adminService.getPods();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/workloads/pods/{namespace}/{name}")
    public ResponseEntity<PodResponse> getPod(@PathVariable String namespace, @PathVariable String name) {
        PodResponse response = adminService.getPod(namespace, name);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/workloads/pods/{namespace}/{name}/detail")
    public ResponseEntity<PodDetailResponse> getPodDetail(@PathVariable String namespace, @PathVariable String name) {
        PodDetailResponse response = adminService.getPodDetail(namespace, name);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/workloads/pods")
    public ResponseEntity<PodResponse> createPod(@Valid @RequestBody PodRequest request) {
        PodResponse response = adminService.createPod(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/workloads/pods/yaml")
    public ResponseEntity<PodResponse> createPodFromYaml(@RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        PodResponse response = adminService.createPodFromYaml(yaml);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/workloads/pods/{namespace}/{name}/logs")
    public ResponseEntity<Map<String, String>> getPodLogs(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestParam(required = false) String container) {
        String logs = adminService.getPodLogs(namespace, name, container);
        Map<String, String> response = new HashMap<>();
        response.put("logs", logs);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/workloads/pods/{namespace}/{name}/exec")
    public ResponseEntity<Map<String, String>> execPodCommand(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestParam(required = false) String container,
            @RequestBody Map<String, String> request) {
        String command = request.get("command");
        if (command == null || command.trim().isEmpty()) {
            command = "/bin/sh";
        }
        String output = adminService.execPodCommand(namespace, name, container, command);
        Map<String, String> response = new HashMap<>();
        response.put("output", output);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/workloads/pods/{namespace}/{name}/yaml")
    public ResponseEntity<PodResponse> updatePodFromYaml(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        PodResponse response = adminService.updatePodFromYaml(namespace, name, yaml);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/workloads/pods/{namespace}/{name}")
    public ResponseEntity<Void> deletePod(@PathVariable String namespace, @PathVariable String name) {
        adminService.deletePod(namespace, name);
        return ResponseEntity.noContent().build();
    }

    // Workloads - Statefulsets
    @GetMapping("/workloads/statefulsets")
    public ResponseEntity<StatefulsetListResponse> getStatefulsets() {
        StatefulsetListResponse response = adminService.getStatefulsets();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/workloads/statefulsets/{namespace}/{name}")
    public ResponseEntity<StatefulsetResponse> getStatefulset(@PathVariable String namespace,
            @PathVariable String name) {
        StatefulsetResponse response = adminService.getStatefulset(namespace, name);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/workloads/statefulsets/{namespace}/{name}/detail")
    public ResponseEntity<StatefulsetDetailResponse> getStatefulsetDetail(
            @PathVariable String namespace, @PathVariable String name) {
        StatefulsetDetailResponse response = adminService.getStatefulsetDetail(namespace, name);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/workloads/statefulsets")
    public ResponseEntity<StatefulsetResponse> createStatefulset(@Valid @RequestBody StatefulsetRequest request) {
        StatefulsetResponse response = adminService.createStatefulset(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/workloads/statefulsets/yaml")
    public ResponseEntity<StatefulsetResponse> createStatefulsetFromYaml(@RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        StatefulsetResponse response = adminService.createStatefulsetFromYaml(yaml);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/workloads/statefulsets/{namespace}/{name}/scale")
    public ResponseEntity<StatefulsetResponse> scaleStatefulset(@PathVariable String namespace,
            @PathVariable String name, @Valid @RequestBody ScaleRequest request) {
        StatefulsetResponse response = adminService.scaleStatefulset(namespace, name, request.getReplicas());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/workloads/statefulsets/{namespace}/{name}/yaml")
    public ResponseEntity<StatefulsetResponse> updateStatefulsetFromYaml(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        StatefulsetResponse response = adminService.updateStatefulsetFromYaml(namespace, name, yaml);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/workloads/statefulsets/{namespace}/{name}")
    public ResponseEntity<Void> deleteStatefulset(@PathVariable String namespace, @PathVariable String name) {
        adminService.deleteStatefulset(namespace, name);
        return ResponseEntity.noContent().build();
    }

    // Service Discovery - Services
    @GetMapping("/services")
    public ResponseEntity<ServiceListResponse> getServices() {
        ServiceListResponse response = adminService.getServices();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/services/{namespace}/{name}")
    public ResponseEntity<ServiceResponse> getService(
            @PathVariable String namespace, @PathVariable String name) {
        ServiceResponse response = adminService.getService(namespace, name);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/services/{namespace}/{name}/detail")
    public ResponseEntity<ServiceDetailResponse> getServiceDetail(
            @PathVariable String namespace, @PathVariable String name) {
        ServiceDetailResponse response = adminService.getServiceDetail(namespace, name);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/services")
    public ResponseEntity<ServiceResponse> createService(@Valid @RequestBody ServiceRequest request) {
        ServiceResponse response = adminService.createService(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/services/yaml")
    public ResponseEntity<ServiceResponse> createServiceFromYaml(@RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        ServiceResponse response = adminService.createServiceFromYaml(yaml);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/services/{namespace}/{name}/yaml")
    public ResponseEntity<ServiceResponse> updateServiceFromYaml(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        ServiceResponse response = adminService.updateServiceFromYaml(namespace, name, yaml);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/services/{namespace}/{name}")
    public ResponseEntity<Void> deleteService(@PathVariable String namespace, @PathVariable String name) {
        adminService.deleteService(namespace, name);
        return ResponseEntity.noContent().build();
    }

    // Service Discovery - Ingress
    @GetMapping("/ingress")
    public ResponseEntity<IngressListResponse> getIngress() {
        IngressListResponse response = adminService.getIngress();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/ingress/{namespace}/{name}")
    public ResponseEntity<IngressResponse> getIngress(
            @PathVariable String namespace,
            @PathVariable String name) {
        IngressResponse response = adminService.getIngress(namespace, name);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/ingress/{namespace}/{name}/detail")
    public ResponseEntity<IngressDetailResponse> getIngressDetail(
            @PathVariable String namespace,
            @PathVariable String name) {
        IngressDetailResponse response = adminService.getIngressDetail(namespace, name);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/ingress")
    public ResponseEntity<IngressResponse> createIngress(@Valid @RequestBody IngressRequest request) {
        IngressResponse response = adminService.createIngress(request);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/ingress/{namespace}/{name}")
    public ResponseEntity<IngressResponse> updateIngress(
            @PathVariable String namespace,
            @PathVariable String name,
            @Valid @RequestBody IngressRequest request) {
        IngressResponse response = adminService.updateIngress(namespace, name, request);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/ingress/{namespace}/{name}/yaml")
    public ResponseEntity<IngressResponse> updateIngressFromYaml(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        IngressResponse response = adminService.updateIngressFromYaml(namespace, name, yaml);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/ingress/{namespace}/{name}")
    public ResponseEntity<Void> deleteIngress(@PathVariable String namespace, @PathVariable String name) {
        adminService.deleteIngress(namespace, name);
        return ResponseEntity.noContent().build();
    }

    // Storage - PVCs
    @GetMapping("/storage/pvcs")
    public ResponseEntity<PVCListResponse> getPVCs() {
        PVCListResponse response = adminService.getPVCs();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/storage/pvcs/{namespace}/{name}")
    public ResponseEntity<PVCResponse> getPVC(
            @PathVariable String namespace,
            @PathVariable String name) {
        PVCResponse response = adminService.getPVC(namespace, name);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/storage/pvcs/{namespace}/{name}/detail")
    public ResponseEntity<PVCDetailResponse> getPVCDetail(
            @PathVariable String namespace,
            @PathVariable String name) {
        PVCDetailResponse response = adminService.getPVCDetail(namespace, name);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/storage/pvcs/{namespace}/{name}/yaml")
    public ResponseEntity<PVCResponse> updatePVCFromYaml(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        PVCResponse response = adminService.updatePVCFromYaml(namespace, name, yaml);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/storage/pvcs")
    public ResponseEntity<PVCResponse> createPVC(@Valid @RequestBody PVCRequest request) {
        PVCResponse response = adminService.createPVC(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/storage/pvcs/yaml")
    public ResponseEntity<PVCResponse> createPVCFromYaml(
            @RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        PVCResponse response = adminService.createPVCFromYaml(yaml);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/storage/pvcs/{namespace}/{name}")
    public ResponseEntity<Void> deletePVC(@PathVariable String namespace, @PathVariable String name) {
        adminService.deletePVC(namespace, name);
        return ResponseEntity.noContent().build();
    }

    // Storage - PVs
    @GetMapping("/storage/pvs")
    public ResponseEntity<PVListResponse> getPVs() {
        PVListResponse response = adminService.getPVs();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/storage/pvs/{name}")
    public ResponseEntity<PVResponse> getPV(@PathVariable String name) {
        PVResponse response = adminService.getPV(name);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/storage/pvs/{name}/detail")
    public ResponseEntity<PVDetailResponse> getPVDetail(@PathVariable String name) {
        PVDetailResponse response = adminService.getPVDetail(name);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/storage/pvs/{name}/yaml")
    public ResponseEntity<PVResponse> updatePVFromYaml(
            @PathVariable String name,
            @RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        PVResponse response = adminService.updatePVFromYaml(name, yaml);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/storage/pvs")
    public ResponseEntity<PVResponse> createPV(@Valid @RequestBody PVRequest request) {
        PVResponse response = adminService.createPV(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/storage/pvs/yaml")
    public ResponseEntity<PVResponse> createPVFromYaml(@RequestBody Map<String, String> request) {
        String yaml = request.get("yamlContent");
        PVResponse response = adminService.createPVFromYaml(yaml);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/storage/pvs/{name}")
    public ResponseEntity<Void> deletePV(@PathVariable String name) {
        adminService.deletePV(name);
        return ResponseEntity.noContent().build();
    }

    // Infrastructure - Ansible Status
    @GetMapping("/ansible/status")
    public ResponseEntity<AnsibleStatusResponse> getAnsibleStatus() {
        try {
            AnsibleStatusResponse response = ansibleService.getAnsibleStatus();
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            // Trả về response với error nếu có exception
            AnsibleStatusResponse errorResponse = new AnsibleStatusResponse();
            errorResponse.setInstalled(false);
            errorResponse.setError("Lỗi khi kiểm tra trạng thái Ansible: " + e.getMessage());
            return ResponseEntity.ok(errorResponse);
        }
    }
    
    // Infrastructure - Server Auth Status
    @GetMapping("/server/auth-status")
    public ResponseEntity<ServerAuthStatusResponse> getServerAuthStatus(@RequestParam Long serverId) {
        ServerAuthStatusResponse response = serverService.checkServerAuthStatus(serverId);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Install Ansible
    @PostMapping("/ansible/install")
    public ResponseEntity<AnsibleOperationResponse> installAnsible(@Valid @RequestBody InstallAnsibleRequest request) {
        AnsibleOperationResponse response = ansibleService.installAnsible(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Reinstall Ansible
    @PostMapping("/ansible/reinstall")
    public ResponseEntity<AnsibleOperationResponse> reinstallAnsible(@Valid @RequestBody InstallAnsibleRequest request) {
        AnsibleOperationResponse response = ansibleService.reinstallAnsible(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Uninstall Ansible
    @PostMapping("/ansible/uninstall")
    public ResponseEntity<AnsibleOperationResponse> uninstallAnsible(@Valid @RequestBody InstallAnsibleRequest request) {
        AnsibleOperationResponse response = ansibleService.uninstallAnsible(request);
        return ResponseEntity.ok(response);
    }
    
    // ==================== Init Ansible (4 steps) ====================
    
    // Infrastructure - Init Ansible Step 1
    @PostMapping("/ansible/init/step1")
    public ResponseEntity<AnsibleOperationResponse> initAnsibleStep1(@Valid @RequestBody InitAnsibleRequest request) {
        AnsibleOperationResponse response = ansibleService.initAnsibleStep1(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Init Ansible Step 2
    @PostMapping("/ansible/init/step2")
    public ResponseEntity<AnsibleOperationResponse> initAnsibleStep2(@Valid @RequestBody InitAnsibleRequest request) {
        AnsibleOperationResponse response = ansibleService.initAnsibleStep2(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Init Ansible Step 3
    @PostMapping("/ansible/init/step3")
    public ResponseEntity<AnsibleOperationResponse> initAnsibleStep3(@Valid @RequestBody InitAnsibleRequest request) {
        AnsibleOperationResponse response = ansibleService.initAnsibleStep3(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Init Ansible Step 4
    @PostMapping("/ansible/init/step4")
    public ResponseEntity<AnsibleOperationResponse> initAnsibleStep4(@Valid @RequestBody InitAnsibleRequest request) {
        AnsibleOperationResponse response = ansibleService.initAnsibleStep4(request);
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/ansible/init/status")
    public ResponseEntity<my_spring_app.my_spring_app.dto.reponse.AnsibleTaskStatusResponse> getAnsibleInitStatus(
            @RequestParam String taskId) {
        my_spring_app.my_spring_app.dto.reponse.AnsibleTaskStatusResponse response = ansibleService.getInitTaskStatus(taskId);
        return ResponseEntity.ok(response);
    }
    
    // ==================== Config Ansible ====================
    
    // Infrastructure - Save Ansible Config
    @PostMapping("/ansible/config/save")
    public ResponseEntity<AnsibleOperationResponse> saveAnsibleConfig(@Valid @RequestBody SaveAnsibleConfigRequest request) {
        AnsibleOperationResponse response = ansibleService.saveAnsibleConfig(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Verify Ansible Config
    @PostMapping("/ansible/config/verify")
    public ResponseEntity<AnsibleOperationResponse> verifyAnsibleConfig(@Valid @RequestBody VerifyAnsibleConfigRequest request) {
        AnsibleOperationResponse response = ansibleService.verifyAnsibleConfig(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Get Ansible Config
    @GetMapping("/ansible/config")
    public ResponseEntity<AnsibleConfigResponse> getAnsibleConfig(
            @RequestParam(required = false) String controllerHost) {
        AnsibleConfigResponse response = ansibleService.getAnsibleConfig(controllerHost);
        return ResponseEntity.ok(response);
    }
    
    // ==================== Playbook ====================
    
    // Infrastructure - Get Playbooks
    @GetMapping("/ansible/playbooks")
    public ResponseEntity<PlaybookListResponse> getPlaybooks(@RequestParam(required = false) String controllerHost) {
        PlaybookListResponse response = ansibleService.getPlaybooks(controllerHost);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Save Playbook
    @PostMapping("/ansible/playbooks/save")
    public ResponseEntity<AnsibleOperationResponse> savePlaybook(@Valid @RequestBody SavePlaybookRequest request) {
        AnsibleOperationResponse response = ansibleService.savePlaybook(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Delete Playbook
    @PostMapping("/ansible/playbooks/delete")
    public ResponseEntity<AnsibleOperationResponse> deletePlaybook(@Valid @RequestBody DeletePlaybookRequest request) {
        AnsibleOperationResponse response = ansibleService.deletePlaybook(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Execute Playbook
    @PostMapping("/ansible/playbooks/execute")
    public ResponseEntity<AnsibleOperationResponse> executePlaybook(@Valid @RequestBody ExecutePlaybookRequest request) {
        AnsibleOperationResponse response = ansibleService.executePlaybook(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/ansible/playbooks/status")
    public ResponseEntity<my_spring_app.my_spring_app.dto.reponse.AnsibleTaskStatusResponse> getPlaybookExecutionStatus(
            @RequestParam String taskId) {
        my_spring_app.my_spring_app.dto.reponse.AnsibleTaskStatusResponse response =
                ansibleService.getPlaybookTaskStatus(taskId);
        return ResponseEntity.ok(response);
    }

    // Infrastructure - Upload Playbook
    @PostMapping("/ansible/playbooks/upload")
    public ResponseEntity<AnsibleOperationResponse> uploadPlaybook(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String controllerHost,
            @RequestParam(required = false) String sudoPassword) {
        AnsibleOperationResponse response = ansibleService.uploadPlaybook(file, controllerHost, sudoPassword);
        return ResponseEntity.ok(response);
    }
    
    // ==================== Install K8s ====================
    
    // Infrastructure - Install K8s Tab 1
    @PostMapping("/k8s/install/tab1")
    public ResponseEntity<AnsibleOperationResponse> installK8sTab1(@Valid @RequestBody InstallK8sRequest request) {
        AnsibleOperationResponse response = ansibleService.installK8sTab1(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Install K8s Tab 2
    @PostMapping("/k8s/install/tab2")
    public ResponseEntity<AnsibleOperationResponse> installK8sTab2(@Valid @RequestBody InstallK8sRequest request) {
        AnsibleOperationResponse response = ansibleService.installK8sTab2(request);
        return ResponseEntity.ok(response);
    }
    
    // Infrastructure - Install K8s Tab 3
    @PostMapping("/k8s/install/tab3")
    public ResponseEntity<AnsibleOperationResponse> installK8sTab3(@Valid @RequestBody InstallK8sRequest request) {
        AnsibleOperationResponse response = ansibleService.installK8sTab3(request);
        return ResponseEntity.ok(response);
    }
}