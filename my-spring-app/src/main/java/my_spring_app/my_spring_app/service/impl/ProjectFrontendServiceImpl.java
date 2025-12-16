package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.*;
import my_spring_app.my_spring_app.dto.reponse.DeployFrontendResponse;
import my_spring_app.my_spring_app.dto.reponse.FrontendReplicaInfoResponse;
import my_spring_app.my_spring_app.dto.reponse.ListProjectFrontendResponse;
import my_spring_app.my_spring_app.dto.request.DeployFrontendRequest;
import my_spring_app.my_spring_app.entity.FrontendRequestEntity;
import my_spring_app.my_spring_app.entity.ProjectEntity;
import my_spring_app.my_spring_app.entity.ProjectFrontendEntity;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.entity.UserEntity;
import my_spring_app.my_spring_app.repository.FrontendRequestRepository;
import my_spring_app.my_spring_app.repository.ProjectFrontendRepository;
import my_spring_app.my_spring_app.repository.ProjectRepository;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.repository.UserRepository;
import my_spring_app.my_spring_app.service.ProjectFrontendService;
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
import io.kubernetes.client.util.Config;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service implementation cho ProjectFrontend
 * Xử lý các nghiệp vụ liên quan đến triển khai frontend projects
 */
@Service
@Transactional
public class ProjectFrontendServiceImpl extends BaseKubernetesService implements ProjectFrontendService {

    // Username DockerHub để push images
    @Value("${app.vars.dockerhub_username}")
    private String dockerhub_username;

    // Repository để truy vấn ProjectFrontend entities
    @Autowired
    private ProjectFrontendRepository projectFrontendRepository;

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
    private FrontendRequestRepository frontendRequestRepository;

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
        while (projectFrontendRepository.existsByUuid_k8s(shortUuid)) {
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
     * Helper method để tạo nội dung YAML Kubernetes cho frontend
     * Tạo file YAML bao gồm: Deployment, Service, và Ingress
     * 
     * @param uuid_k8s Short UUID cho deployment
     * @param dockerImage Docker image tag để deploy
     * @param domainName Domain name để cấu hình Ingress
     * @param namespace Namespace để deploy vào Kubernetes
     * @param maxReplicas Số pod tối đa cho HPA
     * @return Nội dung YAML đầy đủ cho Deployment, Service, Ingress và HPA
     */
    private String generateFrontendReactYaml(String uuid_k8s, String dockerImage, String domainName, String namespace, int maxReplicas) {
        // K8s Service/Ingress dùng DNS-1035: phải bắt đầu bằng chữ cái -> prefix 'app-'
        String resourceName = "app-" + uuid_k8s;
        // Tạo YAML với 3 phần: Deployment, Service, Ingress
        return "apiVersion: apps/v1\n" +
                "kind: Deployment\n" +
                "metadata:\n" +
                "  name: " + resourceName + "\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  replicas: 1\n" +  // Số lượng pod replica
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
                "          ports:\n" +
                "            - containerPort: 80\n" +  // Port container frontend
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
                "  type: ClusterIP\n" +  // Service type ClusterIP để expose trong cluster
                "  selector:\n" +
                "    app: " + resourceName + "\n" +
                "  ports:\n" +
                "    - port: 80\n" +  // Port service
                "      targetPort: 80\n" +  // Port container
                "---\n" +
                "apiVersion: networking.k8s.io/v1\n" +
                "kind: Ingress\n" +
                "metadata:\n" +
                "  name: " + resourceName + "-ing\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  ingressClassName: nginx\n" +  // Sử dụng nginx ingress controller
                "  rules:\n" +
                "    - host: " + domainName + "\n" +  // Domain name cho ingress
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
     * Helper method để tạo nội dung YAML Kubernetes cho frontend
     * Tạo file YAML bao gồm: Deployment, Service, và Ingress
     * 
     * @param uuid_k8s Short UUID cho deployment
     * @param dockerImage Docker image tag để deploy
     * @param domainName Domain name để cấu hình Ingress
     * @param namespace Namespace để deploy vào Kubernetes
     * @param maxReplicas Số pod tối đa cho HPA
     * @return Nội dung YAML đầy đủ cho Deployment, Service, Ingress và HPA
     */
    private String generateFrontendVueYaml(String uuid_k8s, String dockerImage, String domainName, String namespace, int maxReplicas) {
        String resourceName = "app-" + uuid_k8s;
        // Tạo YAML với 3 phần: Deployment, Service, Ingress
        return "apiVersion: apps/v1\n" +
                "kind: Deployment\n" +
                "metadata:\n" +
                "  name: " + resourceName + "\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  replicas: 1\n" +  // Số lượng pod replica
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
                "          ports:\n" +
                "            - containerPort: 80\n" +  // Port container frontend
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
                "  type: ClusterIP\n" +  // Service type ClusterIP để expose trong cluster
                "  selector:\n" +
                "    app: " + resourceName + "\n" +
                "  ports:\n" +
                "    - port: 80\n" +  // Port service
                "      targetPort: 80\n" +  // Port container
                "---\n" +
                "apiVersion: networking.k8s.io/v1\n" +
                "kind: Ingress\n" +
                "metadata:\n" +
                "  name: " + resourceName + "-ing\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  ingressClassName: nginx\n" +  // Sử dụng nginx ingress controller
                "  rules:\n" +
                "    - host: " + domainName + "\n" +  // Domain name cho ingress
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
     * Helper method để tạo nội dung YAML Kubernetes cho frontend
     * Tạo file YAML bao gồm: Deployment, Service, và Ingress
     * 
     * @param uuid_k8s Short UUID cho deployment
     * @param dockerImage Docker image tag để deploy
     * @param domainName Domain name để cấu hình Ingress
     * @param namespace Namespace để deploy vào Kubernetes
     * @param maxReplicas Số pod tối đa cho HPA
     * @return Nội dung YAML đầy đủ cho Deployment, Service, Ingress và HPA
     */
    private String generateFrontendAngularYaml(String uuid_k8s, String dockerImage, String domainName, String namespace, int maxReplicas) {
        String resourceName = "app-" + uuid_k8s;
        // Tạo YAML với 3 phần: Deployment, Service, Ingress
        return "apiVersion: apps/v1\n" +
                "kind: Deployment\n" +
                "metadata:\n" +
                "  name: " + resourceName + "\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  replicas: 1\n" +  // Số lượng pod replica
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
                "          ports:\n" +
                "            - containerPort: 80\n" +  // Port container frontend
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
                "  type: ClusterIP\n" +  // Service type ClusterIP để expose trong cluster
                "  selector:\n" +
                "    app: " + resourceName + "\n" +
                "  ports:\n" +
                "    - port: 80\n" +  // Port service
                "      targetPort: 80\n" +  // Port container
                "---\n" +
                "apiVersion: networking.k8s.io/v1\n" +
                "kind: Ingress\n" +
                "metadata:\n" +
                "  name: " + resourceName + "-ing\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  ingressClassName: nginx\n" +  // Sử dụng nginx ingress controller
                "  rules:\n" +
                "    - host: " + domainName + "\n" +  // Domain name cho ingress
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
     * Kiểm tra và tạo namespace trên Kubernetes cluster nếu chưa tồn tại
     * Sử dụng Kubernetes Java Client API
     * 
     * @param session SSH session đến MASTER server để lấy kubeconfig
     * @param namespace Tên namespace cần kiểm tra/tạo
     * @throws Exception Nếu có lỗi khi kiểm tra hoặc tạo namespace
     */
    private void ensureNamespaceExists(Session session, String namespace) throws Exception {
        System.out.println("[ensureNamespaceExists] Kiểm tra namespace: " + namespace);
        
        try {
            // Sử dụng method createKubernetesClient từ parent class (đã xử lý thay thế server URL)
            ApiClient client = createKubernetesClient(session);
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
     * Helper method để thực thi lệnh qua SSH (tương thích với code cũ)
     * Gọi method từ parent class với ignoreNonZeroExit = false
     */
    private String executeCommand(Session session, String command) throws Exception {
        return executeCommand(session, command, false);
    }

    /**
     * Triển khai frontend project lên Kubernetes cluster
     * Hỗ trợ 2 phương thức deploy: DOCKER (từ image có sẵn) và FILE (từ file zip)
     * 
     * @param request Thông tin request để deploy frontend project
     * @return Response chứa thông tin URL, status và domain name của project đã deploy
     * @throws RuntimeException Nếu có lỗi trong quá trình deploy
     */
    @Override
    public DeployFrontendResponse deploy(DeployFrontendRequest request) {
        System.out.println("[deployFrontend] Bắt đầu triển khai frontend project");

        // ========== BƯỚC 1: VALIDATE VÀ CHUẨN BỊ DỮ LIỆU ==========
        
        // Tìm user theo username
        Optional<UserEntity> userOptional = userRepository.findByUsername(request.getUsername());
        if (userOptional.isEmpty()) {
            throw new RuntimeException("User không tồn tại");
        }
        UserEntity user = userOptional.get();
        System.out.println("[deployFrontend] Tier của user: " + user.getTier());

        if ("STANDARD".equalsIgnoreCase(user.getTier())) {
            long frontendCount = projectFrontendRepository.countByProject_User(user);
            System.out.println("[deployFrontend] User STANDARD hiện có " + frontendCount + " frontend project(s)");
            if (frontendCount >= 1) {
                String errorMessage = "Tài khoản STANDARD chỉ được phép triển khai 1 frontend. Vui lòng nâng cấp gói để tiếp tục.";
                System.err.println("[deployFrontend] Lỗi: " + errorMessage);
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
        
        // Lấy namespace từ ProjectEntity
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace. Vui lòng cấu hình namespace cho project.");
        }
        System.out.println("[deployFrontend] Sử dụng namespace từ ProjectEntity: " + namespace);

        // Validate deployment method (chỉ hỗ trợ DOCKER hoặc FILE)
        if (!"DOCKER".equalsIgnoreCase(request.getDeploymentType()) &&
            !"FILE".equalsIgnoreCase(request.getDeploymentType())) {
            throw new RuntimeException("Deployment method không hợp lệ. Chỉ hỗ trợ DOCKER hoặc FILE");
        }

        // Validate framework (chỉ hỗ trợ REACT, VUE, ANGULAR)
        String framework = request.getFrameworkType().toUpperCase();
        if (!"REACT".equals(framework) && !"VUE".equals(framework) && !"ANGULAR".equals(framework)) {
            throw new RuntimeException("Framework không hợp lệ. Chỉ hỗ trợ REACT, VUE, ANGULAR");
        }

        // Chuẩn hóa tên project: chuyển sang lowercase, thay khoảng trắng bằng dấu gạch ngang, loại bỏ ký tự đặc biệt
        String projectName = request.getProjectName().toLowerCase()
                .replaceAll("\\s+", "-")
                .replaceAll("[^a-z0-9-]", "");

        // Tạo UUID đầy đủ để đảm bảo tính duy nhất
        String fullUuid = UUID.randomUUID().toString();
        // Tạo short UUID từ UUID đầy đủ để sử dụng trong Kubernetes (12 ký tự)
        String uuid_k8s = generateShortUuid(fullUuid);
        System.out.println("[deployFrontend] Tạo UUID đầy đủ: " + fullUuid);
        System.out.println("[deployFrontend] Short UUID cho deployment: " + uuid_k8s + " (độ dài: " + uuid_k8s.length() + " ký tự)");

        // Validate domainNameSystem từ request
        String domainName = request.getDomainNameSystem();
        if (domainName == null || domainName.trim().isEmpty()) {
            throw new RuntimeException("Domain name system không được để trống");
        }
        System.out.println("[deployFrontend] Sử dụng domain name từ request: " + domainName);

        // Tạo ProjectFrontendEntity và thiết lập các thuộc tính cơ bản
        ProjectFrontendEntity projectEntity = new ProjectFrontendEntity();
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

        // ========== BƯỚC 2: LẤY THÔNG TIN SERVER TỪ DATABASE ==========
        
        // Lấy thông tin các server từ database: MASTER (Kubernetes cluster), DOCKER (build/push images), DATABASE
        Optional<ServerEntity> masterServerOptional = serverRepository.findByRole("MASTER");
        Optional<ServerEntity> dockerServerOptional = serverRepository.findByRole("DOCKER");
        Optional<ServerEntity> databaseServerOptional = serverRepository.findByRole("MASTER");

        // Validate các server bắt buộc
        if (masterServerOptional.isEmpty()) {
            throw new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống.");
        }
        if (dockerServerOptional.isEmpty()) {
            throw new RuntimeException("Không tìm thấy server DOCKER. Vui lòng cấu hình server DOCKER trong hệ thống.");
        }
        if (databaseServerOptional.isEmpty()) {
            throw new RuntimeException("Không tìm thấy server DATABASE. Vui lòng cấu hình server DATABASE trong hệ thống.");
        }

        ServerEntity master_server = masterServerOptional.get();
        ServerEntity docker_server = dockerServerOptional.get();
        ServerEntity database_server = databaseServerOptional.get();

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
                    throw new RuntimeException("Docker image không được để trống khi deployment method là DOCKER");
                }

                projectEntity.setDockerImage(request.getDockerImage());

                // Kết nối SSH đến MASTER server (Kubernetes cluster)
                System.out.println("[deployFrontend] Đang kết nối đến MASTER server: " + master_server.getIp() + ":" + master_server.getPort());
                JSch jsch = new JSch();
                clusterSession = jsch.getSession(master_server.getUsername(), master_server.getIp(), master_server.getPort());
                clusterSession.setPassword(master_server.getPassword());
                Properties config = new Properties();
                config.put("StrictHostKeyChecking", "no"); // Không kiểm tra host key
                clusterSession.setConfig(config);
                clusterSession.setTimeout(7000);
                clusterSession.connect();
                System.out.println("[deployFrontend] Kết nối SSH đến MASTER server thành công");

                // Tạo nội dung YAML file (Deployment + Service + Ingress)
                // Sử dụng uuid_k8s để làm tên resource trong K8s, tránh trùng khi projectName bị trùng
                String fileName = uuid_k8s + ".yaml";
                String yamlContent = "";
                if ("REACT".equals(framework)) {
                    yamlContent = generateFrontendReactYaml(uuid_k8s, request.getDockerImage(), domainName, namespace, projectEntity.getMaxReplicas());
                } else if ("VUE".equals(framework)) {
                    yamlContent = generateFrontendVueYaml(uuid_k8s, request.getDockerImage(), domainName, namespace, projectEntity.getMaxReplicas());
                } else if ("ANGULAR".equals(framework)) {
                    yamlContent = generateFrontendAngularYaml(uuid_k8s, request.getDockerImage(), domainName, namespace, projectEntity.getMaxReplicas());
                }

                // Mở SFTP channel để upload YAML file
                Channel sftpYamlCh = clusterSession.openChannel("sftp");
                sftpYamlCh.connect();
                sftpYaml = (ChannelSftp) sftpYamlCh;
                
                // Tạo thư mục đích với UUID để tránh trùng tên: /home/<master_username>/uploads/<username>/<uuid_k8s của project>/frontend/<uuid_k8s>
                String yamlRemoteDir = "/home/" + master_server.getUsername() + "/uploads/" + user.getUsername() + "/" + project.getUuid_k8s() + "/frontend/" + uuid_k8s;
                System.out.println("[deployFrontend] Tạo/cd thư mục YAML: " + yamlRemoteDir);
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
                
                // Upload YAML file lên MASTER server (Kubernetes cluster)
                InputStream yamlStream = new ByteArrayInputStream(yamlContent.getBytes(StandardCharsets.UTF_8));
                String yamlRemotePath = yamlRemoteDir + "/" + fileName;
                sftpYaml.put(yamlStream, yamlRemotePath);
                System.out.println("[deployFrontend] Đã upload YAML file: " + yamlRemotePath);

                // Lưu yamlPath (đường dẫn YAML trên MASTER server)
                // Với deployment type là DOCKER: không có sourcePath (null)
                projectEntity.setSourcePath(null);
                projectEntity.setYamlPath(yamlRemotePath);

                // Kiểm tra và tạo namespace nếu chưa tồn tại
                ensureNamespaceExists(clusterSession, namespace);

                // Apply YAML file vào Kubernetes cluster bằng kubectl
                System.out.println("[deployFrontend] Đang apply YAML: kubectl apply -f " + yamlRemotePath);
                executeCommand(clusterSession, "kubectl apply -f '" + yamlRemotePath + "'");

            } else if ("FILE".equalsIgnoreCase(request.getDeploymentType())) {
                // ========== PHƯƠNG THỨC 2: DEPLOY TỪ FILE ZIP ==========
                
                // Validate file upload
                if (request.getFile() == null || request.getFile().isEmpty()) {
                    throw new RuntimeException("File upload không được để trống khi deployment method là FILE");
                }

                System.out.println("[deployFrontend] Kết nối SSH tới DOCKER server: " + docker_server.getIp() + ":" + docker_server.getPort());

                // Bước 1: Kết nối SSH đến DOCKER server (để build và push image)
                JSch jsch = new JSch();
                session = jsch.getSession(docker_server.getUsername(), docker_server.getIp(), docker_server.getPort());
                session.setPassword(docker_server.getPassword());
                Properties cfg = new Properties();
                cfg.put("StrictHostKeyChecking", "no");
                session.setConfig(cfg);
                session.setTimeout(7000);
                session.connect();
                System.out.println("[deployFrontend] Đã kết nối SSH DOCKER server thành công");

                // Bước 2: Upload file .zip lên DOCKER server
                Channel ch = session.openChannel("sftp");
                ch.connect();
                sftp = (ChannelSftp) ch;

                // Tạo thư mục đích trên DOCKER server với UUID để tránh trùng tên: /home/<docker_username>/uploads/<username>/<uuid_k8s của project>/frontend/<uuid_k8s>
                String remoteBase = "/home/" + docker_server.getUsername() + "/uploads/" + user.getUsername() + "/" + project.getUuid_k8s() + "/frontend/" + uuid_k8s;
                System.out.println("[deployFrontend] Tạo/cd thư mục đích: " + remoteBase);
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
                System.out.println("[deployFrontend] Upload file lên: " + remoteZipPath);
                sftp.put(request.getFile().getInputStream(), remoteZipPath);
                
                // Lưu sourcePath (đường dẫn file zip trên DOCKER server)
                projectEntity.setSourcePath(remoteZipPath);

                // Bước 3: Giải nén file .zip trên DOCKER server
                String unzipCmd = "cd " + remoteBase + " && unzip -o '" + safeName + "'";
                System.out.println("[deployFrontend] Giải nén: " + unzipCmd);
                executeCommand(session, unzipCmd);

                // Bước 4: Build và push Docker image
                // Xác định thư mục project sau khi giải nén
                String extractedDir = safeName.endsWith(".zip") ? safeName.substring(0, safeName.length() - 4) : safeName;
                String projectDir = remoteBase + "/" + extractedDir;

                // Kiểm tra Dockerfile có tồn tại không
                String checkDockerfile = "test -f '" + projectDir + "/Dockerfile' && echo OK || echo NO";
                System.out.println("[deployFrontend] Kiểm tra Dockerfile: " + checkDockerfile);
                String check = executeCommand(session, checkDockerfile);
                if (!"OK".equals(check.trim())) {
                    throw new RuntimeException("Không tìm thấy Dockerfile trong gói source đã giải nén");
                }

                // Build Docker image từ Dockerfile
                // Sử dụng uuid_k8s thay vì projectName để tránh trùng tên image
                String imageTag = dockerhub_username + "/" + uuid_k8s + ":latest";
                String buildCmd = "cd '" + projectDir + "' && docker build -t '" + imageTag + "' .";
                System.out.println("[deployFrontend] Docker build: " + buildCmd);
                executeCommand(session, buildCmd);
                
                // Push image lên DockerHub
                String pushCmd = "docker push '" + imageTag + "'";
                System.out.println("[deployFrontend] Docker push: " + pushCmd);
                executeCommand(session, pushCmd);

                projectEntity.setDockerImage(imageTag); // Lưu image tag vào database

                // Dọn dẹp: Xóa Docker image local sau khi push thành công
                try {
                    String rmiCmd = "docker rmi '" + escapeSingleQuotes(imageTag) + "' || true";
                    System.out.println("[deployFrontend] Dọn dẹp Docker image: " + rmiCmd);
                    executeCommand(session, rmiCmd, true);
                    System.out.println("[deployFrontend] Đã dọn dẹp Docker image: " + imageTag);
                } catch (Exception cleanupEx) {
                    System.err.println("[deployFrontend] Lỗi khi dọn dẹp Docker image (bỏ qua): " + cleanupEx.getMessage());
                }

                // Dọn dẹp: Xóa thư mục mã nguồn đã upload và giải nén
                try {
                    String cleanupDirCmd = "rm -rf '" + escapeSingleQuotes(remoteBase) + "' || true";
                    System.out.println("[deployFrontend] Dọn dẹp thư mục mã nguồn: " + cleanupDirCmd);
                    executeCommand(session, cleanupDirCmd, true);
                    System.out.println("[deployFrontend] Đã dọn dẹp thư mục mã nguồn: " + remoteBase);
                } catch (Exception cleanupEx) {
                    System.err.println("[deployFrontend] Lỗi khi dọn dẹp thư mục mã nguồn (bỏ qua): " + cleanupEx.getMessage());
                }
                try {
                    String uploadsRoot = "/home/" + docker_server.getUsername() + "/uploads";
                    String cleanupUploadsCmd = "rm -rf '" + escapeSingleQuotes(uploadsRoot) + "' || true";
                    System.out.println("[deployFrontend] Dọn dẹp thư mục uploads: " + cleanupUploadsCmd);
                    executeCommand(session, cleanupUploadsCmd, true);
                } catch (Exception cleanupEx) {
                    System.err.println("[deployFrontend] Lỗi khi dọn dẹp thư mục uploads (bỏ qua): " + cleanupEx.getMessage());
                }

                // Bước 5: Tạo YAML và apply lên Kubernetes cluster (MASTER server)
                System.out.println("[deployFrontend] Chuyển sang MASTER server để upload/apply YAML: " + master_server.getIp() + ":" + master_server.getPort());

                // Tạo nội dung YAML file
                // Sử dụng uuid_k8s để làm tên resource trong K8s, tránh trùng khi projectName bị trùng
                String fileName = uuid_k8s + ".yaml";    
                String yamlContent = "";
                if ("REACT".equals(framework)) {
                    yamlContent = generateFrontendReactYaml(uuid_k8s, imageTag, domainName, namespace, projectEntity.getMaxReplicas());
                } else if ("VUE".equals(framework)) {
                    yamlContent = generateFrontendVueYaml(uuid_k8s, imageTag, domainName, namespace, projectEntity.getMaxReplicas());
                } else if ("ANGULAR".equals(framework)) {
                    yamlContent = generateFrontendAngularYaml(uuid_k8s, imageTag, domainName, namespace, projectEntity.getMaxReplicas());
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
                System.out.println("[deployFrontend] Kết nối SSH tới MASTER server thành công");

                // Mở SFTP channel để upload YAML file
                Channel sftpYamlCh = clusterSession.openChannel("sftp");
                sftpYamlCh.connect();
                sftpYaml = (ChannelSftp) sftpYamlCh;
                
                // Tạo thư mục đích trên MASTER server với UUID để tránh trùng tên: /home/<master_username>/uploads/<username>/<uuid_k8s của project>/frontend/<uuid_k8s>
                String yamlRemoteDir = "/home/" + master_server.getUsername() + "/uploads/" + user.getUsername() + "/" + project.getUuid_k8s() + "/frontend/" + uuid_k8s;
                System.out.println("[deployFrontend] Tạo/cd thư mục YAML: " + yamlRemoteDir);
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
                System.out.println("[deployFrontend] Upload YAML: " + yamlRemotePath);

                // Lưu yamlPath (đường dẫn YAML trên MASTER server)
                // Với FILE method: đã có sourcePath (đã set ở trên), giờ set thêm yamlPath
                projectEntity.setYamlPath(yamlRemotePath);

                // Kiểm tra và tạo namespace nếu chưa tồn tại
                ensureNamespaceExists(clusterSession, namespace);

                // Apply YAML file vào Kubernetes cluster
                System.out.println("[deployFrontend] Đang apply YAML: kubectl apply -f " + yamlRemotePath);
                executeCommand(clusterSession, "kubectl apply -f '" + yamlRemotePath + "'");
            }

            // ========== BƯỚC 4: CẬP NHẬT TRẠNG THÁI VÀ TRẢ VỀ KẾT QUẢ ==========
            
            // Cập nhật trạng thái project thành RUNNING
            projectEntity.setStatus("RUNNING");
            projectFrontendRepository.save(projectEntity);
            System.out.println("[deployFrontend] Hoàn tất triển khai frontend, projectName=" + projectName + ", domain=" + domainName);

            // Tạo response và trả về
            DeployFrontendResponse response = new DeployFrontendResponse();
            response.setUrl("http://" + domainName);
            response.setStatus(projectEntity.getStatus());
            response.setDomainNameSystem(domainName);
            return response;

        } catch (Exception ex) {
            // ========== XỬ LÝ LỖI ==========
            System.err.println("[deployFrontend] Lỗi: " + ex.getMessage());
            ex.printStackTrace();
            // Cập nhật trạng thái project thành ERROR
            projectEntity.setStatus("ERROR");
            projectFrontendRepository.save(projectEntity);
            throw new RuntimeException("Lỗi khi triển khai frontend: " + ex.getMessage(), ex);
        } finally {
            // ========== DỌN DẸP TÀI NGUYÊN ==========
            // Đảm bảo đóng tất cả các kết nối SSH/SFTP để giải phóng tài nguyên
            if (sftp != null && sftp.isConnected()) sftp.disconnect();
            if (session != null && session.isConnected()) session.disconnect();
            if (sftpYaml != null && sftpYaml.isConnected()) sftpYaml.disconnect();
            if (clusterSession != null && clusterSession.isConnected()) clusterSession.disconnect();
            System.out.println("[deployFrontend] Đã đóng các kết nối SSH/SFTP");
        }
    }

    @Override
    public void stopFrontend(Long projectId, Long frontendId) {
        System.out.println("[stopFrontend] Yêu cầu dừng frontend projectId=" + projectId + ", frontendId=" + frontendId);

        // Lấy ProjectEntity để xác định namespace và quyền sở hữu
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project không tồn tại với id: " + projectId));

        // Lấy ProjectFrontendEntity theo frontendId
        ProjectFrontendEntity frontend = projectFrontendRepository.findById(frontendId)
                .orElseThrow(() -> new RuntimeException("Frontend project không tồn tại với id: " + frontendId));

        // Đảm bảo frontend thuộc đúng project
        if (frontend.getProject() == null || !frontend.getProject().getId().equals(project.getId())) {
            throw new RuntimeException("Frontend project không thuộc về project này");
        }

        // Scale replicas về 0 để dừng ứng dụng
        scaleFrontendDeployment(project, frontend, 0);

        // Cập nhật trạng thái trong database
        frontend.setStatus("STOPPED");
        projectFrontendRepository.save(frontend);
        System.out.println("[stopFrontend] Đã dừng frontend thành công");
    }

    @Override
    public void startFrontend(Long projectId, Long frontendId) {
        System.out.println("[startFrontend] Yêu cầu khởi động frontend projectId=" + projectId + ", frontendId=" + frontendId);

        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project không tồn tại với id: " + projectId));

        // Lấy frontend cần khởi động
        ProjectFrontendEntity frontend = projectFrontendRepository.findById(frontendId)
                .orElseThrow(() -> new RuntimeException("Frontend project không tồn tại với id: " + frontendId));

        // Kiểm tra frontend thuộc về project
        if (frontend.getProject() == null || !frontend.getProject().getId().equals(project.getId())) {
            throw new RuntimeException("Frontend project không thuộc về project này");
        }

        // Scale replicas lên 1 để khởi động lại
        scaleFrontendDeployment(project, frontend, 1);

        // Cập nhật trạng thái
        frontend.setStatus("RUNNING");
        projectFrontendRepository.save(frontend);
        System.out.println("[startFrontend] Đã khởi động frontend thành công");
    }

    @Override
    public void deleteFrontend(Long projectId, Long frontendId) {
        System.out.println("[deleteFrontend] Yêu cầu xóa frontend projectId=" + projectId + ", frontendId=" + frontendId);

        // Lấy project và đảm bảo tồn tại
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project không tồn tại với id: " + projectId));

        // Lấy frontend cần xóa
        ProjectFrontendEntity frontend = projectFrontendRepository.findById(frontendId)
                .orElseThrow(() -> new RuntimeException("Frontend project không tồn tại với id: " + frontendId));

        // Đảm bảo frontend thuộc về project này
        if (frontend.getProject() == null || !frontend.getProject().getId().equals(project.getId())) {
            throw new RuntimeException("Frontend project không thuộc về project này");
        }

        // Xóa resources trên Kubernetes
        deleteFrontendResources(project, frontend);

        // Xóa record khỏi database
        projectFrontendRepository.delete(frontend);
        System.out.println("[deleteFrontend] Đã xóa frontend thành công");
    }

    @Override
    public FrontendReplicaInfoResponse getFrontendReplicaInfo(Long frontendId) {
        if (frontendId == null) {
            throw new RuntimeException("frontendId không được để trống");
        }

        ProjectFrontendEntity frontend = projectFrontendRepository.findById(frontendId)
                .orElseThrow(() -> new RuntimeException("Frontend không tồn tại với id: " + frontendId));

        FrontendReplicaInfoResponse response = new FrontendReplicaInfoResponse();
        response.setFrontendId(frontend.getId());
        response.setReplicas(frontend.getReplicas());
        response.setMaxReplicas(frontend.getMaxReplicas());
        response.setHasPendingRequest(false);
        response.setMessage("Bạn có thể gửi yêu cầu điều chỉnh replicas.");

        Optional<FrontendRequestEntity> pendingRequest = frontendRequestRepository
                .findFirstByFrontend_IdAndStatus(frontendId, "PENDING");

        pendingRequest.ifPresent(request -> {
            response.setHasPendingRequest(true);
            response.setPendingRequestId(request.getId());
            response.setPendingNewReplicas(request.getNewReplicas());
            response.setPendingStatus(request.getStatus());
            response.setMessage("Bạn đã gửi yêu cầu điều chỉnh replicas từ " + request.getOldReplicas() + " thành " + request.getNewReplicas() + " và đang chờ phê duyệt.");
        });

        return response;
    }

    private void scaleFrontendDeployment(ProjectEntity project, ProjectFrontendEntity frontend, int replicas) {
        // Lấy namespace từ project để xác định không gian làm việc trên K8s
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace. Không thể thay đổi replicas frontend.");
        }

        // Tên deployment tuân theo convention app-<uuid_k8s>
        String deploymentName = "app-" + frontend.getUuid_k8s();

        // Lấy thông tin server MASTER để truy cập kubeconfig
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session clusterSession = null;
        try {
            // Kết nối SSH tới MASTER để đọc kubeconfig
            JSch jsch = new JSch();
            clusterSession = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
            clusterSession.setPassword(masterServer.getPassword());
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            clusterSession.setConfig(config);
            clusterSession.setTimeout(7000);
            clusterSession.connect();
            System.out.println("[scaleFrontendDeployment] Đã kết nối MASTER server để scale deployment");

            // Tạo Kubernetes client dựa trên kubeconfig vừa đọc
            ApiClient client = createKubernetesClient(clusterSession);
            AppsV1Api appsApi = new AppsV1Api(client);

            // Đọc object Scale hiện tại, sau đó cập nhật số replicas
            V1Scale scale = appsApi.readNamespacedDeploymentScale(deploymentName, namespace, null);
            if (scale.getSpec() == null) {
                scale.setSpec(new io.kubernetes.client.openapi.models.V1ScaleSpec());
            }
            scale.getSpec().setReplicas(replicas);
            appsApi.replaceNamespacedDeploymentScale(deploymentName, namespace, scale, null, null, null, null);
            System.out.println("[scaleFrontendDeployment] Đã scale deployment " + deploymentName + " về " + replicas + " replica(s)");
        } catch (Exception e) {
            System.err.println("[scaleFrontendDeployment] Lỗi: " + e.getMessage());
            throw new RuntimeException("Không thể scale frontend: " + e.getMessage(), e);
        } finally {
            // Đóng SSH session để tránh rò rỉ kết nối
            if (clusterSession != null && clusterSession.isConnected()) {
                clusterSession.disconnect();
            }
        }
    }

    private void deleteFrontendResources(ProjectEntity project, ProjectFrontendEntity frontend) {
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace. Không thể xóa resources frontend.");
        }

        String uuid = frontend.getUuid_k8s();
        if (uuid == null || uuid.trim().isEmpty()) {
            throw new RuntimeException("Frontend không có uuid_k8s. Không thể xóa resources frontend.");
        }

        String deploymentName = "app-" + uuid;
        String serviceName = deploymentName + "-svc";
        String ingressName = deploymentName + "-ing";

        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session clusterSession = null;
        try {
            // Kết nối SSH tới server MASTER để chạy lệnh kubectl
            JSch jsch = new JSch();
            clusterSession = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
            clusterSession.setPassword(masterServer.getPassword());
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            clusterSession.setConfig(config);
            clusterSession.setTimeout(7000);
            clusterSession.connect();
            System.out.println("[deleteFrontendResources] Đã kết nối MASTER server để xóa resources");

            // Xóa ingress
            String deleteIngressCmd = String.format("kubectl -n %s delete ing/%s || true", namespace, ingressName);
            System.out.println("[deleteFrontendResources] " + deleteIngressCmd);
            executeCommand(clusterSession, deleteIngressCmd, true);

            // Xóa service
            String deleteServiceCmd = String.format("kubectl -n %s delete svc/%s || true", namespace, serviceName);
            System.out.println("[deleteFrontendResources] " + deleteServiceCmd);
            executeCommand(clusterSession, deleteServiceCmd, true);

            // Xóa deployment
            String deleteDeploymentCmd = String.format("kubectl -n %s delete deploy/%s || true", namespace, deploymentName);
            System.out.println("[deleteFrontendResources] " + deleteDeploymentCmd);
            executeCommand(clusterSession, deleteDeploymentCmd, true);

            // Xóa file YAML nếu có
            String yamlPath = frontend.getYamlPath();
            if (yamlPath != null && !yamlPath.trim().isEmpty()) {
                String cleanedPath = yamlPath.trim();
                String deleteYamlCmd = String.format("rm -f '%s'", escapeSingleQuotes(cleanedPath));
                System.out.println("[deleteFrontendResources] " + deleteYamlCmd);
                executeCommand(clusterSession, deleteYamlCmd, true);

                // Nếu xác định được thư mục chứa YAML thì xóa luôn thư mục
                java.io.File yamlFile = new java.io.File(cleanedPath);
                String parentDir = yamlFile.getParent();
                if (parentDir != null && !parentDir.trim().isEmpty()) {
                    String deleteDirCmd = String.format("rm -rf '%s'", escapeSingleQuotes(parentDir.trim()));
                    System.out.println("[deleteFrontendResources] " + deleteDirCmd);
                    executeCommand(clusterSession, deleteDirCmd, true);
                }
            }

        } catch (Exception e) {
            System.err.println("[deleteFrontendResources] Lỗi: " + e.getMessage());
            throw new RuntimeException("Không thể xóa resources frontend: " + e.getMessage(), e);
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

