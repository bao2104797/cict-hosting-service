package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.Session;
import my_spring_app.my_spring_app.dto.reponse.NamespaceDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceListResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceResponse;
import my_spring_app.my_spring_app.dto.request.NamespaceRequest;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.service.AdminNamespaceService;
import org.springframework.stereotype.Service;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Namespace;
import io.kubernetes.client.openapi.models.V1NamespaceSpec;
import io.kubernetes.client.openapi.models.V1NamespaceCondition;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1NamespaceStatus;
import io.kubernetes.client.openapi.models.V1DeleteOptions;
import io.kubernetes.client.util.Yaml;
import io.kubernetes.client.util.Config;
import io.kubernetes.client.openapi.Configuration;
import java.io.File;
import java.io.FileWriter;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service xử lý các operations liên quan đến Kubernetes Namespaces.
 */
@Service
public class AdminNamespaceServiceImpl extends BaseKubernetesService implements AdminNamespaceService {

    private final ServerRepository serverRepository;

    public AdminNamespaceServiceImpl(ServerRepository serverRepository) {
        this.serverRepository = serverRepository;
    }

    @Override
    public NamespaceListResponse getNamespaces() {
        // Lấy thông tin server MASTER
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session session = null;
        try {
            // Kết nối SSH đến MASTER server để lấy kubeconfig
            session = createSession(masterServer);
            
            // Tạo Kubernetes client từ kubeconfig
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            
            List<NamespaceResponse> namespaces = new ArrayList<>();
            
            // Lấy danh sách namespaces
            try {
                io.kubernetes.client.openapi.models.V1NamespaceList namespaceList = api.listNamespace(
                        null, // allowWatchBookmarks
                        null, // _continue
                        null, // fieldSelector
                        null, // labelSelector
                        null, // limit
                        null, // pretty
                        null, // resourceVersion
                        null, // resourceVersionMatch
                        null, // sendInitialEvents
                        null, // timeoutSeconds
                        null // watch
                );
                
                if (namespaceList.getItems() == null) {
                    return new NamespaceListResponse(new ArrayList<>());
                }
                
                // Parse từng namespace
                for (V1Namespace v1Namespace : namespaceList.getItems()) {
                    try {
                        NamespaceResponse namespace = new NamespaceResponse();
                        
                        // Basic info
                        String name = v1Namespace.getMetadata().getName();
                        namespace.setId(name);
                        namespace.setName(name);
                        
                        // Age từ creationTimestamp
                        OffsetDateTime creationTimestamp = v1Namespace.getMetadata().getCreationTimestamp();
                        namespace.setAge(calculateAge(creationTimestamp));
                        
                        // Status từ status.phase
                        V1NamespaceStatus status = v1Namespace.getStatus();
                        String phase = (status != null && status.getPhase() != null) 
                                ? status.getPhase() 
                                : "Active";
                        
                        if ("Active".equalsIgnoreCase(phase)) {
                            namespace.setStatus("active");
                        } else {
                            namespace.setStatus("terminating");
                        }
                        
                        // Labels không cần thiết cho danh sách, chỉ cần trong chi tiết
                        namespace.setLabels(new HashMap<>());
                        
                        // Đếm số pods trong namespace này
                        try {
                            io.kubernetes.client.openapi.models.V1PodList podList = api.listNamespacedPod(
                                    name, // namespace
                                    null, // pretty
                                    null, // allowWatchBookmarks
                                    null, // _continue
                                    null, // fieldSelector
                                    null, // labelSelector
                                    null, // limit
                                    null, // resourceVersion
                                    null, // resourceVersionMatch
                                    null, // sendInitialEvents
                                    null, // timeoutSeconds
                                    null // watch
                            );
                            
                            int podCount = 0;
                            if (podList != null && podList.getItems() != null) {
                                podCount = podList.getItems().size();
                            }
                            namespace.setPodCount(podCount);
                        } catch (Exception e) {
                            // Nếu không lấy được pods, để giá trị mặc định
                            namespace.setPodCount(0);
                        }
                        
                        // Tính CPU và Memory usage cho namespace này
                        try {
                            String cmd = String.format("kubectl top pods -n %s --no-headers", name);
                            String output = executeCommand(session, cmd, true);
                            
                            double totalCpu = 0.0;
                            long totalMemory = 0L;
                            
                            if (output != null && !output.trim().isEmpty()) {
                                String[] lines = output.split("\\r?\\n");
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
                            }
                            
                            String cpuFormatted = formatCpu(totalCpu);
                            String memoryFormatted = formatMemory(totalMemory);
                            namespace.setCpu(cpuFormatted);
                            namespace.setMemory(memoryFormatted);
                            
                            System.out.println("=== Thông tin namespace: " + name + " ===");
                            System.out.println("Namespace '" + name + "' | CPU: " + cpuFormatted + ", Mem: " + memoryFormatted);
                            System.out.println("--------------------------------");
                        } catch (Exception e) {
                            // Nếu không lấy được metrics, để giá trị mặc định
                            namespace.setCpu("0m");
                            namespace.setMemory("0");
                        }
                        
                        namespaces.add(namespace);
                        
                    } catch (Exception e) {
                        // Bỏ qua namespace nếu có lỗi, tiếp tục với namespace tiếp theo
                    }
                }
                
            } catch (ApiException e) {
                throw new RuntimeException("Không thể lấy danh sách namespaces từ Kubernetes API: " + e.getMessage(),
                        e);
            }
            
            return new NamespaceListResponse(namespaces);
            
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy danh sách namespaces: " + e.getMessage(), e);
        } finally {
            // Đảm bảo đóng SSH session
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public NamespaceDetailResponse getNamespace(String name) {
        // Lấy thông tin server MASTER
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session session = null;
        try {
            // Kết nối SSH đến MASTER server để lấy kubeconfig
            session = createSession(masterServer);
            
            // Tạo Kubernetes client từ kubeconfig
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            
            // Lấy namespace theo tên
            V1Namespace v1Namespace;
            try {
                v1Namespace = api.readNamespace(
                        name,
                        null // pretty
                );
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    throw new RuntimeException("Namespace không tồn tại: " + name);
                }
                throw new RuntimeException("Không thể lấy thông tin namespace từ Kubernetes API: " + e.getMessage(), e);
            }
            
            if (v1Namespace == null) {
                throw new RuntimeException("Namespace không tồn tại: " + name);
            }
            
            NamespaceDetailResponse response = new NamespaceDetailResponse();
            
            // Basic info
            if (v1Namespace.getMetadata() != null) {
                response.setName(v1Namespace.getMetadata().getName());
                response.setUid(v1Namespace.getMetadata().getUid());
                response.setResourceVersion(v1Namespace.getMetadata().getResourceVersion());
                
                // Creation timestamp
                OffsetDateTime creationTimestamp = v1Namespace.getMetadata().getCreationTimestamp();
                if (creationTimestamp != null) {
                    response.setCreationTimestamp(creationTimestamp.toString());
                    response.setAge(calculateAge(creationTimestamp));
                }
                
                // Labels
                Map<String, String> labels = new HashMap<>();
                if (v1Namespace.getMetadata().getLabels() != null) {
                    labels.putAll(v1Namespace.getMetadata().getLabels());
                }
                response.setLabels(labels);
                
                // Annotations
                Map<String, String> annotations = new HashMap<>();
                if (v1Namespace.getMetadata().getAnnotations() != null) {
                    annotations.putAll(v1Namespace.getMetadata().getAnnotations());
                }
                response.setAnnotations(annotations);
            }
            
            // Status
            V1NamespaceStatus status = v1Namespace.getStatus();
            if (status != null) {
                String phase = status.getPhase();
                response.setPhase(phase != null ? phase : "Unknown");
                
                if ("Active".equalsIgnoreCase(phase)) {
                    response.setStatus("active");
                } else {
                    response.setStatus("terminating");
                }
                
                // Conditions
                List<NamespaceDetailResponse.NamespaceCondition> conditions = new ArrayList<>();
                if (status.getConditions() != null) {
                    for (V1NamespaceCondition condition : status.getConditions()) {
                        NamespaceDetailResponse.NamespaceCondition cond = new NamespaceDetailResponse.NamespaceCondition();
                        cond.setType(condition.getType());
                        cond.setStatus(condition.getStatus());
                        cond.setReason(condition.getReason());
                        cond.setMessage(condition.getMessage());
                        if (condition.getLastTransitionTime() != null) {
                            cond.setLastTransitionTime(condition.getLastTransitionTime().toString());
                        }
                        conditions.add(cond);
                    }
                }
                response.setConditions(conditions);
            } else {
                response.setStatus("active");
                response.setPhase("Active");
            }
            
            // Spec - Finalizers
            V1NamespaceSpec spec = v1Namespace.getSpec();
            if (spec != null && spec.getFinalizers() != null) {
                response.setFinalizers(new ArrayList<>(spec.getFinalizers()));
            } else {
                response.setFinalizers(new ArrayList<>());
            }
            
            // Đếm số pods trong namespace
            try {
                io.kubernetes.client.openapi.models.V1PodList podList = api.listNamespacedPod(
                        name,
                        null, null, null, null, null, null, null, null, null, null, null
                );
                int podCount = 0;
                if (podList != null && podList.getItems() != null) {
                    podCount = podList.getItems().size();
                }
                response.setPodCount(podCount);
            } catch (Exception e) {
                response.setPodCount(0);
            }
            
            // Tính CPU và Memory usage
            try {
                String cmd = String.format("kubectl top pods -n %s --no-headers", name);
                String output = executeCommand(session, cmd, true);
                
                double totalCpu = 0.0;
                long totalMemory = 0L;
                
                if (output != null && !output.trim().isEmpty()) {
                    String[] lines = output.split("\\r?\\n");
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
                }
                
                response.setCpu(formatCpu(totalCpu));
                response.setMemory(formatMemory(totalMemory));
            } catch (Exception e) {
                response.setCpu("0m");
                response.setMemory("0");
            }
            
            // Generate YAML
            try {
                String yaml = Yaml.dump(v1Namespace);
                response.setYaml(yaml);
            } catch (Exception e) {
                response.setYaml("# Không thể tạo YAML: " + e.getMessage());
            }
            
            return response;
            
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chi tiết namespace: " + e.getMessage(), e);
        } finally {
            // Đảm bảo đóng SSH session
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public NamespaceResponse createNamespace(NamespaceRequest request) {
        if (request == null || request.getName() == null || request.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Namespace name is required");
        }

        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1Namespace namespaceBody = new V1Namespace();
            V1ObjectMeta metadata = new V1ObjectMeta();
            metadata.setName(request.getName().trim());
            if (request.getLabels() != null && !request.getLabels().isEmpty()) {
                metadata.setLabels(request.getLabels());
            }
            namespaceBody.setMetadata(metadata);

            V1Namespace created = api.createNamespace(namespaceBody, null, null, null, null);
            return buildNamespaceResponse(created);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo namespace: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo namespace: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public NamespaceResponse createNamespaceFromYaml(String yaml) {
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1Namespace namespaceFromYaml = Yaml.loadAs(yaml, V1Namespace.class);
            if (namespaceFromYaml == null) {
                throw new RuntimeException("YAML không hợp lệ");
            }

            if (namespaceFromYaml.getMetadata() == null || namespaceFromYaml.getMetadata().getName() == null) {
                throw new RuntimeException("YAML thiếu name trong metadata");
            }

            V1Namespace created = api.createNamespace(namespaceFromYaml, null, null, null, null);
            return buildNamespaceResponse(created);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo namespace từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo namespace từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public NamespaceResponse updateNamespaceFromYaml(String name, String yaml) {
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            io.kubernetes.client.openapi.models.V1Namespace namespaceFromYaml = Yaml.loadAs(yaml, io.kubernetes.client.openapi.models.V1Namespace.class);
            if (namespaceFromYaml == null) {
                throw new RuntimeException("YAML không hợp lệ");
            }

            if (namespaceFromYaml.getMetadata() == null) {
                namespaceFromYaml.setMetadata(new V1ObjectMeta());
            }
            if (!name.equals(namespaceFromYaml.getMetadata().getName())) {
                throw new RuntimeException("Tên trong YAML không khớp với tên namespace");
            }

            io.kubernetes.client.openapi.models.V1Namespace existing = api.readNamespace(name, null);
            if (existing == null) {
                throw new RuntimeException("Namespace không tồn tại");
            }
            if (existing.getMetadata() != null) {
                namespaceFromYaml.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
                namespaceFromYaml.getMetadata().setUid(existing.getMetadata().getUid());
            }

            io.kubernetes.client.openapi.models.V1Namespace updated = api.replaceNamespace(name, namespaceFromYaml, null, null, null, null);
            return buildNamespaceResponse(updated);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể cập nhật namespace từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể cập nhật namespace từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public void deleteNamespace(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Namespace name is required");
        }

        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            V1DeleteOptions deleteOptions = new V1DeleteOptions();
            api.deleteNamespace(name.trim(), null, null, null, null, null, deleteOptions);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể xóa namespace: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể xóa namespace: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
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

    /**
     * Format CPU cores thành chuỗi hiển thị (millicores hoặc cores).
     * 
     * Logic:
     * - Nếu < 1 core: hiển thị dạng millicores (ví dụ: "400m")
     * - Nếu >= 1 core: hiển thị dạng cores với 1 chữ số thập phân (ví dụ: "1.5")
     * 
     * @param cpuCores Số cores (double)
     * @return String định dạng CPU (ví dụ: "400m", "1.5")
     */
    private String formatCpu(double cpuCores) {
        if (cpuCores <= 0) {
            return "0m";
        }
        if (cpuCores < 1.0) {
            // Hiển thị dạng millicores
            int millicores = (int) Math.round(cpuCores * 1000);
            return millicores + "m";
        } else {
            // Hiển thị dạng cores với 1 chữ số thập phân
            return String.format("%.1f", cpuCores);
        }
    }

    /**
     * Format Memory bytes thành chuỗi hiển thị (Ki, Mi, Gi).
     * 
     * Logic:
     * - Sử dụng binary units (1024-based)
     * - Chọn đơn vị phù hợp: Ki (< 1Mi), Mi (< 1Gi), Gi (>= 1Gi)
     * - Format với 1 chữ số thập phân
     * 
     * @param memoryBytes Số bytes (long)
     * @return String định dạng Memory (ví dụ: "800Mi", "1.2Gi")
     */
    private String formatMemory(long memoryBytes) {
        if (memoryBytes <= 0) {
            return "0";
        }
        
        double bytes = (double) memoryBytes;
        if (bytes < 1024 * 1024) {
            // < 1Mi: hiển thị dạng KiB
            double ki = bytes / 1024.0;
            return String.format("%.1fKi", ki);
        } else if (bytes < 1024 * 1024 * 1024) {
            // < 1Gi: hiển thị dạng MiB
            double mi = bytes / (1024.0 * 1024.0);
            return String.format("%.1fMi", mi);
        } else {
            // >= 1Gi: hiển thị dạng GiB
            double gi = bytes / (1024.0 * 1024.0 * 1024.0);
            return String.format("%.1fGi", gi);
        }
    }

    /**
     * Build NamespaceResponse từ V1Namespace object.
     */
    private NamespaceResponse buildNamespaceResponse(V1Namespace v1Namespace) {
        if (v1Namespace == null || v1Namespace.getMetadata() == null) {
            return null;
        }
        NamespaceResponse namespace = new NamespaceResponse();
        String name = v1Namespace.getMetadata().getName();
        namespace.setId(name);
        namespace.setName(name);
        OffsetDateTime creationTimestamp = v1Namespace.getMetadata().getCreationTimestamp();
        namespace.setAge(calculateAge(creationTimestamp));
        V1NamespaceStatus status = v1Namespace.getStatus();
        String phase = (status != null && status.getPhase() != null)
                ? status.getPhase()
                : "Active";
        namespace.setStatus("Active".equalsIgnoreCase(phase) ? "active" : "terminating");
        Map<String, String> labels = new HashMap<>();
        if (v1Namespace.getMetadata().getLabels() != null) {
            labels.putAll(v1Namespace.getMetadata().getLabels());
        }
        namespace.setLabels(labels);
        return namespace;
    }
}

