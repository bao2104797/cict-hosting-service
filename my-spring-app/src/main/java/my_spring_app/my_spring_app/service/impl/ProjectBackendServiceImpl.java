package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.*;
import my_spring_app.my_spring_app.dto.reponse.BackendReplicaInfoResponse;
import my_spring_app.my_spring_app.dto.reponse.DeployBackendResponse;
import my_spring_app.my_spring_app.dto.request.DeployBackendRequest;
import my_spring_app.my_spring_app.entity.BackendRequestEntity;
import my_spring_app.my_spring_app.entity.ProjectBackendEntity;
import my_spring_app.my_spring_app.entity.ProjectEntity;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.entity.UserEntity;
import my_spring_app.my_spring_app.repository.BackendRequestRepository;
import my_spring_app.my_spring_app.repository.ProjectBackendRepository;
import my_spring_app.my_spring_app.repository.ProjectRepository;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.repository.UserRepository;
import my_spring_app.my_spring_app.service.ProjectBackendService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.Configuration;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Namespace;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1Scale;
import io.kubernetes.client.openapi.models.V1ScaleSpec;
import io.kubernetes.client.util.Config;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;

/**
 * Service implementation cho ProjectBackend
 * Xử lý các nghiệp vụ liên quan đến triển khai backend projects
 */

@Service
@Transactional
public class ProjectBackendServiceImpl extends BaseKubernetesService implements ProjectBackendService {

    // Username DockerHub để push images
    @Value("${app.vars.dockerhub_username}")
    private String dockerhub_username;

    // Repository để truy vấn ProjectBackend entities
    @Autowired
    private ProjectBackendRepository projectBackendRepository;

    // Repository để truy vấn Project entities
    @Autowired
    private ProjectRepository projectRepository;

    // Repository để truy vấn User entities
    @Autowired
    private UserRepository userRepository;

    // Repository để truy vấn Server entities (MASTER, DOCKER, DATABASE)
    @Autowired
    private ServerRepository serverRepository;

    @Autowired
    private BackendRequestRepository backendRequestRepository;

    /**
     * Tạo short UUID từ UUID đầy đủ để sử dụng trong Kubernetes
     * UUID đầy đủ có 36 ký tự (với dấu gạch ngang), short UUID sẽ có độ dài cố định 12 ký tự
     * Đảm bảo tính duy nhất bằng cách kiểm tra trong database
     * 
     * @param fullUuid UUID đầy đủ từ UUID.randomUUID().toString()
     * @return Short UUID (12 ký tự) đảm bảo tính duy nhất
     */
    private String generateShortUuid(String fullUuid) {
        // Loại bỏ dấu gạch ngang và lấy 12 ký tự đầu
        String uuidWithoutDashes = fullUuid.replace("-", "");
        String shortUuid = uuidWithoutDashes.substring(0, 12);
        
        // Kiểm tra tính duy nhất trong database
        int attempt = 0;
        while (projectBackendRepository.existsByUuid_k8s(shortUuid)) {
            attempt++;
            // Nếu trùng, tạo UUID mới và lấy 12 ký tự đầu
            if (attempt > 100) {
                // Nếu quá nhiều lần thử, throw exception
                throw new RuntimeException("Không thể tạo short UUID duy nhất sau " + attempt + " lần thử");
            }
            // Tạo UUID mới
            fullUuid = UUID.randomUUID().toString();
            uuidWithoutDashes = fullUuid.replace("-", "");
            shortUuid = uuidWithoutDashes.substring(0, 12);
        }
        
        return shortUuid;
    }

    /**
     * Kiểm tra và tạo namespace trên Kubernetes cluster nếu chưa tồn tại
     * Sử dụng Kubernetes Java Client API
     * 
     * @param session SSH session đến MASTER server để lấy kubeconfig
     * @param namespace Tên namespace cần kiểm tra/tạo
     * @throws Exception Nếu có lỗi khi kiểm tra hoặc tạo namespace
     */
    private void ensureNamespaceExists(Session session, String namespace) throws Exception {
        System.out.println("[ensureNamespaceExists] Kiểm tra namespace: " + namespace);
        
        File tempKubeconfig = null;
        try {
            // Đọc kubeconfig từ master server (thường ở ~/.kube/config)
            String kubeconfigPath = "~/.kube/config";
            System.out.println("[ensureNamespaceExists] Đang đọc kubeconfig từ: " + kubeconfigPath);
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
                    throw new RuntimeException("Không thể đọc kubeconfig từ master server");
                }
            }

            // Lấy IP MASTER và thay thế server URL trong kubeconfig trước khi sử dụng
            Optional<ServerEntity> masterOpt = serverRepository.findByRole("MASTER");
            if (masterOpt.isPresent()) {
                String masterIp = masterOpt.get().getIp();
                kubeconfigContent = replaceKubeconfigServer(kubeconfigContent, masterIp);
            } else {
                System.err.println("[ensureNamespaceExists] WARNING: Không tìm thấy server MASTER để thay server URL trong kubeconfig");
            }
            
            // Tạo file kubeconfig tạm thời trên local
            tempKubeconfig = File.createTempFile("kubeconfig-", ".yaml");
            tempKubeconfig.deleteOnExit();
            try (FileWriter writer = new FileWriter(tempKubeconfig)) {
                writer.write(kubeconfigContent);
            }
            System.out.println("[ensureNamespaceExists] Đã tạo file kubeconfig tạm thời: " + tempKubeconfig.getAbsolutePath());
            
            // Khởi tạo Kubernetes API client từ kubeconfig
            ApiClient client = Config.fromConfig(tempKubeconfig.getAbsolutePath());
            Configuration.setDefaultApiClient(client);
            CoreV1Api api = new CoreV1Api();
            
            // Kiểm tra namespace đã tồn tại chưa
            try {
                V1Namespace ns = api.readNamespace(namespace, null);
                System.out.println("[ensureNamespaceExists] Namespace đã tồn tại: " + namespace + " (Status: " + 
                    (ns.getStatus() != null && ns.getStatus().getPhase() != null ? ns.getStatus().getPhase() : "Unknown") + ")");
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    // Namespace chưa tồn tại, tạo mới
                    System.out.println("[ensureNamespaceExists] Namespace chưa tồn tại, đang tạo mới: " + namespace);
                    V1Namespace newNamespace = new V1Namespace();
                    V1ObjectMeta metadata = new V1ObjectMeta();
                    metadata.setName(namespace);
                    newNamespace.setMetadata(metadata);
                    
                    V1Namespace createdNamespace = api.createNamespace(newNamespace, null, null, null, null);
                    System.out.println("[ensureNamespaceExists] Đã tạo namespace thành công: " + namespace);
                } else {
                    System.err.println("[ensureNamespaceExists] Lỗi API khi kiểm tra namespace. Code: " + e.getCode() + ", Message: " + e.getMessage());
                    throw new RuntimeException("Lỗi khi kiểm tra namespace: " + e.getMessage(), e);
                }
            }
            
        } catch (Exception e) {
            System.err.println("[ensureNamespaceExists] Lỗi: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Không thể kiểm tra/tạo namespace: " + e.getMessage(), e);
        } finally {
            // Đảm bảo xóa file tạm thời sau khi sử dụng
            if (tempKubeconfig != null && tempKubeconfig.exists()) {
                try {
                    tempKubeconfig.delete();
                } catch (Exception e) {
                    System.err.println("[ensureNamespaceExists] Không thể xóa file kubeconfig tạm thời: " + e.getMessage());
                }
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
        System.out.println("[createKubernetesClient] Đang đọc kubeconfig từ: " + kubeconfigPath);
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
            System.out.println("[createKubernetesClient] Đã tạo kubeconfig tạm tại: " + tempKubeconfig.getAbsolutePath());

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
     * Helper method để tạo nội dung YAML Kubernetes cho backend Spring Boot
     * Tạo file YAML bao gồm: Deployment, Service, và Ingress
     *
     * @param uuid_k8s Short UUID cho deployment
     * @param dockerImage Docker image tag để deploy
     * @param domainName Domain name để cấu hình Ingress
     * @param namespace Namespace để deploy vào Kubernetes
     * @param databaseName Database name
     * @param databaseIp Database IP address
     * @param databasePort Database port
     * @param databaseUsername Database username
     * @param databasePassword Database password (có thể null)
     * @return Nội dung YAML đầy đủ cho Deployment, Service và Ingress
     */
    private String generateBackendSpringBootYaml(String uuid_k8s, String dockerImage, String domainName, String namespace,
                                                  String databaseName, String databaseIp, int databasePort,
                                                  String databaseUsername, String databasePassword, int maxReplicas) {
        // K8s Service/Ingress dùng DNS-1035: phải bắt đầu bằng chữ cái -> prefix 'app-'
        String resourceName = "app-" + uuid_k8s;
        String dbName = databaseName;
        // Sử dụng trực tiếp databaseIp, databaseUsername, databasePassword từ request (có thể chứa ký tự đặc biệt)
        String dbPassword = databasePassword != null ? databasePassword : "";

        return "apiVersion: apps/v1\n" +
                "kind: Deployment\n" +
                "metadata:\n" +
                "  name: " + resourceName + "\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  replicas: 1\n" +
                "  selector:\n" +
                "    matchLabels:\n" +
                "      app: " + resourceName + "\n" +
                "  template:\n" +
                "    metadata:\n" +
                "      labels:\n" +
                "        app: " + resourceName + "\n" +
                "    spec:\n" +
                "      containers:\n" +
                "        - name: " + resourceName + "\n" +
                "          image: " + dockerImage + "\n" +
                "          imagePullPolicy: IfNotPresent\n" +
                "          env:\n" +
                "            - name: SPRING_DATASOURCE_URL\n" +
                "              value: 'jdbc:mysql://" + databaseIp + ":" + databasePort + "/" + dbName + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC'\n" +
                "            - name: SPRING_DATASOURCE_USERNAME\n" +
                "              value: '" + databaseUsername + "'\n" +
                "            - name: SPRING_DATASOURCE_PASSWORD\n" +
                "              value: '" + dbPassword + "'\n" +
                "          ports:\n" +
                "            - containerPort: 8080\n" +
                "          resources:\n" +
                "            requests:\n" +
                "              cpu: \"200m\"\n" +
                "              memory: \"256Mi\"\n" +
                "            limits:\n" +
                "              cpu: \"500m\"\n" +
                "              memory: \"512Mi\"\n" +
                "---\n" +
                "apiVersion: v1\n" +
                "kind: Service\n" +
                "metadata:\n" +
                "  name: " + resourceName + "-svc\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  type: ClusterIP\n" +
                "  selector:\n" +
                "    app: " + resourceName + "\n" +
                "  ports:\n" +
                "    - port: 80\n" +
                "      targetPort: 8080\n" +
                "---\n" +
                "apiVersion: networking.k8s.io/v1\n" +
                "kind: Ingress\n" +
                "metadata:\n" +
                "  name: " + resourceName + "-ing\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  ingressClassName: nginx\n" +
                "  rules:\n" +
                "    - host: " + domainName + "\n" +
                "      http:\n" +
                "        paths:\n" +
                "          - path: /\n" +
                "            pathType: Prefix\n" +
                "            backend:\n" +
                "              service:\n" +
                "                name: " + resourceName + "-svc\n" +
                "                port:\n" +
                "                  number: 80\n" +
                "---\n" +
                "apiVersion: autoscaling/v2\n" +
                "kind: HorizontalPodAutoscaler\n" +
                "metadata:\n" +
                "  name: " + resourceName + "-hpa\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  scaleTargetRef:\n" +
                "    apiVersion: apps/v1\n" +
                "    kind: Deployment\n" +
                "    name: " + resourceName + "\n" +
                "  minReplicas: 1\n" +
                "  maxReplicas: 1\n" +
                "  metrics:\n" +
                "    - type: Resource\n" +
                "      resource:\n" +
                "        name: cpu\n" +
                "        target:\n" +
                "          type: Utilization\n" +
                "          averageUtilization: 70\n";
    }

    /**
     * Helper method để tạo nội dung YAML Kubernetes cho backend Node.js
     * Tạo file YAML bao gồm: Deployment, Service, và Ingress
     *
     * @param uuid_k8s Short UUID cho deployment
     * @param dockerImage Docker image tag để deploy
     * @param domainName Domain name để cấu hình Ingress
     * @param namespace Namespace để deploy vào Kubernetes
     * @param databaseName Database name
     * @param databaseIp Database IP address
     * @param databasePort Database port
     * @param databaseUsername Database username
     * @param databasePassword Database password (có thể null)
     * @return Nội dung YAML đầy đủ cho Deployment, Service và Ingress
     */
    private String generateBackendNodeJsYaml(String uuid_k8s, String dockerImage, String domainName, String namespace,
                                             String databaseName, String databaseIp, int databasePort,
                                             String databaseUsername, String databasePassword, int maxReplicas) {
        String resourceName = "app-" + uuid_k8s;
        String dbName = databaseName;
        String dbPassword = databasePassword != null ? databasePassword : "";

        return "apiVersion: apps/v1\n" +
                "kind: Deployment\n" +
                "metadata:\n" +
                "  name: " + resourceName + "\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  replicas: 1\n" +
                "  selector:\n" +
                "    matchLabels:\n" +
                "      app: " + resourceName + "\n" +
                "  template:\n" +
                "    metadata:\n" +
                "      labels:\n" +
                "        app: " + resourceName + "\n" +
                "    spec:\n" +
                "      containers:\n" +
                "        - name: " + resourceName + "\n" +
                "          image: " + dockerImage + "\n" +
                "          imagePullPolicy: IfNotPresent\n" +
                "          env:\n" +
                "            - name: DB_HOST\n" +
                "              value: '" + databaseIp + "'\n" +
                "            - name: DB_PORT\n" +
                "              value: '" + databasePort + "'\n" +
                "            - name: DB_NAME\n" +
                "              value: '" + dbName + "'\n" +
                "            - name: DB_USERNAME\n" +
                "              value: '" + databaseUsername + "'\n" +
                "            - name: DB_PASSWORD\n" +
                "              value: '" + dbPassword + "'\n" +
                "          ports:\n" +
                "            - containerPort: 3000\n" +
                "          resources:\n" +
                "            requests:\n" +
                "              cpu: \"200m\"\n" +
                "              memory: \"256Mi\"\n" +
                "            limits:\n" +
                "              cpu: \"500m\"\n" +
                "              memory: \"512Mi\"\n" +
                "---\n" +
                "apiVersion: v1\n" +
                "kind: Service\n" +
                "metadata:\n" +
                "  name: " + resourceName + "-svc\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  type: ClusterIP\n" +
                "  selector:\n" +
                "    app: " + resourceName + "\n" +
                "  ports:\n" +
                "    - port: 80\n" +
                "      targetPort: 3000\n" +
                "---\n" +
                "apiVersion: networking.k8s.io/v1\n" +
                "kind: Ingress\n" +
                "metadata:\n" +
                "  name: " + resourceName + "-ing\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  ingressClassName: nginx\n" +
                "  rules:\n" +
                "    - host: " + domainName + "\n" +
                "      http:\n" +
                "        paths:\n" +
                "          - path: /\n" +
                "            pathType: Prefix\n" +
                "            backend:\n" +
                "              service:\n" +
                "                name: " + resourceName + "-svc\n" +
                "                port:\n" +
                "                  number: 80\n" +
                "---\n" +
                "apiVersion: autoscaling/v2\n" +
                "kind: HorizontalPodAutoscaler\n" +
                "metadata:\n" +
                "  name: " + resourceName + "-hpa\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  scaleTargetRef:\n" +
                "    apiVersion: apps/v1\n" +
                "    kind: Deployment\n" +
                "    name: " + resourceName + "\n" +
                "  minReplicas: 1\n" +
                "  maxReplicas: 1\n" +
                "  metrics:\n" +
                "    - type: Resource\n" +
                "      resource:\n" +
                "        name: cpu\n" +
                "        target:\n" +
                "          type: Utilization\n" +
                "          averageUtilization: 70\n";
    }

    /**
     * Helper method để thực thi lệnh qua SSH (tương thích với code cũ)
     * Gọi method từ parent class với ignoreNonZeroExit = false
     */
    private String executeCommand(Session session, String command) throws Exception {
        return executeCommand(session, command, false);
    }

    /**
     * Triển khai backend project lên Kubernetes cluster
     * Hỗ trợ 2 phương thức deploy: DOCKER (từ image có sẵn) và FILE (từ file zip)
     * Backend sẽ sử dụng thông tin database từ request để kết nối, không tự động tạo database
     *
     * @param request Thông tin request để deploy backend project
     * @return Response chứa thông tin URL, status và domain name của project đã deploy
     * @throws RuntimeException Nếu có lỗi trong quá trình deploy
     */
    @Override
    public DeployBackendResponse deploy(DeployBackendRequest request) {
        System.out.println("[deployBackend] Bắt đầu triển khai backend project");

        // ========== BƯỚC 1: VALIDATE VÀ CHUẨN BỊ DỮ LIỆU ==========

        // Tìm user theo username
        Optional<UserEntity> userOptional = userRepository.findByUsername(request.getUsername());
        if (userOptional.isEmpty()) {
            throw new RuntimeException("User không tồn tại");
        }
        UserEntity user = userOptional.get();
        System.out.println("[deployBackend] Tier của user: " + user.getTier());

        if ("STANDARD".equalsIgnoreCase(user.getTier())) {
            long backendCount = projectBackendRepository.countByProject_User(user);
            System.out.println("[deployBackend] User STANDARD hiện có " + backendCount + " backend project(s)");
            if (backendCount >= 1) {
                String errorMessage = "Tài khoản STANDARD chỉ được phép triển khai 1 backend. Vui lòng nâng cấp gói để tiếp tục.";
                System.err.println("[deployBackend] Lỗi: " + errorMessage);
                throw new RuntimeException(errorMessage);
            }
        }

        int maxReplicas = "PREMIUM".equalsIgnoreCase(user.getTier()) ? 5 : 3;

        // Lấy ProjectEntity từ projectId
        Optional<ProjectEntity> projectOptional = projectRepository.findById(request.getProjectId());
        if (projectOptional.isEmpty()) {
            throw new RuntimeException("Project không tồn tại với id: " + request.getProjectId());
        }
        ProjectEntity project = projectOptional.get();

        // Validate deployment type (chỉ hỗ trợ DOCKER hoặc FILE)
        if (!"DOCKER".equalsIgnoreCase(request.getDeploymentType()) &&
            !"FILE".equalsIgnoreCase(request.getDeploymentType())) {
            throw new RuntimeException("Deployment type không hợp lệ. Chỉ hỗ trợ DOCKER hoặc FILE");
        }

        // Validate framework (chỉ hỗ trợ SPRINGBOOT, NODEJS)
        String framework = request.getFrameworkType().toUpperCase();
        if (!"SPRINGBOOT".equals(framework) && !"NODEJS".equals(framework)) {
            throw new RuntimeException("Framework không hợp lệ. Chỉ hỗ trợ SPRINGBOOT, NODEJS");
        }

        // Chuẩn hóa tên project: chuyển sang lowercase, thay khoảng trắng bằng dấu gạch ngang, loại bỏ ký tự đặc biệt
        String projectName = request.getProjectName().toLowerCase()
                .replaceAll("\\s+", "-")
                .replaceAll("[^a-z0-9-]", "");

        // Tạo UUID đầy đủ để đảm bảo tính duy nhất
        String fullUuid = UUID.randomUUID().toString();
        // Tạo short UUID từ UUID đầy đủ để sử dụng trong Kubernetes (12 ký tự)
        String uuid_k8s = generateShortUuid(fullUuid);
        System.out.println("[deployBackend] Tạo UUID đầy đủ: " + fullUuid);
        System.out.println("[deployBackend] Short UUID cho deployment: " + uuid_k8s + " (độ dài: " + uuid_k8s.length() + " ký tự)");

        // Lấy namespace từ ProjectEntity
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace. Vui lòng cấu hình namespace cho project.");
        }
        System.out.println("[deployBackend] Sử dụng namespace từ ProjectEntity: " + namespace);

        // Validate domainNameSystem từ request
        String domainName = request.getDomainNameSystem();
        if (domainName == null || domainName.trim().isEmpty()) {
            throw new RuntimeException("Domain name system không được để trống");
        }
        System.out.println("[deployBackend] Sử dụng domain name từ request: " + domainName);

        // Tạo ProjectBackendEntity và thiết lập các thuộc tính cơ bản
        ProjectBackendEntity projectEntity = new ProjectBackendEntity();
        projectEntity.setProjectName(request.getProjectName());
        projectEntity.setFrameworkType(framework);
        projectEntity.setDeploymentType(request.getDeploymentType().toUpperCase());
        projectEntity.setStatus("BUILDING"); // Trạng thái ban đầu là BUILDING
        projectEntity.setReplicas(1); // Mặc định deploy với 1 replica
        projectEntity.setMaxReplicas(maxReplicas);
        projectEntity.setProject(project);
        // Lưu UUID vào entity để truy vết và tránh trùng tên resource trên K8s
        projectEntity.setUuid_k8s(uuid_k8s);
        // Lưu domain name từ request vào entity
        projectEntity.setDomainNameSystem(domainName);

        // Lưu thông tin database vào entity (backend sẽ sử dụng thông tin này để kết nối database)
        projectEntity.setDatabaseIp(request.getDatabaseIp());
        projectEntity.setDatabasePort(request.getDatabasePort());
        projectEntity.setDatabaseName(request.getDatabaseName());
        projectEntity.setDatabaseUsername(request.getDatabaseUsername());
        projectEntity.setDatabasePassword(request.getDatabasePassword()); // Có thể null

        // ========== BƯỚC 2: LẤY THÔNG TIN SERVER TỪ DATABASE ==========

        // Lấy thông tin các server từ database: MASTER (Kubernetes cluster), DOCKER (build/push images)
        Optional<ServerEntity> masterServerOptional = serverRepository.findByRole("MASTER");
        Optional<ServerEntity> dockerServerOptional = serverRepository.findByRole("DOCKER");

        // Validate các server bắt buộc
        if (masterServerOptional.isEmpty()) {
            throw new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống.");
        }
        if (dockerServerOptional.isEmpty()) {
            throw new RuntimeException("Không tìm thấy server DOCKER. Vui lòng cấu hình server DOCKER trong hệ thống.");
        }

        ServerEntity master_server = masterServerOptional.get();
        ServerEntity docker_server = dockerServerOptional.get();

        // Khởi tạo các biến để quản lý SSH/SFTP connections
        Session session = null;           // SSH session đến DOCKER server (dùng cho FILE deployment)
        ChannelSftp sftp = null;          // SFTP channel đến DOCKER server
        Session clusterSession = null;    // SSH session đến MASTER server (Kubernetes cluster)
        ChannelSftp sftpYaml = null;      // SFTP channel đến MASTER server để upload YAML

        try {
            // ========== BƯỚC 3: XỬ LÝ DEPLOYMENT THEO PHƯƠNG THỨC ==========

            if ("DOCKER".equalsIgnoreCase(request.getDeploymentType())) {
                // ========== PHƯƠNG THỨC 1: DEPLOY TỪ DOCKER IMAGE CÓ SẴN ==========

                // Validate Docker image
                if (request.getDockerImage() == null || request.getDockerImage().trim().isEmpty()) {
                    throw new RuntimeException("Docker image không được để trống khi deployment type là DOCKER");
                }

                projectEntity.setDockerImage(request.getDockerImage());

                // Kết nối SSH đến MASTER server (Kubernetes cluster)
                System.out.println("[deployBackend] Đang kết nối đến MASTER server: " + master_server.getIp() + ":" + master_server.getPort());
                JSch jsch = new JSch();
                clusterSession = jsch.getSession(master_server.getUsername(), master_server.getIp(), master_server.getPort());
                clusterSession.setPassword(master_server.getPassword());
                Properties config = new Properties();
                config.put("StrictHostKeyChecking", "no"); // Không kiểm tra host key
                clusterSession.setConfig(config);
                clusterSession.setTimeout(7000);
                clusterSession.connect();
                System.out.println("[deployBackend] Kết nối SSH đến MASTER server thành công");

                // Tạo nội dung YAML file (Deployment + Service + Ingress)
                // Sử dụng uuid_k8s để làm tên resource trong K8s, tránh trùng khi projectName bị trùng
                String fileName = uuid_k8s + ".yaml";
                String yamlContent;
                if ("SPRINGBOOT".equals(framework)) {
                    yamlContent = generateBackendSpringBootYaml(
                        uuid_k8s,
                        request.getDockerImage(),
                        domainName,
                        namespace,
                        request.getDatabaseName(),
                        request.getDatabaseIp(),
                        request.getDatabasePort(),
                        request.getDatabaseUsername(),
                        request.getDatabasePassword(),
                        maxReplicas
                    );
                } else {
                    // NODEJS
                    yamlContent = generateBackendNodeJsYaml(
                        uuid_k8s,
                        request.getDockerImage(),
                        domainName,
                        namespace,
                        request.getDatabaseName(),
                        request.getDatabaseIp(),
                        request.getDatabasePort(),
                        request.getDatabaseUsername(),
                        request.getDatabasePassword(),
                        maxReplicas
                    );
                }

                // Mở SFTP channel để upload YAML file
                Channel sftpYamlCh = clusterSession.openChannel("sftp");
                sftpYamlCh.connect();
                sftpYaml = (ChannelSftp) sftpYamlCh;

                // Tạo thư mục đích với UUID để tránh trùng tên: /home/<master_username>/uploads/<username>/<uuid_k8s của project>/backend/<uuid_k8s>
                String yamlRemoteDir = "/home/" + master_server.getUsername() + "/uploads/" + user.getUsername() + "/" + project.getUuid_k8s() + "/backend/" + uuid_k8s;
                System.out.println("[deployBackend] Tạo/cd thư mục YAML: " + yamlRemoteDir);
                String[] yamlDirParts = yamlRemoteDir.split("/");
                String yamlCur = "";
                for (String p : yamlDirParts) {
                    if (p == null || p.isBlank()) continue;
                    yamlCur += "/" + p;
                    try {
                        sftpYaml.cd(yamlCur); // Thử chuyển vào thư mục
                    } catch (Exception e) {
                        sftpYaml.mkdir(yamlCur); // Nếu không tồn tại thì tạo mới
                        sftpYaml.cd(yamlCur);
                    }
                }

                // Upload YAML file lên server
                InputStream yamlStream = new ByteArrayInputStream(yamlContent.getBytes(StandardCharsets.UTF_8));
                String yamlRemotePath = yamlRemoteDir + "/" + fileName;
                sftpYaml.put(yamlStream, yamlRemotePath);
                System.out.println("[deployBackend] Đã upload YAML file: " + yamlRemotePath);

                // Lưu yamlPath (đường dẫn YAML trên MASTER server)
                // Với deployment type là DOCKER: không có sourcePath (null)
                projectEntity.setSourcePath(null);
                projectEntity.setYamlPath(yamlRemotePath);

                // Kiểm tra và tạo namespace nếu chưa tồn tại
                ensureNamespaceExists(clusterSession, namespace);

                // Apply YAML file vào Kubernetes cluster bằng kubectl
                System.out.println("[deployBackend] Đang apply YAML: kubectl apply -f " + yamlRemotePath);
                executeCommand(clusterSession, "kubectl apply -f '" + yamlRemotePath + "'");

            } else if ("FILE".equalsIgnoreCase(request.getDeploymentType())) {
                // ========== PHƯƠNG THỨC 2: DEPLOY TỪ FILE ZIP ==========

                // Validate file upload
                if (request.getFile() == null || request.getFile().isEmpty()) {
                    throw new RuntimeException("File upload không được để trống khi deployment type là FILE");
                }

                System.out.println("[deployBackend] Kết nối SSH tới DOCKER server: " + docker_server.getIp() + ":" + docker_server.getPort());

                // Bước 1: Kết nối SSH đến DOCKER server (để build và push image)
                JSch jsch = new JSch();
                session = jsch.getSession(docker_server.getUsername(), docker_server.getIp(), docker_server.getPort());
                session.setPassword(docker_server.getPassword());
                Properties cfg = new Properties();
                cfg.put("StrictHostKeyChecking", "no");
                session.setConfig(cfg);
                session.setTimeout(7000);
                session.connect();
                System.out.println("[deployBackend] Đã kết nối SSH DOCKER server thành công");

                // Bước 2: Upload file .zip lên DOCKER server
                Channel ch = session.openChannel("sftp");
                ch.connect();
                sftp = (ChannelSftp) ch;

                // Tạo thư mục đích trên DOCKER server với UUID để tránh trùng tên: /home/<docker_username>/uploads/<username>/<uuid_k8s của project>/backend/<uuid_k8s>
                String remoteBase = "/home/" + docker_server.getUsername() + "/uploads/" + user.getUsername() + "/" + project.getUuid_k8s() + "/backend/" + uuid_k8s;
                System.out.println("[deployBackend] Tạo/cd thư mục đích: " + remoteBase);
                // Đảm bảo thư mục tồn tại (tạo từng cấp thư mục nếu chưa có)
                String[] parts = remoteBase.split("/");
                String cur = "";
                for (String p : parts) {
                    if (p == null || p.isBlank()) continue;
                    cur += "/" + p;
                    try {
                        sftp.cd(cur);
                    } catch (Exception e) {
                        sftp.mkdir(cur);
                        sftp.cd(cur);
                    }
                }

                // Tạo tên file an toàn (loại bỏ ký tự đặc biệt)
                String originalName = request.getFile().getOriginalFilename();
                String safeName = originalName != null ? originalName.replaceAll("[^a-zA-Z0-9._-]", "_") : (projectName + ".zip");
                String remoteZipPath = remoteBase + "/" + safeName;
                System.out.println("[deployBackend] Upload file lên: " + remoteZipPath);
                sftp.put(request.getFile().getInputStream(), remoteZipPath);

                // Lưu sourcePath (đường dẫn file zip trên DOCKER server)
                projectEntity.setSourcePath(remoteZipPath);

                // Bước 3: Giải nén file .zip trên DOCKER server
                String unzipCmd = "cd " + remoteBase + " && unzip -o '" + safeName + "'";
                System.out.println("[deployBackend] Giải nén: " + unzipCmd);
                executeCommand(session, unzipCmd);

                // Bước 4: Build và push Docker image
                // Xác định thư mục project sau khi giải nén
                String extractedDir = safeName.endsWith(".zip") ? safeName.substring(0, safeName.length() - 4) : safeName;
                String projectDir = remoteBase + "/" + extractedDir;

                // Kiểm tra Dockerfile có tồn tại không
                String checkDockerfile = "test -f '" + projectDir + "/Dockerfile' && echo OK || echo NO";
                System.out.println("[deployBackend] Kiểm tra Dockerfile: " + checkDockerfile);
                String check = executeCommand(session, checkDockerfile);
                if (!"OK".equals(check.trim())) {
                    throw new RuntimeException("Không tìm thấy Dockerfile trong gói source đã giải nén");
                }

                // Build Docker image từ Dockerfile
                // Sử dụng uuid_k8s thay vì projectName để tránh trùng tên image
                String imageTag = dockerhub_username + "/" + uuid_k8s + ":latest";
                String buildCmd = "cd '" + projectDir + "' && docker build -t '" + imageTag + "' .";
                System.out.println("[deployBackend] Docker build: " + buildCmd);
                executeCommand(session, buildCmd);

                // Push image lên DockerHub
                String pushCmd = "docker push '" + imageTag + "'";
                System.out.println("[deployBackend] Docker push: " + pushCmd);
                executeCommand(session, pushCmd);

                projectEntity.setDockerImage(imageTag); // Lưu image tag vào database

                // Dọn dẹp: Xóa Docker image local sau khi push thành công
                try {
                    String rmiCmd = "docker rmi '" + escapeSingleQuotes(imageTag) + "' || true";
                    System.out.println("[deployBackend] Dọn dẹp Docker image: " + rmiCmd);
                    executeCommand(session, rmiCmd, true);
                    System.out.println("[deployBackend] Đã dọn dẹp Docker image: " + imageTag);
                } catch (Exception cleanupEx) {
                    System.err.println("[deployBackend] Lỗi khi dọn dẹp Docker image (bỏ qua): " + cleanupEx.getMessage());
                }

                // Dọn dẹp: Xóa thư mục mã nguồn đã upload và giải nén
                try {
                    String cleanupDirCmd = "rm -rf '" + escapeSingleQuotes(remoteBase) + "' || true";
                    System.out.println("[deployBackend] Dọn dẹp thư mục mã nguồn: " + cleanupDirCmd);
                    executeCommand(session, cleanupDirCmd, true);
                    System.out.println("[deployBackend] Đã dọn dẹp thư mục mã nguồn: " + remoteBase);
                } catch (Exception cleanupEx) {
                    System.err.println("[deployBackend] Lỗi khi dọn dẹp thư mục mã nguồn (bỏ qua): " + cleanupEx.getMessage());
                }
                try {
                    String uploadsRoot = "/home/" + docker_server.getUsername() + "/uploads";
                    String cleanupUploadsCmd = "rm -rf '" + escapeSingleQuotes(uploadsRoot) + "' || true";
                    System.out.println("[deployBackend] Dọn dẹp thư mục uploads: " + cleanupUploadsCmd);
                    executeCommand(session, cleanupUploadsCmd, true);
                } catch (Exception cleanupEx) {
                    System.err.println("[deployBackend] Lỗi khi dọn dẹp thư mục uploads (bỏ qua): " + cleanupEx.getMessage());
                }

                // Bước 5: Tạo YAML và apply lên Kubernetes cluster (MASTER server)
                System.out.println("[deployBackend] Chuyển sang MASTER server để upload/apply YAML: " + master_server.getIp() + ":" + master_server.getPort());

                // Tạo nội dung YAML file
                // Sử dụng uuid_k8s để làm tên resource trong K8s, tránh trùng khi projectName bị trùng
                String fileName = uuid_k8s + ".yaml";
                String yamlContent;
                if ("SPRINGBOOT".equals(framework)) {
                    yamlContent = generateBackendSpringBootYaml(
                        uuid_k8s,
                        imageTag,
                        domainName,
                        namespace,
                        request.getDatabaseName(),
                        request.getDatabaseIp(),
                        request.getDatabasePort(),
                        request.getDatabaseUsername(),
                        request.getDatabasePassword(),
                        maxReplicas
                    );
                } else {
                    // NODEJS
                    yamlContent = generateBackendNodeJsYaml(
                        uuid_k8s,
                        imageTag,
                        domainName,
                        namespace,
                        request.getDatabaseName(),
                        request.getDatabaseIp(),
                        request.getDatabasePort(),
                        request.getDatabaseUsername(),
                        request.getDatabasePassword(),
                        maxReplicas
                    );
                }

                // Kết nối SSH đến MASTER server
                JSch jschCluster = new JSch();
                clusterSession = jschCluster.getSession(master_server.getUsername(), master_server.getIp(), master_server.getPort());
                clusterSession.setPassword(master_server.getPassword());
                Properties cfgCluster = new Properties();
                cfgCluster.put("StrictHostKeyChecking", "no");
                clusterSession.setConfig(cfgCluster);
                clusterSession.setTimeout(7000);
                clusterSession.connect();
                System.out.println("[deployBackend] Kết nối SSH tới MASTER server thành công");

                // Mở SFTP channel để upload YAML file
                Channel sftpYamlCh = clusterSession.openChannel("sftp");
                sftpYamlCh.connect();
                sftpYaml = (ChannelSftp) sftpYamlCh;

                // Tạo thư mục đích trên MASTER server với UUID để tránh trùng tên: /home/<master_username>/uploads/<username>/<uuid_k8s của project>/backend/<uuid_k8s>
                String yamlRemoteDir = "/home/" + master_server.getUsername() + "/uploads/" + user.getUsername() + "/" + project.getUuid_k8s() + "/backend/" + uuid_k8s;
                System.out.println("[deployBackend] Tạo/cd thư mục YAML: " + yamlRemoteDir);
                String[] yamlDirParts = yamlRemoteDir.split("/");
                String yamlCur = "";
                for (String p : yamlDirParts) {
                    if (p == null || p.isBlank()) continue;
                    yamlCur += "/" + p;
                    try {
                        sftpYaml.cd(yamlCur);
                    } catch (Exception e) {
                        sftpYaml.mkdir(yamlCur);
                        sftpYaml.cd(yamlCur);
                    }
                }

                // Upload YAML file lên MASTER server
                InputStream yamlStream = new ByteArrayInputStream(yamlContent.getBytes(StandardCharsets.UTF_8));
                String yamlRemotePath = yamlRemoteDir + "/" + fileName;
                sftpYaml.put(yamlStream, yamlRemotePath);
                System.out.println("[deployBackend] Upload YAML: " + yamlRemotePath);

                // Lưu yamlPath (đường dẫn YAML trên MASTER server)
                // Với FILE method: đã có sourcePath (đã set ở trên), giờ set thêm yamlPath
                projectEntity.setYamlPath(yamlRemotePath);

                // Kiểm tra và tạo namespace nếu chưa tồn tại
                ensureNamespaceExists(clusterSession, namespace);

                // Apply YAML file vào Kubernetes cluster
                System.out.println("[deployBackend] Đang apply YAML: kubectl apply -f " + yamlRemotePath);
                executeCommand(clusterSession, "kubectl apply -f '" + yamlRemotePath + "'");
            }

            // ========== BƯỚC 4: CẬP NHẬT TRẠNG THÁI VÀ TRẢ VỀ KẾT QUẢ ==========

            // Cập nhật trạng thái project thành RUNNING
            projectEntity.setStatus("RUNNING");
            projectBackendRepository.save(projectEntity);
            System.out.println("[deployBackend] Hoàn tất triển khai backend, projectName=" + projectName + ", domain=" + domainName);

            // Tạo response và trả về
            DeployBackendResponse response = new DeployBackendResponse();
            response.setUrl("http://" + domainName);
            response.setStatus(projectEntity.getStatus());
            response.setDomainNameSystem(domainName);
            return response;

        } catch (Exception ex) {
            // ========== XỬ LÝ LỖI ==========
            System.err.println("[deployBackend] Lỗi: " + ex.getMessage());
            ex.printStackTrace();
            // Cập nhật trạng thái project thành ERROR
            projectEntity.setStatus("ERROR");
            projectBackendRepository.save(projectEntity);
            throw new RuntimeException("Lỗi khi triển khai backend: " + ex.getMessage(), ex);
        } finally {
            // ========== DỌN DẸP TÀI NGUYÊN ==========
            // Đảm bảo đóng tất cả các kết nối SSH/SFTP để giải phóng tài nguyên
            if (sftp != null && sftp.isConnected()) sftp.disconnect();
            if (session != null && session.isConnected()) session.disconnect();
            if (sftpYaml != null && sftpYaml.isConnected()) sftpYaml.disconnect();
            if (clusterSession != null && clusterSession.isConnected()) clusterSession.disconnect();
            System.out.println("[deployBackend] Đã đóng các kết nối SSH/SFTP");
        }
    }

    @Override
    public void stopBackend(Long projectId, Long backendId) {
        System.out.println("[stopBackend] Yêu cầu dừng backend projectId=" + projectId + ", backendId=" + backendId);

        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project không tồn tại với id: " + projectId));

        ProjectBackendEntity backend = projectBackendRepository.findById(backendId)
                .orElseThrow(() -> new RuntimeException("Backend project không tồn tại với id: " + backendId));

        if (backend.getProject() == null || !backend.getProject().getId().equals(project.getId())) {
            throw new RuntimeException("Backend project không thuộc về project này");
        }

        scaleBackendDeployment(project, backend, 0);

        backend.setStatus("STOPPED");
        projectBackendRepository.save(backend);
        System.out.println("[stopBackend] Đã dừng backend thành công");
    }

    @Override
    public void startBackend(Long projectId, Long backendId) {
        System.out.println("[startBackend] Yêu cầu khởi động backend projectId=" + projectId + ", backendId=" + backendId);

        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project không tồn tại với id: " + projectId));

        ProjectBackendEntity backend = projectBackendRepository.findById(backendId)
                .orElseThrow(() -> new RuntimeException("Backend project không tồn tại với id: " + backendId));

        if (backend.getProject() == null || !backend.getProject().getId().equals(project.getId())) {
            throw new RuntimeException("Backend project không thuộc về project này");
        }

        scaleBackendDeployment(project, backend, 1);

        backend.setStatus("RUNNING");
        projectBackendRepository.save(backend);
        System.out.println("[startBackend] Đã khởi động backend thành công");
    }

    @Override
    public void deleteBackend(Long projectId, Long backendId) {
        System.out.println("[deleteBackend] Yêu cầu xóa backend projectId=" + projectId + ", backendId=" + backendId);

        // Lấy project để kiểm tra quyền sở hữu backend
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project không tồn tại với id: " + projectId));

        // Lấy backend cần xóa
        ProjectBackendEntity backend = projectBackendRepository.findById(backendId)
                .orElseThrow(() -> new RuntimeException("Backend project không tồn tại với id: " + backendId));

        // Đảm bảo backend thuộc về đúng project
        if (backend.getProject() == null || !backend.getProject().getId().equals(project.getId())) {
            throw new RuntimeException("Backend project không thuộc về project này");
        }

        // Xóa tài nguyên trên Kubernetes
        deleteBackendResources(project, backend);

        // Xóa record khỏi database
        projectBackendRepository.delete(backend);
        System.out.println("[deleteBackend] Đã xóa backend thành công");
    }

    @Override
    public BackendReplicaInfoResponse getBackendReplicaInfo(Long backendId) {
        if (backendId == null) {
            throw new RuntimeException("backendId không được để trống");
        }
        ProjectBackendEntity backend = projectBackendRepository.findById(backendId)
                .orElseThrow(() -> new RuntimeException("Backend không tồn tại với id: " + backendId));
        BackendReplicaInfoResponse response = new BackendReplicaInfoResponse();
        response.setBackendId(backend.getId());
        response.setReplicas(backend.getReplicas());
        response.setMaxReplicas(backend.getMaxReplicas());
        response.setHasPendingRequest(false);
        response.setMessage("Bạn có thể gửi yêu cầu điều chỉnh replicas.");

        Optional<BackendRequestEntity> pendingRequest = backendRequestRepository
                .findFirstByBackend_IdAndStatus(backendId, "PENDING");

        if (pendingRequest.isPresent()) {
            BackendRequestEntity request = pendingRequest.get();
            response.setHasPendingRequest(true);
            response.setPendingRequestId(request.getId());
            response.setPendingNewReplicas(request.getNewReplicas());
            response.setPendingStatus(request.getStatus());
            response.setMessage("Bạn đã gửi yêu cầu điều chỉnh replicas từ " + request.getOldReplicas() + " thành " + request.getNewReplicas() + " và đang chờ phê duyệt.");
        }
        return response;
    }

    private void scaleBackendDeployment(ProjectEntity project, ProjectBackendEntity backend, int replicas) {
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace. Không thể thay đổi replicas backend.");
        }

        String deploymentName = "app-" + backend.getUuid_k8s();

        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session clusterSession = null;
        try {
            JSch jsch = new JSch();
            clusterSession = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
            clusterSession.setPassword(masterServer.getPassword());
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            clusterSession.setConfig(config);
            clusterSession.setTimeout(7000);
            clusterSession.connect();
            System.out.println("[scaleBackendDeployment] Đã kết nối tới MASTER server");

            ApiClient client = createKubernetesClient(clusterSession);
            AppsV1Api appsApi = new AppsV1Api(client);

            V1Scale scale = appsApi.readNamespacedDeploymentScale(deploymentName, namespace, null);
            if (scale.getSpec() == null) {
                scale.setSpec(new V1ScaleSpec());
            }
            scale.getSpec().setReplicas(replicas);
            appsApi.replaceNamespacedDeploymentScale(deploymentName, namespace, scale, null, null, null, null);
            System.out.println("[scaleBackendDeployment] Đã scale deployment " + deploymentName + " về " + replicas + " replica(s)");
        } catch (Exception e) {
            System.err.println("[scaleBackendDeployment] Lỗi: " + e.getMessage());
            throw new RuntimeException("Không thể scale backend: " + e.getMessage(), e);
        } finally {
            if (clusterSession != null && clusterSession.isConnected()) {
                clusterSession.disconnect();
            }
        }
    }

    private void deleteBackendResources(ProjectEntity project, ProjectBackendEntity backend) {
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace. Không thể xóa resources backend.");
        }

        String uuid = backend.getUuid_k8s();
        if (uuid == null || uuid.trim().isEmpty()) {
            throw new RuntimeException("Backend không có uuid_k8s. Không thể xóa resources backend.");
        }

        String deploymentName = "app-" + uuid;
        String serviceName = deploymentName + "-svc";
        String ingressName = deploymentName + "-ing";

        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session clusterSession = null;
        try {
            // Kết nối SSH tới MASTER server để có thể chạy lệnh kubectl
            JSch jsch = new JSch();
            clusterSession = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
            clusterSession.setPassword(masterServer.getPassword());
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            clusterSession.setConfig(config);
            clusterSession.setTimeout(7000);
            clusterSession.connect();
            System.out.println("[deleteBackendResources] Đã kết nối MASTER server để xóa resources");

            String deleteIngressCmd = String.format("kubectl -n %s delete ing/%s || true", namespace, ingressName);
            System.out.println("[deleteBackendResources] " + deleteIngressCmd);
            executeCommand(clusterSession, deleteIngressCmd, true);

            String deleteServiceCmd = String.format("kubectl -n %s delete svc/%s || true", namespace, serviceName);
            System.out.println("[deleteBackendResources] " + deleteServiceCmd);
            executeCommand(clusterSession, deleteServiceCmd, true);

            String deleteDeploymentCmd = String.format("kubectl -n %s delete deploy/%s || true", namespace, deploymentName);
            System.out.println("[deleteBackendResources] " + deleteDeploymentCmd);
            executeCommand(clusterSession, deleteDeploymentCmd, true);

            String yamlPath = backend.getYamlPath();
            if (yamlPath != null && !yamlPath.trim().isEmpty()) {
                String cleanedPath = yamlPath.trim();
                String deleteYamlCmd = String.format("rm -f '%s'", escapeSingleQuotes(cleanedPath));
                System.out.println("[deleteBackendResources] " + deleteYamlCmd);
                executeCommand(clusterSession, deleteYamlCmd, true);

                // Nếu xác định được thư mục chứa file YAML thì xóa luôn thư mục
                java.io.File yamlFile = new java.io.File(cleanedPath);
                String parentDir = yamlFile.getParent();
                if (parentDir != null && !parentDir.trim().isEmpty()) {
                    String deleteDirCmd = String.format("rm -rf '%s'", escapeSingleQuotes(parentDir.trim()));
                    System.out.println("[deleteBackendResources] " + deleteDirCmd);
                    executeCommand(clusterSession, deleteDirCmd, true);
                }
            }
        } catch (Exception e) {
            System.err.println("[deleteBackendResources] Lỗi: " + e.getMessage());
            throw new RuntimeException("Không thể xóa resources backend: " + e.getMessage(), e);
        } finally {
            if (clusterSession != null && clusterSession.isConnected()) {
                clusterSession.disconnect();
            }
        }
    }

    private String escapeSingleQuotes(String input) {
        return input.replace("'", "'\"'\"'");
    }
}

