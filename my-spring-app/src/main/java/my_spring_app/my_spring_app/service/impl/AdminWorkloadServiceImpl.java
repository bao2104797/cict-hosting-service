package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.Session;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Container;
import io.kubernetes.client.openapi.models.V1ContainerPort;
import io.kubernetes.client.openapi.models.V1ContainerStatus;
import io.kubernetes.client.openapi.models.V1PodCondition;
import io.kubernetes.client.openapi.models.V1Deployment;
import io.kubernetes.client.openapi.models.V1DeploymentCondition;
import io.kubernetes.client.openapi.models.V1DeploymentStatus;
import io.kubernetes.client.openapi.models.V1DeploymentSpec;
import io.kubernetes.client.openapi.models.V1LabelSelector;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1Pod;
import io.kubernetes.client.openapi.models.V1PodList;
import io.kubernetes.client.openapi.models.V1PodSpec;
import io.kubernetes.client.openapi.models.V1PodStatus;
import io.kubernetes.client.openapi.models.V1PodTemplateSpec;
import io.kubernetes.client.openapi.models.V1ResourceRequirements;
import io.kubernetes.client.openapi.models.V1Scale;
import io.kubernetes.client.openapi.models.V1ScaleSpec;
import io.kubernetes.client.openapi.models.V1StatefulSet;
import io.kubernetes.client.openapi.models.V1StatefulSetSpec;
import io.kubernetes.client.openapi.models.V1StatefulSetCondition;
import io.kubernetes.client.openapi.models.V1StatefulSetStatus;
import my_spring_app.my_spring_app.dto.reponse.DeploymentListResponse;
import my_spring_app.my_spring_app.dto.reponse.DeploymentResponse;
import my_spring_app.my_spring_app.dto.reponse.DeploymentDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.PodListResponse;
import my_spring_app.my_spring_app.dto.reponse.PodResponse;
import my_spring_app.my_spring_app.dto.reponse.PodDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetListResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetDetailResponse;
import my_spring_app.my_spring_app.dto.request.DeploymentRequest;
import my_spring_app.my_spring_app.dto.request.PodRequest;
import my_spring_app.my_spring_app.dto.request.StatefulsetRequest;
import io.kubernetes.client.openapi.models.V1ReplicaSet;
import io.kubernetes.client.openapi.models.V1ReplicaSetList;
import io.kubernetes.client.openapi.models.V1PersistentVolumeClaim;
import io.kubernetes.client.openapi.models.V1PersistentVolumeClaimList;
import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.util.Yaml;
import io.kubernetes.client.util.Config;
import io.kubernetes.client.openapi.Configuration;
import java.util.HashMap;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.service.AdminWorkloadService;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AdminWorkloadServiceImpl extends BaseKubernetesService implements AdminWorkloadService {

    private final ServerRepository serverRepository;

    public AdminWorkloadServiceImpl(ServerRepository serverRepository) {
        this.serverRepository = serverRepository;
    }

    private ServerEntity getMasterServer() {
        return serverRepository.findByRole("MASTER").orElseThrow(() -> new RuntimeException(
                "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));
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
    public DeploymentListResponse getDeployments() {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);

            io.kubernetes.client.openapi.models.V1DeploymentList deploymentList = api
                    .listDeploymentForAllNamespaces(null, null, null, null, null, null, null, null, null, null, null);

            List<DeploymentResponse> deployments = new ArrayList<>();
            if (deploymentList.getItems() != null) {
                for (V1Deployment v1Deployment : deploymentList.getItems()) {
                    try {
                        deployments.add(buildDeploymentResponse(v1Deployment, session));
                    } catch (Exception ignored) {
                    }
                }
            }
            return new DeploymentListResponse(deployments);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy danh sách deployments từ Kubernetes API: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy danh sách deployments: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public DeploymentResponse getDeployment(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);
            V1Deployment v1Deployment = api.readNamespacedDeployment(name, namespace, null);
            if (v1Deployment == null) {
                throw new RuntimeException("Deployment không tồn tại");
            }
            return buildDeploymentResponse(v1Deployment, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy deployment: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy deployment: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public DeploymentDetailResponse getDeploymentDetail(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api appsApi = new AppsV1Api(client);
            CoreV1Api coreApi = new CoreV1Api(client);

            // Lấy deployment
            V1Deployment v1Deployment = appsApi.readNamespacedDeployment(name, namespace, null);
            if (v1Deployment == null) {
                throw new RuntimeException("Deployment không tồn tại");
            }

            DeploymentDetailResponse detail = new DeploymentDetailResponse();
            
            // Basic info từ deployment
            if (v1Deployment.getMetadata() != null) {
                detail.setId(namespace + "/" + name);
                detail.setName(name);
                detail.setNamespace(namespace);
                detail.setAge(calculateAge(v1Deployment.getMetadata().getCreationTimestamp()));
                detail.setUid(v1Deployment.getMetadata().getUid());
                detail.setResourceVersion(v1Deployment.getMetadata().getResourceVersion());
                if (v1Deployment.getMetadata().getCreationTimestamp() != null) {
                    detail.setCreationTimestamp(v1Deployment.getMetadata().getCreationTimestamp().toString());
                }
                
                // Labels và Annotations
                if (v1Deployment.getMetadata().getLabels() != null) {
                    detail.setLabels(new HashMap<>(v1Deployment.getMetadata().getLabels()));
                }
                if (v1Deployment.getMetadata().getAnnotations() != null) {
                    detail.setAnnotations(new HashMap<>(v1Deployment.getMetadata().getAnnotations()));
                }
            }

            // Replicas info
            int desired = 0;
            int ready = 0;
            int updated = 0;
            int available = 0;
            if (v1Deployment.getSpec() != null && v1Deployment.getSpec().getReplicas() != null) {
                desired = v1Deployment.getSpec().getReplicas();
            }
            V1DeploymentStatus status = v1Deployment.getStatus();
            if (status != null) {
                ready = status.getReadyReplicas() != null ? status.getReadyReplicas() : 0;
                updated = status.getUpdatedReplicas() != null ? status.getUpdatedReplicas() : 0;
                available = status.getAvailableReplicas() != null ? status.getAvailableReplicas() : 0;
            }
            detail.setReplicas(new DeploymentResponse.ReplicasInfo(desired, ready, updated, available));

            // Status calculation based on replicas and conditions
            // Deployment doesn't have a phase like Pods, status is determined from conditions and replicas
            String depStatus = "running";
            
            // Check conditions first (more reliable than replicas alone)
            boolean hasErrorCondition = false;
            if (status != null && status.getConditions() != null) {
                for (V1DeploymentCondition condition : status.getConditions()) {
                    if (condition == null || condition.getType() == null || condition.getStatus() == null) {
                        continue;
                    }
                    String conditionType = condition.getType();
                    String conditionStatus = condition.getStatus();
                    
                    // Check for error conditions:
                    // - ReplicaFailure: indicates pod creation/update failures
                    // - Progressing=False: deployment is not progressing
                    // - Available=False: deployment has no available replicas
                    if ("ReplicaFailure".equals(conditionType) && "True".equals(conditionStatus)) {
                        hasErrorCondition = true;
                        break;
                    }
                    if ("False".equals(conditionStatus) && 
                        ("Progressing".equals(conditionType) || "Available".equals(conditionType))) {
                        hasErrorCondition = true;
                        break;
                    }
                }
            }
            
            if (hasErrorCondition) {
                depStatus = "error";
            } else if (ready == 0 && desired > 0) {
                // No ready replicas but desired > 0 indicates an error
                depStatus = "error";
            } else if (ready < desired) {
                // Some replicas are not ready yet (could be rolling update or scaling)
                depStatus = "pending";
            }
            // else: ready >= desired → "running"
            
            detail.setStatus(depStatus);

            // Conditions
            if (status != null && status.getConditions() != null) {
                detail.setConditions(new ArrayList<>(status.getConditions()));
            }

            // Containers và Images
            List<String> containers = new ArrayList<>();
            List<String> images = new ArrayList<>();
            if (v1Deployment.getSpec() != null
                    && v1Deployment.getSpec().getTemplate() != null
                    && v1Deployment.getSpec().getTemplate().getSpec() != null
                    && v1Deployment.getSpec().getTemplate().getSpec().getContainers() != null) {
                for (V1Container container : v1Deployment.getSpec().getTemplate().getSpec().getContainers()) {
                    if (container.getName() != null) {
                        containers.add(container.getName());
                    }
                    if (container.getImage() != null) {
                        images.add(container.getImage());
                    }
                }
            }
            detail.setContainers(containers);
            detail.setImages(images);

            // Selector
            String selector = "";
            if (v1Deployment.getSpec() != null && v1Deployment.getSpec().getSelector() != null) {
                V1LabelSelector labelSelector = v1Deployment.getSpec().getSelector();
                if (labelSelector.getMatchLabels() != null && !labelSelector.getMatchLabels().isEmpty()) {
                    List<String> selectorParts = new ArrayList<>();
                    for (Map.Entry<String, String> entry : labelSelector.getMatchLabels().entrySet()) {
                        selectorParts.add(entry.getKey() + "=" + entry.getValue());
                    }
                    selector = String.join(",", selectorParts);
                }
            }
            detail.setSelector(selector);

            // YAML
            try {
                detail.setYaml(Yaml.dump(v1Deployment));
            } catch (Exception e) {
                detail.setYaml("Không thể tạo YAML: " + e.getMessage());
            }

            // Lấy Pods liên quan - sử dụng selector từ deployment
            List<DeploymentDetailResponse.PodInfo> pods = new ArrayList<>();
            String labelSelector = null;
            try {
                if (v1Deployment.getSpec() != null && v1Deployment.getSpec().getSelector() != null
                        && v1Deployment.getSpec().getSelector().getMatchLabels() != null
                        && !v1Deployment.getSpec().getSelector().getMatchLabels().isEmpty()) {
                    List<String> selectorParts = new ArrayList<>();
                    for (Map.Entry<String, String> entry : v1Deployment.getSpec().getSelector().getMatchLabels().entrySet()) {
                        selectorParts.add(entry.getKey() + "=" + entry.getValue());
                    }
                    labelSelector = String.join(",", selectorParts);
                }
                V1PodList podList = coreApi.listNamespacedPod(
                        namespace, null, null, null, null, labelSelector, null, null, null, null, null, null);
                if (podList != null && podList.getItems() != null) {
                    for (V1Pod pod : podList.getItems()) {
                        DeploymentDetailResponse.PodInfo podInfo = buildPodInfo(pod);
                        if (podInfo != null) {
                            pods.add(podInfo);
                        }
                    }
                }
            } catch (Exception e) {
                // Bỏ qua lỗi khi lấy pods
            }
            detail.setPods(pods);

            // Lấy ReplicaSets liên quan
            List<DeploymentDetailResponse.ReplicaSetInfo> replicaSets = new ArrayList<>();
            try {
                V1ReplicaSetList rsList = appsApi.listNamespacedReplicaSet(
                        namespace, null, null, null, null, null, null, null, null, null, null, null);
                if (rsList != null && rsList.getItems() != null) {
                    for (V1ReplicaSet rs : rsList.getItems()) {
                        if (rs.getMetadata() != null && rs.getMetadata().getOwnerReferences() != null) {
                            for (var ownerRef : rs.getMetadata().getOwnerReferences()) {
                                if ("Deployment".equals(ownerRef.getKind()) && name.equals(ownerRef.getName())) {
                                    DeploymentDetailResponse.ReplicaSetInfo rsInfo = buildReplicaSetInfo(rs);
                                    if (rsInfo != null) {
                                        replicaSets.add(rsInfo);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                // Bỏ qua lỗi khi lấy replicasets
            }
            detail.setReplicaSets(replicaSets);

            // Lấy Events - Tạm thời bỏ qua vì V1Event không có trong client library
            // Có thể lấy qua kubectl hoặc API trực tiếp nếu cần
            detail.setEvents(new ArrayList<>());

            // CPU và Memory (từ kubectl top pods) - sử dụng selector đúng của deployment
            try {
                if (labelSelector != null && !labelSelector.isEmpty()) {
                    String cmd = String.format("kubectl top pods -n %s -l %s --no-headers", namespace, labelSelector);
                    String output = executeCommand(session, cmd, true);
                    if (output != null && !output.trim().isEmpty()) {
                        String[] lines = output.split("\\r?\\n");
                        double totalCpu = 0.0;
                        long totalMemory = 0L;
                        for (String line : lines) {
                            line = line.trim();
                            if (line.isEmpty()) {
                                continue;
                            }
                            String[] parts = line.split("\\s+");
                            if (parts.length >= 3) {
                                try {
                                    double cpu = parseCpuCores(parts[1]);
                                    long memory = parseMemoryBytes(parts[2]);
                                    totalCpu += cpu;
                                    totalMemory += memory;
                                } catch (NumberFormatException ex) {
                                    // Bỏ qua dòng không parse được
                                }
                            }
                        }
                        detail.setCpu(formatCpu(totalCpu));
                        detail.setMemory(formatMemory(totalMemory));
                    } else {
                        detail.setCpu("0m");
                        detail.setMemory("0");
                    }
                } else {
                    detail.setCpu("0m");
                    detail.setMemory("0");
                }
            } catch (Exception e) {
                detail.setCpu("0m");
                detail.setMemory("0");
            }

            return detail;
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy deployment detail: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy deployment detail: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public DeploymentResponse createDeployment(DeploymentRequest request) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);

            V1Deployment deployment = buildV1DeploymentFromRequest(request);
            V1Deployment created = api.createNamespacedDeployment(
                    request.getNamespace(),
                    deployment,
                    null,
                    null,
                    null,
                    null);
            return buildDeploymentResponse(created, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo deployment: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo deployment: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public DeploymentResponse createDeploymentFromYaml(String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);

            V1Deployment deploymentFromYaml = Yaml.loadAs(yaml, V1Deployment.class);
            if (deploymentFromYaml == null || deploymentFromYaml.getMetadata() == null
                    || deploymentFromYaml.getMetadata().getName() == null
                    || deploymentFromYaml.getMetadata().getNamespace() == null) {
                throw new RuntimeException("YAML thiếu name hoặc namespace");
            }

            V1Deployment created = api.createNamespacedDeployment(
                    deploymentFromYaml.getMetadata().getNamespace(),
                    deploymentFromYaml,
                    null,
                    null,
                    null,
                    null);
            return buildDeploymentResponse(created, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo deployment từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo deployment từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    private DeploymentDetailResponse.PodInfo buildPodInfo(V1Pod pod) {
        if (pod == null || pod.getMetadata() == null) {
            return null;
        }
        DeploymentDetailResponse.PodInfo podInfo = new DeploymentDetailResponse.PodInfo();
        podInfo.setName(pod.getMetadata().getName());
        podInfo.setNamespace(pod.getMetadata().getNamespace());
        podInfo.setAge(calculateAge(pod.getMetadata().getCreationTimestamp()));

        V1PodStatus status = pod.getStatus();
        if (status != null) {
            if (status.getPhase() != null) {
                podInfo.setStatus(status.getPhase().toLowerCase());
            }
            if (status.getPodIP() != null) {
                podInfo.setIp(status.getPodIP());
            }
            int ready = 0;
            int total = 0;
            int restarts = 0;
            if (status.getContainerStatuses() != null) {
                total = status.getContainerStatuses().size();
                for (V1ContainerStatus containerStatus : status.getContainerStatuses()) {
                    if (Boolean.TRUE.equals(containerStatus.getReady())) {
                        ready++;
                    }
                    if (containerStatus.getRestartCount() != null) {
                        restarts += containerStatus.getRestartCount();
                    }
                }
            }
            podInfo.setReady(ready + "/" + total);
            podInfo.setRestarts(restarts);
        }
        if (pod.getSpec() != null && pod.getSpec().getNodeName() != null) {
            podInfo.setNode(pod.getSpec().getNodeName());
        }
        return podInfo;
    }

    private DeploymentDetailResponse.ReplicaSetInfo buildReplicaSetInfo(V1ReplicaSet rs) {
        if (rs == null || rs.getMetadata() == null) {
            return null;
        }
        DeploymentDetailResponse.ReplicaSetInfo rsInfo = new DeploymentDetailResponse.ReplicaSetInfo();
        rsInfo.setName(rs.getMetadata().getName());
        rsInfo.setNamespace(rs.getMetadata().getNamespace());
        rsInfo.setAge(calculateAge(rs.getMetadata().getCreationTimestamp()));

        if (rs.getSpec() != null && rs.getSpec().getReplicas() != null) {
            rsInfo.setReplicas(rs.getSpec().getReplicas());
        }
        if (rs.getStatus() != null) {
            rsInfo.setReadyReplicas(rs.getStatus().getReadyReplicas() != null ? rs.getStatus().getReadyReplicas() : 0);
        }

        // Lấy image từ template
        if (rs.getSpec() != null && rs.getSpec().getTemplate() != null
                && rs.getSpec().getTemplate().getSpec() != null
                && rs.getSpec().getTemplate().getSpec().getContainers() != null
                && !rs.getSpec().getTemplate().getSpec().getContainers().isEmpty()) {
            V1Container container = rs.getSpec().getTemplate().getSpec().getContainers().get(0);
            if (container.getImage() != null) {
                rsInfo.setImage(container.getImage());
            }
        }
        return rsInfo;
    }


    private String formatCpu(double cpuCores) {
        if (cpuCores <= 0) {
            return "0m";
        }
        if (cpuCores < 1.0) {
            int millicores = (int) Math.round(cpuCores * 1000);
            return millicores + "m";
        } else {
            return String.format("%.1f", cpuCores);
        }
    }

    private String formatMemory(long memoryBytes) {
        if (memoryBytes <= 0) {
            return "0";
        }
        double bytes = (double) memoryBytes;
        if (bytes < 1024 * 1024) {
            double ki = bytes / 1024.0;
            return String.format("%.1fKi", ki);
        } else if (bytes < 1024 * 1024 * 1024) {
            double mi = bytes / (1024.0 * 1024.0);
            return String.format("%.1fMi", mi);
        } else {
            double gi = bytes / (1024.0 * 1024.0 * 1024.0);
            return String.format("%.1fGi", gi);
        }
    }

    @Override
    public DeploymentResponse scaleDeployment(String namespace, String name, int replicas) {
        if (replicas < 0) {
            throw new IllegalArgumentException("Replicas must be >= 0");
        }
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);

            V1Scale scale = new V1Scale();
            V1ObjectMeta metadata = new V1ObjectMeta();
            metadata.setName(name);
            metadata.setNamespace(namespace);
            scale.setMetadata(metadata);
            V1ScaleSpec spec = new V1ScaleSpec();
            spec.setReplicas(replicas);
            scale.setSpec(spec);

            api.replaceNamespacedDeploymentScale(name, namespace, scale, null, null, null, null);
            V1Deployment updated = api.readNamespacedDeployment(name, namespace, null);
            return buildDeploymentResponse(updated, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể scale deployment: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể scale deployment: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public DeploymentResponse updateDeploymentFromYaml(String namespace, String name, String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);

            V1Deployment deploymentFromYaml = Yaml.loadAs(yaml, V1Deployment.class);
            if (deploymentFromYaml == null) {
                throw new RuntimeException("YAML không hợp lệ");
            }

            if (deploymentFromYaml.getMetadata() == null) {
                deploymentFromYaml.setMetadata(new V1ObjectMeta());
            }
            if (!name.equals(deploymentFromYaml.getMetadata().getName())) {
                throw new RuntimeException("Tên trong YAML không khớp với tên deployment");
            }
            if (!namespace.equals(deploymentFromYaml.getMetadata().getNamespace())) {
                throw new RuntimeException("Namespace trong YAML không khớp với namespace deployment");
            }

            V1Deployment existing = api.readNamespacedDeployment(name, namespace, null);
            if (existing == null) {
                throw new RuntimeException("Deployment không tồn tại");
            }
            if (existing.getMetadata() != null) {
                deploymentFromYaml.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
                deploymentFromYaml.getMetadata().setUid(existing.getMetadata().getUid());
            }

            V1Deployment updated = api.replaceNamespacedDeployment(name, namespace, deploymentFromYaml, null, null, null, null);
            return buildDeploymentResponse(updated, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể cập nhật deployment từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể cập nhật deployment từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public void deleteDeployment(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);
            api.deleteNamespacedDeployment(name, namespace, null, null, null, null, null, null);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể xóa deployment: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể xóa deployment: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PodListResponse getPods() {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            io.kubernetes.client.openapi.models.V1PodList podList = api.listPodForAllNamespaces(
                    null, null, null, null, null, null, null, null, null, null, null);

            List<PodResponse> pods = new ArrayList<>();
            if (podList.getItems() != null) {
                for (V1Pod v1Pod : podList.getItems()) {
                    try {
                        pods.add(buildPodResponse(v1Pod, session));
                    } catch (Exception ignored) {
                    }
                }
            }
            return new PodListResponse(pods);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy danh sách pods từ Kubernetes API: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy danh sách pods: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PodResponse getPod(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            V1Pod v1Pod = api.readNamespacedPod(name, namespace, null);
            if (v1Pod == null) {
                throw new RuntimeException("Pod không tồn tại");
            }
            return buildPodResponse(v1Pod, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy pod: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy pod: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PodDetailResponse getPodDetail(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            V1Pod v1Pod = api.readNamespacedPod(name, namespace, null);
            if (v1Pod == null) {
                throw new RuntimeException("Pod không tồn tại");
            }

            PodDetailResponse detail = new PodDetailResponse();
            if (v1Pod.getMetadata() != null) {
                detail.setId(namespace + "/" + name);
                detail.setName(name);
                detail.setNamespace(namespace);
                detail.setAge(calculateAge(v1Pod.getMetadata().getCreationTimestamp()));
                detail.setUid(v1Pod.getMetadata().getUid());
                detail.setResourceVersion(v1Pod.getMetadata().getResourceVersion());
                if (v1Pod.getMetadata().getCreationTimestamp() != null) {
                    detail.setCreationTimestamp(v1Pod.getMetadata().getCreationTimestamp().toString());
                }
                detail.setLabels(v1Pod.getMetadata().getLabels());
                detail.setAnnotations(v1Pod.getMetadata().getAnnotations());
            }

            V1PodStatus status = v1Pod.getStatus();
            if (status != null) {
                // Extract status from Kubernetes (pod phase + container states)
                detail.setStatus(extractPodStatus(status));
                if (status.getPodIP() != null) {
                    detail.setIp(status.getPodIP());
                }
                if (status.getNominatedNodeName() != null) {
                    detail.setNominatedNode(status.getNominatedNodeName());
                }

                int ready = 0;
                int total = 0;
                int restarts = 0;
                if (status.getContainerStatuses() != null) {
                    total = status.getContainerStatuses().size();
                    for (V1ContainerStatus containerStatus : status.getContainerStatuses()) {
                        if (Boolean.TRUE.equals(containerStatus.getReady())) {
                            ready++;
                        }
                        if (containerStatus.getRestartCount() != null) {
                            restarts += containerStatus.getRestartCount();
                        }
                    }
                }
                detail.setReady(new PodResponse.ReadyInfo(ready, total));
                detail.setRestarts(restarts);

                // Build containers info
                List<PodDetailResponse.ContainerInfo> containers = new ArrayList<>();
                if (v1Pod.getSpec() != null && v1Pod.getSpec().getContainers() != null) {
                    for (V1Container container : v1Pod.getSpec().getContainers()) {
                        PodDetailResponse.ContainerInfo containerInfo = buildContainerInfo(container, status);
                        if (containerInfo != null) {
                            containers.add(containerInfo);
                        }
                    }
                }
                detail.setContainers(containers);

                // Build conditions
                List<PodDetailResponse.ConditionInfo> conditions = new ArrayList<>();
                if (status.getConditions() != null) {
                    for (V1PodCondition condition : status.getConditions()) {
                        PodDetailResponse.ConditionInfo conditionInfo = new PodDetailResponse.ConditionInfo();
                        conditionInfo.setType(condition.getType());
                        conditionInfo.setStatus(condition.getStatus());
                        conditionInfo.setReason(condition.getReason());
                        conditionInfo.setMessage(condition.getMessage());
                        if (condition.getLastTransitionTime() != null) {
                            conditionInfo.setLastTransitionTime(condition.getLastTransitionTime().toString());
                        }
                        if (condition.getLastProbeTime() != null) {
                            conditionInfo.setLastProbeTime(condition.getLastProbeTime().toString());
                        }
                        conditions.add(conditionInfo);
                    }
                }
                detail.setConditions(conditions);

                if (status.getConditions() != null && !status.getConditions().isEmpty()) {
                    List<String> readiness = new ArrayList<>();
                    status.getConditions().forEach(condition -> {
                        if (condition.getType() != null) {
                            readiness.add(condition.getType());
                        }
                    });
                    detail.setReadinessGates(readiness);
                }
            }

            if (v1Pod.getSpec() != null && v1Pod.getSpec().getNodeName() != null) {
                detail.setNode(v1Pod.getSpec().getNodeName());
            }

            // CPU và Memory từ kubectl top pod
            try {
                String cmd = String.format("kubectl top pod %s -n %s --no-headers", name, namespace);
                String output = executeCommand(session, cmd, true);
                if (output != null && !output.trim().isEmpty()) {
                    String[] parts = output.trim().split("\\s+");
                    if (parts.length >= 3) {
                        try {
                            double cpu = parseCpuCores(parts[1]);
                            long memory = parseMemoryBytes(parts[2]);
                            detail.setCpu(formatCpu(cpu));
                            detail.setMemory(formatMemory(memory));
                        } catch (NumberFormatException ex) {
                            detail.setCpu("0m");
                            detail.setMemory("0");
                        }
                    } else {
                        detail.setCpu("0m");
                        detail.setMemory("0");
                    }
                } else {
                    detail.setCpu("0m");
                    detail.setMemory("0");
                }
            } catch (Exception e) {
                detail.setCpu("0m");
                detail.setMemory("0");
            }

            // Lấy Events
            List<PodDetailResponse.EventInfo> events = new ArrayList<>();
            try {
                // Events sẽ được lấy qua kubectl hoặc API nếu cần
                // Tạm thời để trống
            } catch (Exception e) {
                // Bỏ qua lỗi
            }
            detail.setEvents(events);

            // YAML
            try {
                detail.setYaml(Yaml.dump(v1Pod));
            } catch (Exception e) {
                detail.setYaml("Không thể tạo YAML: " + e.getMessage());
            }

            return detail;
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy pod detail: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy pod detail: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    private PodDetailResponse.ContainerInfo buildContainerInfo(V1Container container, V1PodStatus podStatus) {
        if (container == null) {
            return null;
        }
        PodDetailResponse.ContainerInfo info = new PodDetailResponse.ContainerInfo();
        info.setName(container.getName());
        info.setImage(container.getImage());
        if (container.getImagePullPolicy() != null) {
            info.setImagePullPolicy(container.getImagePullPolicy());
        }

        // Ports
        List<PodDetailResponse.PortInfo> ports = new ArrayList<>();
        if (container.getPorts() != null) {
            for (V1ContainerPort port : container.getPorts()) {
                PodDetailResponse.PortInfo portInfo = new PodDetailResponse.PortInfo();
                portInfo.setName(port.getName());
                portInfo.setContainerPort(port.getContainerPort());
                if (port.getProtocol() != null) {
                    portInfo.setProtocol(port.getProtocol());
                }
                ports.add(portInfo);
            }
        }
        info.setPorts(ports);

        // Resources
        PodDetailResponse.ResourceInfo resourceInfo = new PodDetailResponse.ResourceInfo();
        if (container.getResources() != null) {
            if (container.getResources().getRequests() != null) {
                if (container.getResources().getRequests().get("cpu") != null) {
                    resourceInfo.setCpuRequest(container.getResources().getRequests().get("cpu").toString());
                }
                if (container.getResources().getRequests().get("memory") != null) {
                    resourceInfo.setMemoryRequest(container.getResources().getRequests().get("memory").toString());
                }
            }
            if (container.getResources().getLimits() != null) {
                if (container.getResources().getLimits().get("cpu") != null) {
                    resourceInfo.setCpuLimit(container.getResources().getLimits().get("cpu").toString());
                }
                if (container.getResources().getLimits().get("memory") != null) {
                    resourceInfo.setMemoryLimit(container.getResources().getLimits().get("memory").toString());
                }
            }
        }
        info.setResources(resourceInfo);

        // Status từ container statuses
        if (podStatus != null && podStatus.getContainerStatuses() != null) {
            for (V1ContainerStatus containerStatus : podStatus.getContainerStatuses()) {
                if (container.getName().equals(containerStatus.getName())) {
                    info.setReady(containerStatus.getReady());
                    info.setRestartCount(containerStatus.getRestartCount());
                    if (containerStatus.getState() != null) {
                        if (containerStatus.getState().getRunning() != null) {
                            info.setStatus("Running");
                            if (containerStatus.getState().getRunning().getStartedAt() != null) {
                                info.setStartedAt(containerStatus.getState().getRunning().getStartedAt().toString());
                            }
                        } else if (containerStatus.getState().getWaiting() != null) {
                            info.setStatus("Waiting");
                        } else if (containerStatus.getState().getTerminated() != null) {
                            info.setStatus("Terminated");
                        }
                    }
                    break;
                }
            }
        }

        return info;
    }

    @Override
    public String getPodLogs(String namespace, String name, String container) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            String cmd;
            if (container != null && !container.isEmpty()) {
                cmd = String.format("kubectl logs %s -n %s -c %s --tail=1000", name, namespace, container);
            } else {
                cmd = String.format("kubectl logs %s -n %s --tail=1000", name, namespace);
            }
            return executeCommand(session, cmd, true);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy pod logs: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public String execPodCommand(String namespace, String name, String container, String command) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            String cmd;
            // Nếu không có command, mặc định là /bin/sh
            if (command == null || command.trim().isEmpty()) {
                command = "/bin/sh";
            }
            
            // Sử dụng sh -c để thực thi command phức tạp
            // Escape đơn giản: thay ' thành '\'' và wrap trong single quotes
            String escapedCommand = command.replace("'", "'\\''");
            String finalCommand = "sh -c '" + escapedCommand + "'";
            
            if (container != null && !container.isEmpty()) {
                cmd = String.format("kubectl exec -n %s %s -c %s -- %s", namespace, name, container, finalCommand);
            } else {
                cmd = String.format("kubectl exec -n %s %s -- %s", namespace, name, finalCommand);
            }
            return executeCommand(session, cmd, false);
        } catch (Exception e) {
            throw new RuntimeException("Không thể exec command vào pod: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PodResponse updatePodFromYaml(String namespace, String name, String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            // Parse YAML thành V1Pod
            V1Pod podFromYaml = (V1Pod) Yaml.load(yaml);

            // Kiểm tra namespace và name phải khớp
            if (podFromYaml.getMetadata() == null) {
                throw new RuntimeException("YAML không có metadata");
            }
            if (!name.equals(podFromYaml.getMetadata().getName())) {
                throw new RuntimeException("Tên pod trong YAML không khớp với tên yêu cầu");
            }
            if (!namespace.equals(podFromYaml.getMetadata().getNamespace())) {
                throw new RuntimeException("Namespace trong YAML không khớp với namespace yêu cầu");
            }

            // Lấy pod hiện tại để giữ lại resourceVersion và các metadata quan trọng
            V1Pod existingPod = api.readNamespacedPod(name, namespace, null);
            if (existingPod == null) {
                throw new RuntimeException("Pod không tồn tại");
            }

            // Merge metadata từ pod hiện tại
            if (existingPod.getMetadata() != null) {
                if (podFromYaml.getMetadata() == null) {
                    podFromYaml.setMetadata(new V1ObjectMeta());
                }
                podFromYaml.getMetadata().setResourceVersion(existingPod.getMetadata().getResourceVersion());
                podFromYaml.getMetadata().setUid(existingPod.getMetadata().getUid());
            }

            // Cập nhật pod
            V1Pod updated = api.replaceNamespacedPod(name, namespace, podFromYaml, null, null, null, null);
            return buildPodResponse(updated, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể cập nhật pod từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể cập nhật pod từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PodResponse createPod(PodRequest request) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1Pod pod = buildV1PodFromRequest(request);
            V1Pod created = api.createNamespacedPod(
                    request.getNamespace(),
                    pod,
                    null,
                    null,
                    null,
                    null);
            return buildPodResponse(created, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo pod: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo pod: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PodResponse createPodFromYaml(String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1Pod podFromYaml = Yaml.loadAs(yaml, V1Pod.class);
            if (podFromYaml == null || podFromYaml.getMetadata() == null
                    || podFromYaml.getMetadata().getName() == null
                    || podFromYaml.getMetadata().getNamespace() == null) {
                throw new RuntimeException("YAML thiếu name hoặc namespace");
            }

            V1Pod created = api.createNamespacedPod(
                    podFromYaml.getMetadata().getNamespace(),
                    podFromYaml,
                    null,
                    null,
                    null,
                    null);
            return buildPodResponse(created, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo pod từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo pod từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public void deletePod(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            api.deleteNamespacedPod(name, namespace, null, null, null, null, null, null);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể xóa pod: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể xóa pod: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public StatefulsetListResponse getStatefulsets() {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);

            io.kubernetes.client.openapi.models.V1StatefulSetList statefulSetList = api
                    .listStatefulSetForAllNamespaces(null, null, null, null, null, null, null, null, null, null, null);

            List<StatefulsetResponse> statefulsets = new ArrayList<>();
            if (statefulSetList.getItems() != null) {
                for (V1StatefulSet v1StatefulSet : statefulSetList.getItems()) {
                    try {
                        statefulsets.add(buildStatefulsetResponse(v1StatefulSet, session));
                    } catch (Exception ignored) {
                    }
                }
            }
            return new StatefulsetListResponse(statefulsets);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy danh sách statefulsets từ Kubernetes API: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy danh sách statefulsets: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public StatefulsetResponse getStatefulset(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);
            V1StatefulSet v1StatefulSet = api.readNamespacedStatefulSet(name, namespace, null);
            if (v1StatefulSet == null) {
                throw new RuntimeException("Statefulset không tồn tại");
            }
            return buildStatefulsetResponse(v1StatefulSet, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy statefulset: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy statefulset: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public StatefulsetResponse scaleStatefulset(String namespace, String name, int replicas) {
        if (replicas < 0) {
            throw new IllegalArgumentException("Replicas must be >= 0");
        }
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);

            V1Scale scale = new V1Scale();
            V1ObjectMeta metadata = new V1ObjectMeta();
            metadata.setName(name);
            metadata.setNamespace(namespace);
            scale.setMetadata(metadata);
            V1ScaleSpec spec = new V1ScaleSpec();
            spec.setReplicas(replicas);
            scale.setSpec(spec);

            api.replaceNamespacedStatefulSetScale(name, namespace, scale, null, null, null, null);
            V1StatefulSet updated = api.readNamespacedStatefulSet(name, namespace, null);
            return buildStatefulsetResponse(updated, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể scale statefulset: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể scale statefulset: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public StatefulsetDetailResponse getStatefulsetDetail(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api appsApi = new AppsV1Api(client);
            CoreV1Api coreApi = new CoreV1Api(client);

            V1StatefulSet v1StatefulSet = appsApi.readNamespacedStatefulSet(name, namespace, null);
            if (v1StatefulSet == null) {
                throw new RuntimeException("Statefulset không tồn tại");
            }

            StatefulsetDetailResponse detail = new StatefulsetDetailResponse();
            String id = namespace + "/" + name;
            detail.setId(id);
            detail.setName(name);
            detail.setNamespace(namespace);
            detail.setAge(calculateAge(v1StatefulSet.getMetadata().getCreationTimestamp()));

            int desired = 0;
            int ready = 0;
            if (v1StatefulSet.getSpec() != null && v1StatefulSet.getSpec().getReplicas() != null) {
                desired = v1StatefulSet.getSpec().getReplicas();
            }
            V1StatefulSetStatus status = v1StatefulSet.getStatus();
            if (status != null && status.getReadyReplicas() != null) {
                ready = status.getReadyReplicas();
            }
            detail.setReplicas(new StatefulsetResponse.ReplicasInfo(desired, ready));

            // Status calculation based on replicas and conditions
            // StatefulSet doesn't have a phase like Pods, status is determined from conditions and replicas
            String stsStatus = "running";
            
            // Check conditions first (more reliable than replicas alone)
            boolean hasErrorCondition = false;
            if (status != null && status.getConditions() != null) {
                for (V1StatefulSetCondition condition : status.getConditions()) {
                    if (condition == null || condition.getStatus() == null) {
                        continue;
                    }
                    // Any condition with status=False indicates an error
                    if ("False".equals(condition.getStatus())) {
                        hasErrorCondition = true;
                        break;
                    }
                }
            }
            
            if (hasErrorCondition) {
                stsStatus = "error";
            } else if (ready == 0 && desired > 0) {
                // No ready replicas but desired > 0 indicates an error
                stsStatus = "error";
            } else if (ready < desired) {
                // Some replicas are not ready yet (could be scaling or rolling update)
                // This is normal during StatefulSet operations, not an error
                stsStatus = "pending";
            }
            // else: ready >= desired → "running"
            
            detail.setStatus(stsStatus);

            if (v1StatefulSet.getSpec() != null) {
                detail.setService(v1StatefulSet.getSpec().getServiceName());
                if (v1StatefulSet.getSpec().getTemplate() != null
                        && v1StatefulSet.getSpec().getTemplate().getSpec() != null
                        && v1StatefulSet.getSpec().getTemplate().getSpec().getContainers() != null) {
                    List<String> containers = new ArrayList<>();
                    List<String> images = new ArrayList<>();
                    for (V1Container container : v1StatefulSet.getSpec().getTemplate().getSpec().getContainers()) {
                        if (container.getName() != null) {
                            containers.add(container.getName());
                        }
                        if (container.getImage() != null) {
                            images.add(container.getImage());
                        }
                    }
                    detail.setContainers(containers);
                    detail.setImages(images);
                }
            }

            // Tính CPU và Memory
            String labelSelectorStr = "";
            if (v1StatefulSet.getSpec() != null
                    && v1StatefulSet.getSpec().getSelector() != null
                    && v1StatefulSet.getSpec().getSelector().getMatchLabels() != null
                    && !v1StatefulSet.getSpec().getSelector().getMatchLabels().isEmpty()) {
                List<String> selectorParts = new ArrayList<>();
                for (Map.Entry<String, String> entry : v1StatefulSet.getSpec().getSelector().getMatchLabels().entrySet()) {
                    selectorParts.add(entry.getKey() + "=" + entry.getValue());
                }
                labelSelectorStr = String.join(",", selectorParts);
            }
            if (!labelSelectorStr.isEmpty()) {
                try {
                    String cmd = String.format("kubectl top pods -n %s -l %s --no-headers", namespace, labelSelectorStr);
                    String output = executeCommand(session, cmd, true);
                    if (output != null && !output.trim().isEmpty()) {
                        String[] lines = output.split("\\r?\\n");
                        double totalCpu = 0.0;
                        long totalMemory = 0L;
                        for (String line : lines) {
                            line = line.trim();
                            if (line.isEmpty()) {
                                continue;
                            }
                            String[] parts = line.split("\\s+");
                            if (parts.length >= 3) {
                                try {
                                    double cpu = parseCpuCores(parts[1]);
                                    long memory = parseMemoryBytes(parts[2]);
                                    totalCpu += cpu;
                                    totalMemory += memory;
                                } catch (NumberFormatException ex) {
                                    // Bỏ qua
                                }
                            }
                        }
                        detail.setCpu(formatCpu(totalCpu));
                        detail.setMemory(formatMemory(totalMemory));
                    } else {
                        detail.setCpu("0m");
                        detail.setMemory("0");
                    }
                } catch (Exception e) {
                    detail.setCpu("0m");
                    detail.setMemory("0");
                }
            } else {
                detail.setCpu("0m");
                detail.setMemory("0");
            }

            // Metadata
            if (v1StatefulSet.getMetadata() != null) {
                detail.setLabels(v1StatefulSet.getMetadata().getLabels());
                detail.setAnnotations(v1StatefulSet.getMetadata().getAnnotations());
                detail.setUid(v1StatefulSet.getMetadata().getUid());
                detail.setResourceVersion(v1StatefulSet.getMetadata().getResourceVersion());
                if (v1StatefulSet.getMetadata().getCreationTimestamp() != null) {
                    detail.setCreationTimestamp(v1StatefulSet.getMetadata().getCreationTimestamp().toString());
                }
            }

            // Pods
            List<StatefulsetDetailResponse.PodInfo> pods = new ArrayList<>();
            if (!labelSelectorStr.isEmpty()) {
                try {
                    V1PodList podList = coreApi.listNamespacedPod(namespace, null, null, null, null,
                            labelSelectorStr, null, null, null, null, null, null);
                    if (podList.getItems() != null) {
                        for (V1Pod pod : podList.getItems()) {
                            pods.add(buildStatefulsetPodInfo(pod));
                        }
                    }
                } catch (ApiException e) {
                    // Bỏ qua lỗi
                }
            }
            detail.setPods(pods);

            // PVCs - Lấy PVCs có tên bắt đầu bằng tên StatefulSet
            List<StatefulsetDetailResponse.PVCInfo> pvcs = new ArrayList<>();
            try {
                V1PersistentVolumeClaimList pvcList = coreApi.listNamespacedPersistentVolumeClaim(namespace, null, null, null, null,
                        null, null, null, null, null, null, null);
                if (pvcList.getItems() != null) {
                    for (V1PersistentVolumeClaim pvc : pvcList.getItems()) {
                        if (pvc.getMetadata() != null && pvc.getMetadata().getName() != null
                                && pvc.getMetadata().getName().startsWith(name + "-")) {
                            pvcs.add(buildPVCInfo(pvc));
                        }
                    }
                }
            } catch (ApiException e) {
                // Bỏ qua lỗi
            }
            detail.setPvcs(pvcs);

            // VolumeClaimTemplates
            List<StatefulsetDetailResponse.VolumeClaimTemplateInfo> volumeClaimTemplates = new ArrayList<>();
            if (v1StatefulSet.getSpec() != null
                    && v1StatefulSet.getSpec().getVolumeClaimTemplates() != null) {
                for (V1PersistentVolumeClaim template : v1StatefulSet.getSpec().getVolumeClaimTemplates()) {
                    StatefulsetDetailResponse.VolumeClaimTemplateInfo info = new StatefulsetDetailResponse.VolumeClaimTemplateInfo();
                    if (template.getMetadata() != null) {
                        info.setName(template.getMetadata().getName());
                    }
                    if (template.getSpec() != null) {
                        if (template.getSpec().getStorageClassName() != null) {
                            info.setStorageClass(template.getSpec().getStorageClassName());
                        }
                        if (template.getSpec().getAccessModes() != null && !template.getSpec().getAccessModes().isEmpty()) {
                            info.setAccessMode(template.getSpec().getAccessModes().get(0));
                        }
                        if (template.getSpec().getResources() != null
                                && template.getSpec().getResources().getRequests() != null
                                && template.getSpec().getResources().getRequests().get("storage") != null) {
                            info.setSize(template.getSpec().getResources().getRequests().get("storage").toString());
                        }
                    }
                    volumeClaimTemplates.add(info);
                }
            }
            detail.setVolumeClaimTemplates(volumeClaimTemplates);

            // Events - Sử dụng kubectl để lấy events vì Kubernetes Java Client không có V1Event
            List<StatefulsetDetailResponse.EventInfo> events = new ArrayList<>();
            try {
                String cmd = String.format("kubectl get events -n %s --field-selector involvedObject.name=%s,involvedObject.kind=StatefulSet --sort-by='.lastTimestamp' -o json", namespace, name);
                String output = executeCommand(session, cmd, true);
                if (output != null && !output.trim().isEmpty()) {
                    // Parse JSON output để lấy events (có thể sử dụng Jackson hoặc Gson)
                    // Tạm thời bỏ qua parsing JSON, chỉ lấy events bằng kubectl get events
                    // Có thể implement sau nếu cần
                }
            } catch (Exception e) {
                // Bỏ qua lỗi
            }
            detail.setEvents(events);

            // Conditions
            List<StatefulsetDetailResponse.ConditionInfo> conditions = new ArrayList<>();
            if (status != null && status.getConditions() != null) {
                for (V1StatefulSetCondition condition : status.getConditions()) {
                    StatefulsetDetailResponse.ConditionInfo conditionInfo = new StatefulsetDetailResponse.ConditionInfo();
                    conditionInfo.setType(condition.getType());
                    conditionInfo.setStatus(condition.getStatus());
                    conditionInfo.setReason(condition.getReason());
                    conditionInfo.setMessage(condition.getMessage());
                    if (condition.getLastTransitionTime() != null) {
                        conditionInfo.setLastTransitionTime(condition.getLastTransitionTime().toString());
                    }
                    // V1StatefulSetCondition không có getLastUpdateTime(), chỉ có getLastTransitionTime()
                    conditionInfo.setLastUpdateTime(conditionInfo.getLastTransitionTime());
                    conditions.add(conditionInfo);
                }
            }
            detail.setConditions(conditions);

            // YAML
            try {
                detail.setYaml(Yaml.dump(v1StatefulSet));
            } catch (Exception e) {
                detail.setYaml("");
            }

            return detail;
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy chi tiết statefulset: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chi tiết statefulset: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public StatefulsetResponse createStatefulset(StatefulsetRequest request) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);

            V1StatefulSet statefulset = buildV1StatefulsetFromRequest(request);
            V1StatefulSet created = api.createNamespacedStatefulSet(
                    request.getNamespace(),
                    statefulset,
                    null,
                    null,
                    null,
                    null);
            return buildStatefulsetResponse(created, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo statefulset: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo statefulset: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public StatefulsetResponse createStatefulsetFromYaml(String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);

            V1StatefulSet statefulsetFromYaml = Yaml.loadAs(yaml, V1StatefulSet.class);
            if (statefulsetFromYaml == null || statefulsetFromYaml.getMetadata() == null
                    || statefulsetFromYaml.getMetadata().getName() == null
                    || statefulsetFromYaml.getMetadata().getNamespace() == null) {
                throw new RuntimeException("YAML thiếu name hoặc namespace");
            }

            V1StatefulSet created = api.createNamespacedStatefulSet(
                    statefulsetFromYaml.getMetadata().getNamespace(),
                    statefulsetFromYaml,
                    null,
                    null,
                    null,
                    null);
            return buildStatefulsetResponse(created, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo statefulset từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo statefulset từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public StatefulsetResponse updateStatefulsetFromYaml(String namespace, String name, String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);

            V1StatefulSet statefulsetFromYaml = Yaml.loadAs(yaml, V1StatefulSet.class);
            if (statefulsetFromYaml == null) {
                throw new RuntimeException("YAML không hợp lệ");
            }

            if (statefulsetFromYaml.getMetadata() == null) {
                statefulsetFromYaml.setMetadata(new V1ObjectMeta());
            }
            if (!name.equals(statefulsetFromYaml.getMetadata().getName())) {
                throw new RuntimeException("Tên trong YAML không khớp với tên statefulset");
            }
            if (!namespace.equals(statefulsetFromYaml.getMetadata().getNamespace())) {
                throw new RuntimeException("Namespace trong YAML không khớp với namespace statefulset");
            }

            V1StatefulSet existing = api.readNamespacedStatefulSet(name, namespace, null);
            if (existing == null) {
                throw new RuntimeException("Statefulset không tồn tại");
            }
            if (existing.getMetadata() != null) {
                statefulsetFromYaml.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
                statefulsetFromYaml.getMetadata().setUid(existing.getMetadata().getUid());
            }

            V1StatefulSet updated = api.replaceNamespacedStatefulSet(name, namespace, statefulsetFromYaml, null, null, null, null);
            return buildStatefulsetResponse(updated, session);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể cập nhật statefulset từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể cập nhật statefulset từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public void deleteStatefulset(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            AppsV1Api api = new AppsV1Api(client);
            api.deleteNamespacedStatefulSet(name, namespace, null, null, null, null, null, null);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể xóa statefulset: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể xóa statefulset: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    private StatefulsetDetailResponse.PodInfo buildStatefulsetPodInfo(V1Pod pod) {
        StatefulsetDetailResponse.PodInfo info = new StatefulsetDetailResponse.PodInfo();
        if (pod.getMetadata() != null) {
            info.setName(pod.getMetadata().getName());
            info.setNamespace(pod.getMetadata().getNamespace());
            info.setAge(calculateAge(pod.getMetadata().getCreationTimestamp()));
        }
        if (pod.getStatus() != null) {
            if (pod.getStatus().getPhase() != null) {
                info.setStatus(pod.getStatus().getPhase());
            }
            if (pod.getSpec() != null && pod.getSpec().getNodeName() != null) {
                info.setNode(pod.getSpec().getNodeName());
            }
            if (pod.getStatus().getPodIP() != null) {
                info.setIp(pod.getStatus().getPodIP());
            }
            int ready = 0;
            int total = 0;
            int restarts = 0;
            if (pod.getStatus().getContainerStatuses() != null) {
                total = pod.getStatus().getContainerStatuses().size();
                for (V1ContainerStatus status : pod.getStatus().getContainerStatuses()) {
                    if (status.getReady() != null && status.getReady()) {
                        ready++;
                    }
                    if (status.getRestartCount() != null) {
                        restarts += status.getRestartCount();
                    }
                }
            }
            info.setReady(ready + "/" + total);
            info.setRestarts(restarts);
        }
        return info;
    }

    private StatefulsetDetailResponse.PVCInfo buildPVCInfo(V1PersistentVolumeClaim pvc) {
        StatefulsetDetailResponse.PVCInfo info = new StatefulsetDetailResponse.PVCInfo();
        if (pvc.getMetadata() != null) {
            info.setName(pvc.getMetadata().getName());
            info.setNamespace(pvc.getMetadata().getNamespace());
            info.setAge(calculateAge(pvc.getMetadata().getCreationTimestamp()));
        }
        if (pvc.getStatus() != null) {
            info.setStatus(pvc.getStatus().getPhase());
            // V1PersistentVolumeClaimStatus không có getVolumeName() trực tiếp
            // Cần lấy từ spec.volumeName hoặc từ status
            if (pvc.getSpec() != null && pvc.getSpec().getVolumeName() != null) {
                info.setVolume(pvc.getSpec().getVolumeName());
            }
            if (pvc.getStatus().getCapacity() != null && pvc.getStatus().getCapacity().get("storage") != null) {
                info.setCapacity(pvc.getStatus().getCapacity().get("storage").toString());
            }
        }
        if (pvc.getSpec() != null) {
            if (pvc.getSpec().getStorageClassName() != null) {
                info.setStorageClass(pvc.getSpec().getStorageClassName());
            }
        }
        return info;
    }

    private DeploymentResponse buildDeploymentResponse(V1Deployment v1Deployment, Session session) {
        if (v1Deployment == null || v1Deployment.getMetadata() == null) {
            return null;
        }
        DeploymentResponse deployment = new DeploymentResponse();
        String namespace = v1Deployment.getMetadata().getNamespace();
        String name = v1Deployment.getMetadata().getName();
        deployment.setId(namespace + "/" + name);
        deployment.setName(name);
        deployment.setNamespace(namespace);
        deployment.setAge(calculateAge(v1Deployment.getMetadata().getCreationTimestamp()));

        int desired = 0;
        int ready = 0;
        int updated = 0;
        int available = 0;

        if (v1Deployment.getSpec() != null && v1Deployment.getSpec().getReplicas() != null) {
            desired = v1Deployment.getSpec().getReplicas();
        }
        V1DeploymentStatus status = v1Deployment.getStatus();
        if (status != null) {
            ready = status.getReadyReplicas() != null ? status.getReadyReplicas() : 0;
            updated = status.getUpdatedReplicas() != null ? status.getUpdatedReplicas() : 0;
            available = status.getAvailableReplicas() != null ? status.getAvailableReplicas() : 0;
        }
        DeploymentResponse.ReplicasInfo replicas = new DeploymentResponse.ReplicasInfo(desired, ready, updated,
                available);
        deployment.setReplicas(replicas);

        // Status calculation based on replicas and conditions
        // Deployment doesn't have a phase like Pods, status is determined from conditions and replicas
        String depStatus = "running";
        
        // Check conditions first (more reliable than replicas alone)
        boolean hasErrorCondition = false;
        if (status != null && status.getConditions() != null) {
            for (V1DeploymentCondition condition : status.getConditions()) {
                if (condition == null || condition.getType() == null || condition.getStatus() == null) {
                    continue;
                }
                String conditionType = condition.getType();
                String conditionStatus = condition.getStatus();
                
                // Check for error conditions:
                // - ReplicaFailure: indicates pod creation/update failures
                // - Progressing=False: deployment is not progressing
                // - Available=False: deployment has no available replicas
                if ("ReplicaFailure".equals(conditionType) && "True".equals(conditionStatus)) {
                    hasErrorCondition = true;
                    break;
                }
                if ("False".equals(conditionStatus) && 
                    ("Progressing".equals(conditionType) || "Available".equals(conditionType))) {
                    hasErrorCondition = true;
                    break;
                }
            }
        }
        
        if (hasErrorCondition) {
            depStatus = "error";
        } else if (ready == 0 && desired > 0) {
            // No ready replicas but desired > 0 indicates an error
            depStatus = "error";
        } else if (ready < desired) {
            // Some replicas are not ready yet (could be rolling update or scaling)
            depStatus = "pending";
        }
        // else: ready >= desired → "running"
        
        deployment.setStatus(depStatus);

        // Chỉ lấy image đầu tiên cho danh sách
        String firstImage = "";
        String labelSelectorStr = "";
        if (v1Deployment.getSpec() != null
                && v1Deployment.getSpec().getTemplate() != null
                && v1Deployment.getSpec().getTemplate().getSpec() != null
                && v1Deployment.getSpec().getTemplate().getSpec().getContainers() != null
                && !v1Deployment.getSpec().getTemplate().getSpec().getContainers().isEmpty()) {
            V1Container firstContainer = v1Deployment.getSpec().getTemplate().getSpec().getContainers().get(0);
            if (firstContainer.getImage() != null) {
                firstImage = firstContainer.getImage();
            }
        }
        deployment.setImage(firstImage);

        // Lấy labelSelector chỉ để tính CPU/Memory, không trả về trong response
        if (v1Deployment.getSpec() != null && v1Deployment.getSpec().getSelector() != null) {
            V1LabelSelector labelSelector = v1Deployment.getSpec().getSelector();
            if (labelSelector.getMatchLabels() != null && !labelSelector.getMatchLabels().isEmpty()) {
                List<String> selectorParts = new ArrayList<>();
                for (Map.Entry<String, String> entry : labelSelector.getMatchLabels().entrySet()) {
                    selectorParts.add(entry.getKey() + "=" + entry.getValue());
                }
                labelSelectorStr = String.join(",", selectorParts);
            }
        }

        // Tính CPU và Memory từ kubectl top pods
        if (session != null && namespace != null && !labelSelectorStr.isEmpty()) {
            try {
                String cmd = String.format("kubectl top pods -n %s -l %s --no-headers", namespace, labelSelectorStr);
                String output = executeCommand(session, cmd, true);
                if (output != null && !output.trim().isEmpty()) {
                    String[] lines = output.split("\\r?\\n");
                    double totalCpu = 0.0;
                    long totalMemory = 0L;
                    for (String line : lines) {
                        line = line.trim();
                        if (line.isEmpty()) {
                            continue;
                        }
                        String[] parts = line.split("\\s+");
                        if (parts.length >= 3) {
                            try {
                                double cpu = parseCpuCores(parts[1]);
                                long memory = parseMemoryBytes(parts[2]);
                                totalCpu += cpu;
                                totalMemory += memory;
                            } catch (NumberFormatException ex) {
                                // Bỏ qua dòng không parse được
                            }
                        }
                    }
                    deployment.setCpu(formatCpu(totalCpu));
                    deployment.setMemory(formatMemory(totalMemory));
                } else {
                    deployment.setCpu("0m");
                    deployment.setMemory("0");
                }
            } catch (Exception e) {
                deployment.setCpu("0m");
                deployment.setMemory("0");
            }
        } else {
            deployment.setCpu("0m");
            deployment.setMemory("0");
        }

        return deployment;
    }

    /**
     * Extract pod status from V1PodStatus, combining pod phase with container states
     * Similar to kubectl: shows container waiting/terminated reasons when pod phase is Pending/Failed
     */
    private String extractPodStatus(V1PodStatus status) {
        if (status == null || status.getPhase() == null) {
            return "Unknown";
        }
        
        String phase = status.getPhase();
        
        // If phase is Running, Succeeded, or Failed, use it directly
        if ("Running".equalsIgnoreCase(phase) || "Succeeded".equalsIgnoreCase(phase)) {
            return phase;
        }
        
        // For Pending/Failed/Unknown phases, check container states for more details
        if (status.getContainerStatuses() != null && !status.getContainerStatuses().isEmpty()) {
            for (V1ContainerStatus containerStatus : status.getContainerStatuses()) {
                if (containerStatus.getState() != null) {
                    // Check waiting state (CrashLoopBackOff, ImagePullBackOff, etc.)
                    if (containerStatus.getState().getWaiting() != null) {
                        String reason = containerStatus.getState().getWaiting().getReason();
                        if (reason != null && !reason.isEmpty()) {
                            return reason; // Return waiting reason (CrashLoopBackOff, ImagePullBackOff, etc.)
                        }
                    }
                    // Check terminated state (Error, OOMKilled, etc.)
                    if (containerStatus.getState().getTerminated() != null) {
                        String reason = containerStatus.getState().getTerminated().getReason();
                        if (reason != null && !reason.isEmpty()) {
                            return reason; // Return terminated reason (Error, OOMKilled, etc.)
                        }
                    }
                }
            }
        }
        
        // Fallback to pod phase
        return phase;
    }

    private PodResponse buildPodResponse(V1Pod v1Pod, Session session) {
        if (v1Pod == null || v1Pod.getMetadata() == null) {
            return null;
        }
        PodResponse pod = new PodResponse();
        String namespace = v1Pod.getMetadata().getNamespace();
        String name = v1Pod.getMetadata().getName();
        pod.setId(namespace + "/" + name);
        pod.setName(name);
        pod.setNamespace(namespace);
        pod.setAge(calculateAge(v1Pod.getMetadata().getCreationTimestamp()));

        V1PodStatus status = v1Pod.getStatus();
        if (status != null) {
            // Extract status from Kubernetes (pod phase + container states)
            pod.setStatus(extractPodStatus(status));
            if (status.getPodIP() != null) {
                pod.setIp(status.getPodIP());
            }
            int ready = 0;
            int total = 0;
            int restarts = 0;
            if (status.getContainerStatuses() != null) {
                total = status.getContainerStatuses().size();
                for (V1ContainerStatus containerStatus : status.getContainerStatuses()) {
                    if (Boolean.TRUE.equals(containerStatus.getReady())) {
                        ready++;
                    }
                    if (containerStatus.getRestartCount() != null) {
                        restarts += containerStatus.getRestartCount();
                    }
                }
            }
            PodResponse.ReadyInfo readyInfo = new PodResponse.ReadyInfo(ready, total);
            pod.setReady(readyInfo);
            pod.setRestarts(restarts);
        }
        if (v1Pod.getSpec() != null && v1Pod.getSpec().getNodeName() != null) {
            pod.setNode(v1Pod.getSpec().getNodeName());
        }

        // Tính CPU và Memory từ kubectl top pod
        if (session != null && namespace != null && name != null) {
            try {
                String cmd = String.format("kubectl top pod %s -n %s --no-headers", name, namespace);
                String output = executeCommand(session, cmd, true);
                if (output != null && !output.trim().isEmpty()) {
                    String[] parts = output.trim().split("\\s+");
                    if (parts.length >= 3) {
                        try {
                            double cpu = parseCpuCores(parts[1]);
                            long memory = parseMemoryBytes(parts[2]);
                            pod.setCpu(formatCpu(cpu));
                            pod.setMemory(formatMemory(memory));
                        } catch (NumberFormatException ex) {
                            // Bỏ qua nếu không parse được
                            pod.setCpu("0m");
                            pod.setMemory("0");
                        }
                    } else {
                        pod.setCpu("0m");
                        pod.setMemory("0");
                    }
                } else {
                    pod.setCpu("0m");
                    pod.setMemory("0");
                }
            } catch (Exception e) {
                pod.setCpu("0m");
                pod.setMemory("0");
            }
        } else {
            pod.setCpu("0m");
            pod.setMemory("0");
        }

        return pod;
    }

    private StatefulsetResponse buildStatefulsetResponse(V1StatefulSet v1StatefulSet, Session session) {
        if (v1StatefulSet == null || v1StatefulSet.getMetadata() == null) {
            return null;
        }
        StatefulsetResponse statefulset = new StatefulsetResponse();
        String namespace = v1StatefulSet.getMetadata().getNamespace();
        String name = v1StatefulSet.getMetadata().getName();
        statefulset.setId(namespace + "/" + name);
        statefulset.setName(name);
        statefulset.setNamespace(namespace);
        statefulset.setAge(calculateAge(v1StatefulSet.getMetadata().getCreationTimestamp()));

        int desired = 0;
        int ready = 0;
        if (v1StatefulSet.getSpec() != null && v1StatefulSet.getSpec().getReplicas() != null) {
            desired = v1StatefulSet.getSpec().getReplicas();
        }
        V1StatefulSetStatus status = v1StatefulSet.getStatus();
        if (status != null && status.getReadyReplicas() != null) {
            ready = status.getReadyReplicas();
        }
        statefulset.setReplicas(new StatefulsetResponse.ReplicasInfo(desired, ready));

        // Status calculation based on replicas and conditions
        // StatefulSet doesn't have a phase like Pods, status is determined from conditions and replicas
        String stsStatus = "running";
        
        // Check conditions first (more reliable than replicas alone)
        boolean hasErrorCondition = false;
        if (status != null && status.getConditions() != null) {
            for (V1StatefulSetCondition condition : status.getConditions()) {
                if (condition == null || condition.getStatus() == null) {
                    continue;
                }
                // Any condition with status=False indicates an error
                if ("False".equals(condition.getStatus())) {
                    hasErrorCondition = true;
                    break;
                }
            }
        }
        
        if (hasErrorCondition) {
            stsStatus = "error";
        } else if (ready == 0 && desired > 0) {
            // No ready replicas but desired > 0 indicates an error
            stsStatus = "error";
        } else if (ready < desired) {
            // Some replicas are not ready yet (could be scaling or rolling update)
            // This is normal during StatefulSet operations, not an error
            stsStatus = "pending";
        }
        // else: ready >= desired → "running"
        
        statefulset.setStatus(stsStatus);

        String labelSelectorStr = "";
        if (v1StatefulSet.getSpec() != null) {
            statefulset.setService(v1StatefulSet.getSpec().getServiceName());
            if (v1StatefulSet.getSpec().getSelector() != null
                    && v1StatefulSet.getSpec().getSelector().getMatchLabels() != null
                    && !v1StatefulSet.getSpec().getSelector().getMatchLabels().isEmpty()) {
                List<String> selectorParts = new ArrayList<>();
                for (Map.Entry<String, String> entry : v1StatefulSet.getSpec().getSelector().getMatchLabels().entrySet()) {
                    selectorParts.add(entry.getKey() + "=" + entry.getValue());
                }
                labelSelectorStr = String.join(",", selectorParts);
            }
            if (v1StatefulSet.getSpec().getTemplate() != null
                    && v1StatefulSet.getSpec().getTemplate().getSpec() != null
                    && v1StatefulSet.getSpec().getTemplate().getSpec().getContainers() != null) {
                List<String> containers = new ArrayList<>();
                List<String> images = new ArrayList<>();
                for (V1Container container : v1StatefulSet.getSpec().getTemplate().getSpec().getContainers()) {
                    if (container.getName() != null) {
                        containers.add(container.getName());
                    }
                    if (container.getImage() != null) {
                        images.add(container.getImage());
                    }
                }
                statefulset.setContainers(containers);
                statefulset.setImages(images);
            }
        }

        // Tính CPU và Memory từ kubectl top pods
        if (session != null && namespace != null && !labelSelectorStr.isEmpty()) {
            try {
                String cmd = String.format("kubectl top pods -n %s -l %s --no-headers", namespace, labelSelectorStr);
                String output = executeCommand(session, cmd, true);
                if (output != null && !output.trim().isEmpty()) {
                    String[] lines = output.split("\\r?\\n");
                    double totalCpu = 0.0;
                    long totalMemory = 0L;
                    for (String line : lines) {
                        line = line.trim();
                        if (line.isEmpty()) {
                            continue;
                        }
                        String[] parts = line.split("\\s+");
                        if (parts.length >= 3) {
                            try {
                                double cpu = parseCpuCores(parts[1]);
                                long memory = parseMemoryBytes(parts[2]);
                                totalCpu += cpu;
                                totalMemory += memory;
                            } catch (NumberFormatException ex) {
                                // Bỏ qua dòng không parse được
                            }
                        }
                    }
                    statefulset.setCpu(formatCpu(totalCpu));
                    statefulset.setMemory(formatMemory(totalMemory));
                } else {
                    statefulset.setCpu("0m");
                    statefulset.setMemory("0");
                }
            } catch (Exception e) {
                statefulset.setCpu("0m");
                statefulset.setMemory("0");
            }
        } else {
            statefulset.setCpu("0m");
            statefulset.setMemory("0");
        }

        return statefulset;
    }

    private V1Deployment buildV1DeploymentFromRequest(DeploymentRequest request) {
        V1Deployment deployment = new V1Deployment();
        deployment.setApiVersion("apps/v1");
        deployment.setKind("Deployment");

        // Metadata
        V1ObjectMeta metadata = new V1ObjectMeta();
        metadata.setName(request.getName());
        metadata.setNamespace(request.getNamespace());
        if (request.getLabels() != null && !request.getLabels().isEmpty()) {
            metadata.setLabels(new HashMap<>(request.getLabels()));
        }
        deployment.setMetadata(metadata);

        // Spec
        V1DeploymentSpec spec = new V1DeploymentSpec();
        spec.setReplicas(request.getReplicas() != null ? request.getReplicas() : 1);

        // Selector
        if (request.getSelector() != null && !request.getSelector().isEmpty()) {
            V1LabelSelector selector = new V1LabelSelector();
            selector.setMatchLabels(new HashMap<>(request.getSelector()));
            spec.setSelector(selector);
        }

        // Template
        V1PodTemplateSpec template = new V1PodTemplateSpec();
        V1ObjectMeta templateMetadata = new V1ObjectMeta();
        if (request.getSelector() != null && !request.getSelector().isEmpty()) {
            templateMetadata.setLabels(new HashMap<>(request.getSelector()));
        }
        template.setMetadata(templateMetadata);

        V1PodSpec podSpec = new V1PodSpec();
        List<V1Container> containers = new ArrayList<>();
        if (request.getContainers() != null) {
            for (DeploymentRequest.ContainerRequest containerReq : request.getContainers()) {
                V1Container container = new V1Container();
                container.setName(containerReq.getName());
                container.setImage(containerReq.getImage());
                if (containerReq.getImagePullPolicy() != null) {
                    container.setImagePullPolicy(containerReq.getImagePullPolicy());
                }

                // Ports
                if (containerReq.getPorts() != null && !containerReq.getPorts().isEmpty()) {
                    List<V1ContainerPort> ports = new ArrayList<>();
                    for (DeploymentRequest.PortRequest portReq : containerReq.getPorts()) {
                        V1ContainerPort port = new V1ContainerPort();
                        if (portReq.getName() != null) {
                            port.setName(portReq.getName());
                        }
                        if (portReq.getContainerPort() != null) {
                            port.setContainerPort(portReq.getContainerPort());
                        }
                        if (portReq.getProtocol() != null) {
                            port.setProtocol(portReq.getProtocol());
                        }
                        ports.add(port);
                    }
                    container.setPorts(ports);
                }

                // Resources
                if (containerReq.getResources() != null) {
                    V1ResourceRequirements resources = new V1ResourceRequirements();
                    if (containerReq.getResources().getRequests() != null) {
                        Map<String, Quantity> requests = new HashMap<>();
                        for (Map.Entry<String, String> entry : containerReq.getResources().getRequests().entrySet()) {
                            requests.put(entry.getKey(), new Quantity(entry.getValue()));
                        }
                        resources.setRequests(requests);
                    }
                    if (containerReq.getResources().getLimits() != null) {
                        Map<String, Quantity> limits = new HashMap<>();
                        for (Map.Entry<String, String> entry : containerReq.getResources().getLimits().entrySet()) {
                            limits.put(entry.getKey(), new Quantity(entry.getValue()));
                        }
                        resources.setLimits(limits);
                    }
                    container.setResources(resources);
                }

                containers.add(container);
            }
        }
        podSpec.setContainers(containers);
        template.setSpec(podSpec);
        spec.setTemplate(template);
        deployment.setSpec(spec);

        return deployment;
    }

    private V1Pod buildV1PodFromRequest(PodRequest request) {
        V1Pod pod = new V1Pod();
        pod.setApiVersion("v1");
        pod.setKind("Pod");

        // Metadata
        V1ObjectMeta metadata = new V1ObjectMeta();
        metadata.setName(request.getName());
        metadata.setNamespace(request.getNamespace());
        if (request.getLabels() != null && !request.getLabels().isEmpty()) {
            metadata.setLabels(new HashMap<>(request.getLabels()));
        }
        pod.setMetadata(metadata);

        // Spec
        V1PodSpec spec = new V1PodSpec();
        if (request.getNodeName() != null && !request.getNodeName().isEmpty()) {
            spec.setNodeName(request.getNodeName());
        }

        // Containers
        List<V1Container> containers = new ArrayList<>();
        if (request.getContainers() != null) {
            for (PodRequest.ContainerRequest containerReq : request.getContainers()) {
                V1Container container = new V1Container();
                container.setName(containerReq.getName());
                container.setImage(containerReq.getImage());
                if (containerReq.getImagePullPolicy() != null) {
                    container.setImagePullPolicy(containerReq.getImagePullPolicy());
                }

                // Ports
                if (containerReq.getPorts() != null && !containerReq.getPorts().isEmpty()) {
                    List<V1ContainerPort> ports = new ArrayList<>();
                    for (PodRequest.PortRequest portReq : containerReq.getPorts()) {
                        V1ContainerPort port = new V1ContainerPort();
                        if (portReq.getName() != null) {
                            port.setName(portReq.getName());
                        }
                        if (portReq.getContainerPort() != null) {
                            port.setContainerPort(portReq.getContainerPort());
                        }
                        if (portReq.getProtocol() != null) {
                            port.setProtocol(portReq.getProtocol());
                        }
                        ports.add(port);
                    }
                    container.setPorts(ports);
                }

                // Resources
                if (containerReq.getResources() != null) {
                    V1ResourceRequirements resources = new V1ResourceRequirements();
                    if (containerReq.getResources().getRequests() != null) {
                        Map<String, Quantity> requests = new HashMap<>();
                        for (Map.Entry<String, String> entry : containerReq.getResources().getRequests().entrySet()) {
                            requests.put(entry.getKey(), new Quantity(entry.getValue()));
                        }
                        resources.setRequests(requests);
                    }
                    if (containerReq.getResources().getLimits() != null) {
                        Map<String, Quantity> limits = new HashMap<>();
                        for (Map.Entry<String, String> entry : containerReq.getResources().getLimits().entrySet()) {
                            limits.put(entry.getKey(), new Quantity(entry.getValue()));
                        }
                        resources.setLimits(limits);
                    }
                    container.setResources(resources);
                }

                containers.add(container);
            }
        }
        spec.setContainers(containers);
        pod.setSpec(spec);

        return pod;
    }

    private V1StatefulSet buildV1StatefulsetFromRequest(StatefulsetRequest request) {
        V1StatefulSet statefulset = new V1StatefulSet();
        statefulset.setApiVersion("apps/v1");
        statefulset.setKind("StatefulSet");

        // Metadata
        V1ObjectMeta metadata = new V1ObjectMeta();
        metadata.setName(request.getName());
        metadata.setNamespace(request.getNamespace());
        if (request.getLabels() != null && !request.getLabels().isEmpty()) {
            metadata.setLabels(new HashMap<>(request.getLabels()));
        }
        statefulset.setMetadata(metadata);

        // Spec
        V1StatefulSetSpec spec = new V1StatefulSetSpec();
        spec.setReplicas(request.getReplicas() != null ? request.getReplicas() : 1);
        if (request.getServiceName() != null && !request.getServiceName().isEmpty()) {
            spec.setServiceName(request.getServiceName());
        }

        // Selector
        if (request.getSelector() != null && !request.getSelector().isEmpty()) {
            V1LabelSelector selector = new V1LabelSelector();
            selector.setMatchLabels(new HashMap<>(request.getSelector()));
            spec.setSelector(selector);
        }

        // Template
        V1PodTemplateSpec template = new V1PodTemplateSpec();
        V1ObjectMeta templateMetadata = new V1ObjectMeta();
        if (request.getSelector() != null && !request.getSelector().isEmpty()) {
            templateMetadata.setLabels(new HashMap<>(request.getSelector()));
        }
        template.setMetadata(templateMetadata);

        V1PodSpec podSpec = new V1PodSpec();
        List<V1Container> containers = new ArrayList<>();
        if (request.getContainers() != null) {
            for (StatefulsetRequest.ContainerRequest containerReq : request.getContainers()) {
                V1Container container = new V1Container();
                container.setName(containerReq.getName());
                container.setImage(containerReq.getImage());
                if (containerReq.getImagePullPolicy() != null) {
                    container.setImagePullPolicy(containerReq.getImagePullPolicy());
                }

                // Ports
                if (containerReq.getPorts() != null && !containerReq.getPorts().isEmpty()) {
                    List<V1ContainerPort> ports = new ArrayList<>();
                    for (StatefulsetRequest.PortRequest portReq : containerReq.getPorts()) {
                        V1ContainerPort port = new V1ContainerPort();
                        if (portReq.getName() != null) {
                            port.setName(portReq.getName());
                        }
                        if (portReq.getContainerPort() != null) {
                            port.setContainerPort(portReq.getContainerPort());
                        }
                        if (portReq.getProtocol() != null) {
                            port.setProtocol(portReq.getProtocol());
                        }
                        ports.add(port);
                    }
                    container.setPorts(ports);
                }

                // Resources
                if (containerReq.getResources() != null) {
                    V1ResourceRequirements resources = new V1ResourceRequirements();
                    if (containerReq.getResources().getRequests() != null) {
                        Map<String, Quantity> requests = new HashMap<>();
                        for (Map.Entry<String, String> entry : containerReq.getResources().getRequests().entrySet()) {
                            requests.put(entry.getKey(), new Quantity(entry.getValue()));
                        }
                        resources.setRequests(requests);
                    }
                    if (containerReq.getResources().getLimits() != null) {
                        Map<String, Quantity> limits = new HashMap<>();
                        for (Map.Entry<String, String> entry : containerReq.getResources().getLimits().entrySet()) {
                            limits.put(entry.getKey(), new Quantity(entry.getValue()));
                        }
                        resources.setLimits(limits);
                    }
                    container.setResources(resources);
                }

                containers.add(container);
            }
        }
        podSpec.setContainers(containers);
        template.setSpec(podSpec);
        spec.setTemplate(template);
        statefulset.setSpec(spec);

        return statefulset;
    }
}

