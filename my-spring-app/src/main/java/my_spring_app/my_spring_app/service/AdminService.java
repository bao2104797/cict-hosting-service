package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.AdminOverviewResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminProjectResourceDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminUserProjectListResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminUserProjectSummaryResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminUserUsageResponse;
import my_spring_app.my_spring_app.dto.reponse.ClusterCapacityResponse;
import my_spring_app.my_spring_app.dto.reponse.ClusterAllocatableResponse;
import my_spring_app.my_spring_app.dto.reponse.ClusterInfoResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminDatabaseDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminBackendDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.AdminFrontendDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.DashboardMetricsResponse;
import my_spring_app.my_spring_app.dto.reponse.NodeListResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceListResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.DeploymentListResponse;
import my_spring_app.my_spring_app.dto.reponse.PodListResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetListResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceListResponse;
import my_spring_app.my_spring_app.dto.reponse.IngressListResponse;
import my_spring_app.my_spring_app.dto.reponse.PVCListResponse;
import my_spring_app.my_spring_app.dto.reponse.PVListResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceResponse;
import my_spring_app.my_spring_app.dto.reponse.DeploymentResponse;
import my_spring_app.my_spring_app.dto.reponse.PodResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetResponse;
import my_spring_app.my_spring_app.dto.request.NamespaceRequest;

public interface AdminService {

    AdminOverviewResponse getOverview();

    AdminUserUsageResponse getUserResourceOverview();

    AdminUserProjectSummaryResponse getUserProjectSummary(Long userId);

    AdminUserProjectListResponse getUserProjectsDetail(Long userId);

    AdminProjectResourceDetailResponse getProjectResourceDetail(Long projectId);

    ClusterCapacityResponse getClusterCapacity();

    ClusterAllocatableResponse getClusterAllocatable();

    ClusterInfoResponse getClusterInfo();

    AdminDatabaseDetailResponse getDatabaseDetail(Long databaseId);

    AdminBackendDetailResponse getBackendDetail(Long backendId);

    AdminFrontendDetailResponse getFrontendDetail(Long frontendId);

    DashboardMetricsResponse getDashboardMetrics();

    NodeListResponse getNodes();

    my_spring_app.my_spring_app.dto.reponse.NodeResponse getNode(String name);

    void joinNodeToK8s(Long serverId);

    void removeNodeFromK8s(String nodeName, String nodeIp);

    NamespaceListResponse getNamespaces();

    NamespaceDetailResponse getNamespace(String name);

    NamespaceResponse createNamespace(NamespaceRequest request);

    NamespaceResponse createNamespaceFromYaml(String yaml);

    NamespaceResponse updateNamespaceFromYaml(String name, String yaml);

    void deleteNamespace(String name);

    DeploymentListResponse getDeployments();

    PodListResponse getPods();

    StatefulsetListResponse getStatefulsets();

    DeploymentResponse getDeployment(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.DeploymentDetailResponse getDeploymentDetail(String namespace, String name);

    DeploymentResponse createDeployment(my_spring_app.my_spring_app.dto.request.DeploymentRequest request);

    DeploymentResponse createDeploymentFromYaml(String yaml);

    DeploymentResponse scaleDeployment(String namespace, String name, int replicas);

    DeploymentResponse updateDeploymentFromYaml(String namespace, String name, String yaml);

    void deleteDeployment(String namespace, String name);

    PodResponse getPod(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.PodDetailResponse getPodDetail(String namespace, String name);

    PodResponse createPod(my_spring_app.my_spring_app.dto.request.PodRequest request);

    PodResponse createPodFromYaml(String yaml);

    String getPodLogs(String namespace, String name, String container);

    String execPodCommand(String namespace, String name, String container, String command);

    PodResponse updatePodFromYaml(String namespace, String name, String yaml);
    void deletePod(String namespace, String name);

    StatefulsetResponse getStatefulset(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.StatefulsetDetailResponse getStatefulsetDetail(String namespace, String name);

    StatefulsetResponse createStatefulset(my_spring_app.my_spring_app.dto.request.StatefulsetRequest request);

    StatefulsetResponse createStatefulsetFromYaml(String yaml);

    StatefulsetResponse scaleStatefulset(String namespace, String name, int replicas);

    StatefulsetResponse updateStatefulsetFromYaml(String namespace, String name, String yaml);

    void deleteStatefulset(String namespace, String name);

    ServiceListResponse getServices();

    my_spring_app.my_spring_app.dto.reponse.ServiceResponse getService(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.ServiceDetailResponse getServiceDetail(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.ServiceResponse createService(my_spring_app.my_spring_app.dto.request.ServiceRequest request);

    my_spring_app.my_spring_app.dto.reponse.ServiceResponse createServiceFromYaml(String yaml);

    my_spring_app.my_spring_app.dto.reponse.ServiceResponse updateServiceFromYaml(String namespace, String name, String yaml);

    void deleteService(String namespace, String name);

    IngressListResponse getIngress();

    my_spring_app.my_spring_app.dto.reponse.IngressResponse getIngress(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.IngressDetailResponse getIngressDetail(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.IngressResponse createIngress(my_spring_app.my_spring_app.dto.request.IngressRequest request);

    my_spring_app.my_spring_app.dto.reponse.IngressResponse updateIngress(String namespace, String name, my_spring_app.my_spring_app.dto.request.IngressRequest request);

    my_spring_app.my_spring_app.dto.reponse.IngressResponse updateIngressFromYaml(String namespace, String name, String yaml);

    my_spring_app.my_spring_app.dto.reponse.IngressResponse createIngressFromYaml(String yaml);

    void deleteIngress(String namespace, String name);

    PVCListResponse getPVCs();

    my_spring_app.my_spring_app.dto.reponse.PVCResponse getPVC(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.PVCDetailResponse getPVCDetail(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.PVCResponse updatePVCFromYaml(String namespace, String name, String yaml);

    my_spring_app.my_spring_app.dto.reponse.PVCResponse createPVCFromYaml(String yaml);

    my_spring_app.my_spring_app.dto.reponse.PVCResponse createPVC(my_spring_app.my_spring_app.dto.request.PVCRequest request);

    void deletePVC(String namespace, String name);

    PVListResponse getPVs();

    my_spring_app.my_spring_app.dto.reponse.PVResponse getPV(String name);

    my_spring_app.my_spring_app.dto.reponse.PVDetailResponse getPVDetail(String name);

    my_spring_app.my_spring_app.dto.reponse.PVResponse updatePVFromYaml(String name, String yaml);

    my_spring_app.my_spring_app.dto.reponse.PVResponse createPVFromYaml(String yaml);

    my_spring_app.my_spring_app.dto.reponse.PVResponse createPV(my_spring_app.my_spring_app.dto.request.PVRequest request);

    void deletePV(String name);
}