package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.Session;
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
import my_spring_app.my_spring_app.dto.reponse.NodeResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceListResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.DeploymentListResponse;
import my_spring_app.my_spring_app.dto.reponse.DeploymentResponse;
import my_spring_app.my_spring_app.dto.reponse.PodListResponse;
import my_spring_app.my_spring_app.dto.reponse.PodResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetListResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceListResponse;
import my_spring_app.my_spring_app.dto.reponse.IngressListResponse;
import my_spring_app.my_spring_app.dto.reponse.PVCListResponse;
import my_spring_app.my_spring_app.dto.reponse.PVListResponse;
import my_spring_app.my_spring_app.dto.request.NamespaceRequest;
import my_spring_app.my_spring_app.entity.ProjectEntity;
import my_spring_app.my_spring_app.entity.ProjectBackendEntity;
import my_spring_app.my_spring_app.entity.ProjectDatabaseEntity;
import my_spring_app.my_spring_app.entity.ProjectFrontendEntity;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.entity.UserEntity;
import my_spring_app.my_spring_app.repository.ProjectRepository;
import my_spring_app.my_spring_app.repository.ProjectDatabaseRepository;
import my_spring_app.my_spring_app.repository.ProjectBackendRepository;
import my_spring_app.my_spring_app.repository.ProjectFrontendRepository;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.repository.UserRepository;
import my_spring_app.my_spring_app.service.AdminService;
import my_spring_app.my_spring_app.service.AdminNamespaceService;
import my_spring_app.my_spring_app.service.AdminServiceDiscoveryService;
import my_spring_app.my_spring_app.service.AdminStorageService;
import my_spring_app.my_spring_app.service.AdminWorkloadService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.NetworkingV1Api;
import io.kubernetes.client.openapi.models.V1Pod;
import io.kubernetes.client.openapi.models.V1PodStatus;
import io.kubernetes.client.openapi.models.V1Service;
import io.kubernetes.client.openapi.models.V1ServiceSpec;
import io.kubernetes.client.openapi.models.V1ServicePort;
import io.kubernetes.client.openapi.models.V1ServiceStatus;
import io.kubernetes.client.openapi.models.V1Ingress;
import io.kubernetes.client.openapi.models.V1IngressSpec;
import io.kubernetes.client.openapi.models.V1IngressRule;
import io.kubernetes.client.openapi.models.V1IngressStatus;
import io.kubernetes.client.openapi.models.V1IngressLoadBalancerIngress;
import io.kubernetes.client.openapi.models.V1PersistentVolumeClaim;
import io.kubernetes.client.openapi.models.V1PersistentVolumeClaimSpec;
import io.kubernetes.client.openapi.models.V1PersistentVolumeClaimStatus;
import io.kubernetes.client.openapi.models.V1PersistentVolume;
import io.kubernetes.client.openapi.models.V1PersistentVolumeSpec;
import io.kubernetes.client.openapi.models.V1StatefulSet;
import io.kubernetes.client.openapi.models.V1Deployment;
import io.kubernetes.client.openapi.models.V1DeploymentStatus;
import io.kubernetes.client.openapi.models.V1Node;
import io.kubernetes.client.openapi.models.V1NodeList;
import io.kubernetes.client.openapi.models.V1NodeStatus;
import io.kubernetes.client.openapi.models.V1NodeCondition;
import io.kubernetes.client.openapi.models.V1NodeSystemInfo;
import io.kubernetes.client.util.Yaml;
import io.kubernetes.client.util.Config;
import io.kubernetes.client.openapi.Configuration;
import java.io.File;
import java.io.FileWriter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Dịch vụ phục vụ dashboard admin: thống kê tổng quan và usage của từng user.
 * 
 * Class này cung cấp các chức năng:
 * - Lấy tổng quan hệ thống (số user, project, CPU/Memory đang dùng)
 * - Lấy thống kê usage theo từng user
 * - Lấy chi tiết tài nguyên của project (Database/Backend/Frontend)
 * - Lấy thông tin cluster capacity và allocatable
 * - Lấy chi tiết thông tin Kubernetes cho Database/Backend/Frontend
 * 
 * Tất cả các thao tác với Kubernetes được thực hiện qua SSH đến server MASTER.
 */
@Service
@Transactional
public class AdminServiceImpl extends BaseKubernetesService implements AdminService {

    /**
     * Role chuẩn dùng để lọc user thuộc nhóm khách hàng (không phải admin/devops).
     * Chỉ các user có role "USER" mới được tính vào thống kê.
     */
    private static final String ROLE_USER = "USER";
    
    public AdminServiceImpl(
            UserRepository userRepository,
            ProjectRepository projectRepository,
            ProjectDatabaseRepository projectDatabaseRepository,
            ProjectBackendRepository projectBackendRepository,
            ProjectFrontendRepository projectFrontendRepository,
            ServerRepository serverRepository,
            AdminNamespaceService adminNamespaceService,
            AdminWorkloadService adminWorkloadService,
            AdminServiceDiscoveryService adminServiceDiscoveryService,
            AdminStorageService adminStorageService) {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.projectDatabaseRepository = projectDatabaseRepository;
        this.projectBackendRepository = projectBackendRepository;
        this.projectFrontendRepository = projectFrontendRepository;
        this.serverRepository = serverRepository;
        this.adminNamespaceService = adminNamespaceService;
        this.adminWorkloadService = adminWorkloadService;
        this.adminServiceDiscoveryService = adminServiceDiscoveryService;
        this.adminStorageService = adminStorageService;
    }

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ProjectDatabaseRepository projectDatabaseRepository;
    private final ProjectBackendRepository projectBackendRepository;
    private final ProjectFrontendRepository projectFrontendRepository;
    private final ServerRepository serverRepository;
    private final AdminNamespaceService adminNamespaceService;
    private final AdminWorkloadService adminWorkloadService;
    private final AdminServiceDiscoveryService adminServiceDiscoveryService;
    private final AdminStorageService adminStorageService;

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
     * Tổng hợp số lượng user, project và tài nguyên CPU/Memory đang sử dụng trên
     * toàn hệ thống.
     * 
     * Quy trình xử lý:
     * 1. Đếm tổng số user có role USER (loại trừ admin/devops)
     * 2. Lấy toàn bộ project từ database và đếm tổng số
     * 3. Gom các namespace đang được sử dụng (tránh trùng lặp)
     * 4. Chạy kubectl top pods để lấy tổng CPU/Memory đang sử dụng
     * 5. Chuyển đổi và làm tròn dữ liệu để trả về
     * 
     * @return AdminOverviewResponse chứa tổng số user, project, CPU cores và Memory
     *         GB đang dùng
     */
    @Override
    public AdminOverviewResponse getOverview() {
        // Bước 1: Đếm tổng user có role USER (không bao gồm admin/devops)
        long totalUsers = userRepository.countByRole(ROLE_USER);

        // Bước 2: Lấy toàn bộ project từ database để đếm và gom namespace
        List<ProjectEntity> projects = projectRepository.findAll();
        long totalProjects = projects.size();

        // Bước 3: Gom các namespace đang được sử dụng (loại bỏ trùng lặp)
        Set<String> namespaces = collectNamespaces(projects);

        // Bước 4: Chạy kubectl top pods để lấy tổng CPU/Memory đang sử dụng
        // Hàm này sẽ SSH đến MASTER server và thực thi lệnh kubectl top pods cho từng
        // namespace
        ResourceUsageMap usageMap = calculateUsagePerNamespace(namespaces);

        // Bước 5: Mapping dữ liệu vào response object
        AdminOverviewResponse response = new AdminOverviewResponse();
        response.setTotalUsers(totalUsers);
        response.setTotalProjects(totalProjects);
        // Làm tròn CPU cores và chuyển Memory từ bytes sang GB, làm tròn 3 chữ số thập
        // phân
        response.setTotalCpuCores(roundToThreeDecimals(usageMap.totalUsage().getCpuCores()));
        response.setTotalMemoryGb(roundToThreeDecimals(bytesToGb(usageMap.totalUsage().getMemoryBytes())));
        
        return response;
    }

    /**
     * Lấy tổng quan usage (CPU/Memory) của các project thuộc một user cụ thể.
     * 
     * Quy trình xử lý:
     * 1. Kiểm tra user có tồn tại và có role USER không
     * 2. Lọc các project thuộc về user này
     * 3. Gom các namespace của các project đó
     * 4. Tính tổng CPU/Memory đang sử dụng từ các namespace
     * 5. Trả về thông tin tổng hợp
     * 
     * @param userId ID của user cần lấy thống kê
     * @return AdminUserProjectSummaryResponse chứa thông tin user và tổng
     *         CPU/Memory đang dùng
     * @throws RuntimeException nếu user không tồn tại hoặc không có role USER
     */
    @Override
    public AdminUserProjectSummaryResponse getUserProjectSummary(Long userId) {
        // Bước 1: Kiểm tra user có tồn tại không
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy user với id " + userId));
        
        // Bước 2: Kiểm tra user có role USER không (chỉ user role USER mới được tính)
        if (!ROLE_USER.equalsIgnoreCase(user.getRole())) {
            throw new RuntimeException("User không hợp lệ hoặc không có role USER");
        }

        // Bước 3: Lọc các project thuộc về user này
        List<ProjectEntity> projects = projectRepository.findAll();
        List<ProjectEntity> userProjects = projects.stream()
                .filter(project -> project.getUser() != null && userId.equals(project.getUser().getId()))
                .toList();

        // Bước 4: Gom các namespace của các project này (tránh trùng lặp)
        Set<String> namespaces = collectNamespaces(userProjects);

        // Bước 5: Tính tổng CPU/Memory đang sử dụng từ các namespace
        ResourceUsageMap usageMap = calculateUsagePerNamespace(namespaces);

        // Bước 6: Build response object
        AdminUserProjectSummaryResponse response = new AdminUserProjectSummaryResponse();
        response.setUserId(user.getId());
        response.setFullname(user.getFullname());
        response.setUsername(user.getUsername());
        response.setProjectCount(userProjects.size());
        // Làm tròn CPU cores và chuyển Memory từ bytes sang GB
        response.setCpuCores(roundToThreeDecimals(usageMap.totalUsage().getCpuCores()));
        response.setMemoryGb(roundToThreeDecimals(bytesToGb(usageMap.totalUsage().getMemoryBytes())));
        
        return response;
    }

    /**
     * Lấy danh sách project chi tiết cho một user (số resource theo từng project).
     * 
     * Quy trình xử lý:
     * 1. Kiểm tra user có tồn tại và có role USER không
     * 2. Lọc các project thuộc về user này
     * 3. Gom các namespace và tính usage cho từng namespace
     * 4. Với mỗi project, tạo một item thống kê bao gồm:
     * - Số lượng Database/Backend/Frontend
     * - CPU và Memory đang sử dụng (lấy từ namespace của project)
     * 5. Trả về danh sách các project với thông tin chi tiết
     * 
     * @param userId ID của user cần lấy danh sách project
     * @return AdminUserProjectListResponse chứa danh sách project với thông tin chi
     *         tiết
     * @throws RuntimeException nếu user không tồn tại hoặc không có role USER
     */
    @Override
    public AdminUserProjectListResponse getUserProjectsDetail(Long userId) {
        // Bước 1: Kiểm tra user có tồn tại không
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy user với id " + userId));
        
        // Bước 2: Kiểm tra user có role USER không
        if (!ROLE_USER.equalsIgnoreCase(user.getRole())) {
            throw new RuntimeException("User không hợp lệ hoặc không có role USER");
        }

        // Bước 3: Lọc các project thuộc về user này
        List<ProjectEntity> projects = projectRepository.findAll().stream()
                .filter(project -> project.getUser() != null && userId.equals(project.getUser().getId()))
                .toList();

        // Bước 4: Gom các namespace và tính usage cho từng namespace
        Set<String> namespaces = collectNamespaces(projects);
        ResourceUsageMap usageMap = calculateUsagePerNamespace(namespaces);

        // Bước 5: Tạo item thống kê cho từng project
        List<AdminUserProjectListResponse.ProjectUsageItem> items = new ArrayList<>();
        for (ProjectEntity project : projects) {
            // Tạo item thống kê cho project này
            AdminUserProjectListResponse.ProjectUsageItem item = new AdminUserProjectListResponse.ProjectUsageItem();
            item.setProjectId(project.getId());
            item.setProjectName(project.getProjectName());
            
            // Đếm số lượng Database/Backend/Frontend (xử lý null-safe)
            item.setDatabaseCount(project.getDatabases() != null ? project.getDatabases().size() : 0);
            item.setBackendCount(project.getBackends() != null ? project.getBackends().size() : 0);
            item.setFrontendCount(project.getFrontends() != null ? project.getFrontends().size() : 0);

            // Lấy usage từ namespace của project (nếu có)
            BaseKubernetesService.ResourceUsage usage = null;
            if (project.getNamespace() != null && !project.getNamespace().trim().isEmpty()) {
                usage = usageMap.namespaceUsage().get(project.getNamespace().trim());
            }
            
            // Tính CPU và Memory (nếu không có usage thì mặc định là 0)
            double cpu = usage != null ? usage.getCpuCores() : 0.0;
            double memoryGb = usage != null ? bytesToGb(usage.getMemoryBytes()) : 0.0;
            
            // Làm tròn và set vào item
            item.setCpuCores(roundToThreeDecimals(cpu));
            item.setMemoryGb(roundToThreeDecimals(memoryGb));
            
            items.add(item);
        }

        // Bước 6: Tạo response object và trả về
        AdminUserProjectListResponse response = new AdminUserProjectListResponse();
        response.setUserId(user.getId());
        response.setFullname(user.getFullname());
        response.setUsername(user.getUsername());
        response.setProjects(items);
        
        return response;
    }

    /**
     * Lấy chi tiết tài nguyên (CPU/Memory) của một project, bao gồm từng
     * Database/Backend/Frontend.
     * 
     * Quy trình xử lý:
     * 1. Kiểm tra project có tồn tại và có namespace không
     * 2. Kết nối SSH đến MASTER server
     * 3. Với mỗi Database/Backend/Frontend trong project:
     * - Lấy uuid_k8s để tạo app label
     * - Chạy kubectl top pods với label selector để lấy CPU/Memory
     * - Cộng dồn vào tổng
     * 4. Trả về chi tiết usage cho từng thành phần và tổng
     * 
     * @param projectId ID của project cần lấy chi tiết
     * @return AdminProjectResourceDetailResponse chứa chi tiết CPU/Memory của từng
     *         Database/Backend/Frontend
     * @throws RuntimeException nếu project không tồn tại hoặc không có namespace
     */
    @Override
    public AdminProjectResourceDetailResponse getProjectResourceDetail(Long projectId) {
        
        // Bước 1: Kiểm tra project có tồn tại không
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy project với id " + projectId));
        
        // Bước 2: Kiểm tra project có namespace không (namespace là bắt buộc để truy
        // vấn Kubernetes)
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project chưa được cấu hình namespace, không thể lấy metrics");
        }
        namespace = namespace.trim();

        // Bước 3: Lấy thông tin server MASTER để kết nối SSH
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        // Bước 4: Khởi tạo response object
        AdminProjectResourceDetailResponse response = new AdminProjectResourceDetailResponse();
        response.setProjectId(project.getId()); // Lưu lại id để FE biết project nào
        response.setProjectName(project.getProjectName()); // Lưu lại tên hiển thị

        // Các list lưu usage chi tiết theo từng nhóm thành phần
        // (Database/Backend/Frontend)
        List<AdminProjectResourceDetailResponse.ComponentUsage> databaseUsages = new ArrayList<>();
        List<AdminProjectResourceDetailResponse.ComponentUsage> backendUsages = new ArrayList<>();
        List<AdminProjectResourceDetailResponse.ComponentUsage> frontendUsages = new ArrayList<>();

        // Biến để cộng dồn tổng CPU và Memory của toàn bộ project
        double totalCpu = 0.0; // Tổng CPU cộng dồn (đơn vị: cores)
        double totalMemoryGb = 0.0; // Tổng Memory cộng dồn (đơn vị: GB)

        // Session SSH tới MASTER server để chạy các lệnh kubectl
        Session session = null;
        try {
            // Bước 5: Tạo SSH session và kết nối đến MASTER server
            session = createSession(masterServer);

            // Bước 6: Xử lý các Database trong project
            if (project.getDatabases() != null) {
                for (ProjectDatabaseEntity database : project.getDatabases()) {
                    // Bỏ qua database không có uuid_k8s (chưa được deploy)
                    if (database.getUuid_k8s() == null || database.getUuid_k8s().trim().isEmpty()) {
                        continue;
                    }
                    
                    // Tạo app label theo format: "db-{uuid_k8s}" (format chuẩn khi deploy database)
                    String appLabel = "db-" + database.getUuid_k8s().trim();
                    
                    // Gọi kubectl top pods với label selector để lấy CPU/Memory của các pod có
                    // label này
                    BaseKubernetesService.ResourceUsage usage = fetchUsageForApp(session, namespace, appLabel);
                    double cpu = usage.getCpuCores();
                    double memoryGb = bytesToGb(usage.getMemoryBytes());

                    // Tạo ComponentUsage object và thêm vào danh sách
                    databaseUsages.add(new AdminProjectResourceDetailResponse.ComponentUsage(
                            database.getId(),
                            database.getProjectName(),
                            database.getStatus(),
                            roundToThreeDecimals(cpu), // Làm tròn 3 chữ số thập phân
                            roundToThreeDecimals(memoryGb) // Làm tròn 3 chữ số thập phân
                    ));

                    // Cộng dồn vào tổng
                    totalCpu += cpu;
                    totalMemoryGb += memoryGb;
                }
            }

            // Bước 7: Xử lý các Backend trong project
            if (project.getBackends() != null) {
                for (ProjectBackendEntity backend : project.getBackends()) {
                    // Bỏ qua backend không có uuid_k8s (chưa được deploy)
                    if (backend.getUuid_k8s() == null || backend.getUuid_k8s().trim().isEmpty()) {
                        continue;
                    }
                    
                    // Tạo app label theo format: "app-{uuid_k8s}" (format chuẩn khi deploy backend)
                    String appLabel = "app-" + backend.getUuid_k8s().trim();
                    
                    // Gọi kubectl top pods với label selector để lấy CPU/Memory
                    ResourceUsage usage = fetchUsageForApp(session, namespace, appLabel);
                    double cpu = usage.getCpuCores();
                    double memoryGb = bytesToGb(usage.getMemoryBytes());

                    // Tạo ComponentUsage object và thêm vào danh sách
                    backendUsages.add(new AdminProjectResourceDetailResponse.ComponentUsage(
                            backend.getId(),
                            backend.getProjectName(),
                            backend.getStatus(),
                            roundToThreeDecimals(cpu),
                            roundToThreeDecimals(memoryGb)));

                    // Cộng dồn vào tổng
                    totalCpu += cpu;
                    totalMemoryGb += memoryGb;
                }
            }

            // Bước 8: Xử lý các Frontend trong project
            if (project.getFrontends() != null) {
                for (ProjectFrontendEntity frontend : project.getFrontends()) {
                    // Bỏ qua frontend không có uuid_k8s (chưa được deploy)
                    if (frontend.getUuid_k8s() == null || frontend.getUuid_k8s().trim().isEmpty()) {
                        continue;
                    }
                    
                    // Tạo app label theo format: "app-{uuid_k8s}" (format chuẩn khi deploy
                    // frontend, giống backend)
                    String appLabel = "app-" + frontend.getUuid_k8s().trim();
                    
                    // Gọi kubectl top pods với label selector để lấy CPU/Memory
                    ResourceUsage usage = fetchUsageForApp(session, namespace, appLabel);
                    double cpu = usage.getCpuCores();
                    double memoryGb = bytesToGb(usage.getMemoryBytes());

                    // Tạo ComponentUsage object và thêm vào danh sách
                    frontendUsages.add(new AdminProjectResourceDetailResponse.ComponentUsage(
                            frontend.getId(),
                            frontend.getProjectName(),
                            frontend.getStatus(),
                            roundToThreeDecimals(cpu),
                            roundToThreeDecimals(memoryGb)));

                    // Cộng dồn vào tổng
                    totalCpu += cpu;
                    totalMemoryGb += memoryGb;
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy metrics cho project: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }

        // 4. Tổng hợp dữ liệu trả về
        response.setDatabases(databaseUsages);
        response.setBackends(backendUsages);
        response.setFrontends(frontendUsages);
        response.setTotalCpuCores(roundToThreeDecimals(totalCpu));
        response.setTotalMemoryGb(roundToThreeDecimals(totalMemoryGb));
        return response;
    }

    /**
     * Lấy usage tổng quan cho từng user (số project, CPU, Memory).
     * 
     * Quy trình xử lý:
     * 1. Khởi tạo map chứa thống kê cho từng user có role USER
     * 2. Duyệt tất cả project, đếm số project và ghi lại namespace thuộc user nào
     * 3. Gom các namespace và tính usage cho từng namespace
     * 4. Phân bổ usage của namespace về user sở hữu namespace đó
     * 5. Làm tròn dữ liệu và trả về
     * 
     * @return AdminUserUsageResponse chứa danh sách user với thống kê usage
     */
    @Override
    public AdminUserUsageResponse getUserResourceOverview() {
        // Bước 1: Chuẩn bị map chứa thống kê cho từng user có role USER
        List<UserEntity> users = userRepository.findAll();
        Map<Long, AdminUserUsageResponse.UserUsageItem> userStats = new HashMap<>(); // Map userId -> usage tổng hợp
        
        for (UserEntity user : users) {
            // Chỉ xử lý user có role USER (bỏ qua admin/devops)
            if (!ROLE_USER.equalsIgnoreCase(user.getRole())) {
                continue;
            }
            
            // Khởi tạo UserUsageItem với giá trị mặc định (0 project, 0 CPU, 0 Memory)
            AdminUserUsageResponse.UserUsageItem item = new AdminUserUsageResponse.UserUsageItem();
            item.setId(user.getId());
            item.setFullname(user.getFullname());
            item.setUsername(user.getUsername());
            item.setTier(user.getTier());
            item.setProjectCount(0);
            item.setCpuCores(0.0);
            item.setMemoryGb(0.0);
            userStats.put(user.getId(), item);
        }

        // Bước 2: Với mỗi project, tăng số dự án và ghi lại namespace thuộc user nào
        List<ProjectEntity> projects = projectRepository.findAll();
        Set<String> namespaces = new HashSet<>(); // Tập namespace cần truy vấn metrics (loại bỏ trùng)
        Map<String, Long> namespaceOwner = new HashMap<>(); // Map namespace -> userId sở hữu (để phân bổ usage)
        
        for (ProjectEntity project : projects) {
            UserEntity owner = project.getUser();
            // Bỏ qua project không có owner
            if (owner == null) {
                continue;
            }
            
            // Lấy UserUsageItem của owner
            AdminUserUsageResponse.UserUsageItem item = userStats.get(owner.getId());
            // Nếu owner không có trong userStats (không phải role USER), bỏ qua
            if (item == null) {
                continue;
            }
            
            // Tăng số project của user
            item.setProjectCount(item.getProjectCount() + 1);

            // Nếu project có namespace, thêm vào danh sách và ghi lại owner
            if (project.getNamespace() != null && !project.getNamespace().trim().isEmpty()) {
                String namespace = project.getNamespace().trim();
                namespaces.add(namespace);
                namespaceOwner.put(namespace, owner.getId());
            }
        }

        // Bước 3: Lấy metrics từng namespace rồi cộng ngược vào user tương ứng
        ResourceUsageMap usageMap = calculateUsagePerNamespace(namespaces);
        
        // Phân bổ usage của từng namespace về user sở hữu namespace đó
        usageMap.namespaceUsage().forEach((namespace, usage) -> {
            Long ownerId = namespaceOwner.get(namespace);
            if (ownerId == null) {
                return;
            }
            
            AdminUserUsageResponse.UserUsageItem item = userStats.get(ownerId);
            if (item != null) {
                // Cộng dồn CPU và Memory vào user
                item.setCpuCores(item.getCpuCores() + usage.getCpuCores());
                item.setMemoryGb(item.getMemoryGb() + bytesToGb(usage.getMemoryBytes()));
            }
        });

        // Bước 4: Làm tròn CPU và Memory cho từng user (3 chữ số thập phân)
        userStats.values().forEach(item -> {
            item.setCpuCores(roundToThreeDecimals(item.getCpuCores()));
            item.setMemoryGb(roundToThreeDecimals(item.getMemoryGb()));
        });

        // Bước 5: Tạo response và trả về
        AdminUserUsageResponse response = new AdminUserUsageResponse();
        response.setUsers(new ArrayList<>(userStats.values()));
        
        return response;
    }

    /**
     * Gom danh sách namespace từ list project để tránh gọi lặp lại.
     * 
     * Mục đích: Khi có nhiều project cùng sử dụng một namespace, ta chỉ cần truy
     * vấn metrics một lần
     * thay vì truy vấn nhiều lần cho cùng namespace. Điều này giúp tối ưu hiệu
     * suất.
     * 
     * Logic xử lý:
     * 1. Khởi tạo Set để tự động loại bỏ namespace trùng lặp
     * 2. Duyệt từng project trong danh sách
     * 3. Kiểm tra project có namespace hợp lệ (không null, không rỗng) không
     * 4. Nếu có, thêm namespace vào Set (đã trim để loại bỏ khoảng trắng thừa)
     * 5. Trả về Set các namespace duy nhất
     * 
     * @param projects Danh sách các project cần lấy namespace
     * @return Set<String> chứa các namespace duy nhất (không trùng lặp)
     */
    private Set<String> collectNamespaces(List<ProjectEntity> projects) {
        // Bước 1: Khởi tạo Set để tự động loại bỏ namespace trùng lặp
        Set<String> namespaces = new HashSet<>();
        
        // Bước 2: Duyệt từng project và thêm namespace hợp lệ vào Set
        for (ProjectEntity project : projects) {
            // Kiểm tra project có namespace hợp lệ không (không null và không rỗng)
            if (project.getNamespace() != null && !project.getNamespace().trim().isEmpty()) {
                String namespace = project.getNamespace().trim(); // Trim để loại bỏ khoảng trắng thừa
                namespaces.add(namespace);
            }
        }
        
        // Bước 3: Trả về Set các namespace duy nhất
        return namespaces;
    }

    /**
     * Chạy kubectl top pods cho danh sách namespace để thu thập CPU/Memory.
     * Kết quả trả về cả tổng usage và usage theo từng namespace.
     * 
     * Quy trình xử lý:
     * 1. Kiểm tra danh sách namespace có rỗng không
     * 2. Kết nối SSH đến MASTER server
     * 3. Với mỗi namespace:
     * - Chạy lệnh: kubectl top pods -n {namespace} --no-headers
     * - Parse output để lấy CPU và Memory của từng pod
     * - Cộng dồn vào tổng và vào namespace tương ứng
     * 4. Trả về ResourceUsageMap chứa tổng usage và usage theo namespace
     * 
     * @param namespaces Set các namespace cần truy vấn metrics
     * @return ResourceUsageMap chứa tổng usage và usage theo từng namespace
     */
    private ResourceUsageMap calculateUsagePerNamespace(Set<String> namespaces) {
        // Khởi tạo các biến để lưu kết quả
        BaseKubernetesService.ResourceUsage totalUsage = new BaseKubernetesService.ResourceUsage(); // Tổng usage của tất cả namespace
        Map<String, BaseKubernetesService.ResourceUsage> namespaceUsage = new HashMap<>(); // Usage theo từng namespace

        // Nếu không có namespace nào, trả về kết quả rỗng
        if (namespaces.isEmpty()) {
            return new ResourceUsageMap(totalUsage, namespaceUsage);
        }

        // Lấy thông tin server MASTER để kết nối SSH
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session clusterSession = null;
        try {
            // Tạo SSH session và kết nối đến MASTER server
            clusterSession = createSession(masterServer);
            
            // Bước 1: Lặp qua từng namespace để gọi kubectl top pods
            for (String namespace : namespaces) {
                try {
                    // Tạo lệnh kubectl top pods cho namespace này (--no-headers để bỏ dòng header)
                    String cmd = String.format("kubectl top pods -n %s --no-headers", namespace);
                    
                    // Thực thi lệnh (ignoreNonZeroExit=true để không throw exception nếu lệnh fail)
                    String output = executeCommand(clusterSession, cmd, true);
                    
                    // Nếu không có output (namespace không có pod hoặc lỗi), bỏ qua
                    if (output == null || output.trim().isEmpty()) {
                        continue;
                    }
                    
                    // Chia output thành các dòng (mỗi dòng là một pod)
                    String[] lines = output.split("\\r?\\n");
                    
                    // Bước 2: Parse từng dòng output để lấy CPU và Memory
                    for (String line : lines) {
                        line = line.trim();
                        // Bỏ qua dòng rỗng
                        if (line.isEmpty()) {
                            continue;
                        }
                        
                        // Chia dòng thành các phần: [pod-name] [CPU] [Memory]
                        String[] parts = line.split("\\s+");
                        if (parts.length < 3) {
                            continue;
                        }
                        
                        try {
                            // Parse CPU từ phần thứ 2 (có thể là "15m", "0.2", etc.)
                            double cpu = parseCpuCores(parts[1]);
                            // Parse Memory từ phần thứ 3 (có thể là "100Mi", "2Gi", etc.)
                            long memory = parseMemoryBytes(parts[2]);

                            // Cộng dồn vào tổng usage
                            totalUsage.addCpu(cpu).addMemory(memory);
                            
                            // Cộng dồn vào usage của namespace này
                            // computeIfAbsent: nếu namespace chưa có trong map, tạo mới ResourceUsage
                            namespaceUsage
                                    .computeIfAbsent(namespace, key -> new BaseKubernetesService.ResourceUsage())
                                    .addCpu(cpu)
                                    .addMemory(memory);
                        } catch (NumberFormatException ex) {
                            // Nếu không parse được, log lỗi nhưng tiếp tục xử lý pod khác
                        }
                    }
                } catch (Exception e) {
                    // Nếu lỗi khi xử lý một namespace, log nhưng tiếp tục xử lý namespace khác
                }
            }
        } catch (Exception e) {
            // Lỗi khi kết nối SSH hoặc lỗi chung
        } finally {
            // Đảm bảo đóng SSH session
            if (clusterSession != null && clusterSession.isConnected()) {
                clusterSession.disconnect();
            }
        }

        return new ResourceUsageMap(totalUsage, namespaceUsage);
    }

    /**
     * Lấy metrics CPU/Memory cho một nhóm pod theo label "app".
     * Hàm này giúp tái sử dụng logic kubectl top pods -l app=<label>.
     * 
     * Mục đích: Lấy tổng CPU và Memory của tất cả pod có label app={appLabel} trong
     * namespace.
     * Được sử dụng để lấy metrics cho một Database/Backend/Frontend cụ thể.
     * 
     * Quy trình xử lý:
     * 1. Kiểm tra tham số đầu vào hợp lệ
     * 2. Chạy lệnh: kubectl top pods -n {namespace} -l app={appLabel} --no-headers
     * 3. Parse output để lấy CPU và Memory của từng pod
     * 4. Cộng dồn vào ResourceUsage và trả về
     * 
     * @param session   SSH session đã kết nối đến MASTER server
     * @param namespace Namespace chứa các pod cần truy vấn
     * @param appLabel  Label "app" để filter pod (ví dụ: "db-abc123", "app-xyz789")
     * @return ResourceUsage chứa tổng CPU (cores) và Memory (bytes) của các pod
     *         thỏa label
     */
    private BaseKubernetesService.ResourceUsage fetchUsageForApp(Session session, String namespace, String appLabel) {
        // Khởi tạo ResourceUsage rỗng (CPU=0, Memory=0)
        BaseKubernetesService.ResourceUsage usage = new BaseKubernetesService.ResourceUsage();
        
        // Kiểm tra tham số đầu vào hợp lệ
        if (session == null || namespace == null || namespace.isBlank() || appLabel == null || appLabel.isBlank()) {
            return usage;
        }
        
        try {
            // Tạo lệnh kubectl top pods với label selector
            // -l app={appLabel}: chỉ lấy pod có label app={appLabel}
            // --no-headers: bỏ dòng header để dễ parse
            String cmd = String.format("kubectl top pods -n %s -l app=%s --no-headers", namespace, appLabel);
            
            // Thực thi lệnh (ignoreNonZeroExit=true để không throw exception nếu không có
            // pod)
            String output = executeCommand(session, cmd, true);
            
            // Nếu không có output (không có pod thỏa label), trả về usage rỗng
            if (output == null || output.trim().isEmpty()) {
                return usage;
            }
            
            // Chia output thành các dòng (mỗi dòng là một pod)
            String[] lines = output.split("\\r?\\n");
            
            // Bước 1: Lặp qua từng pod thỏa label để parse CPU và Memory
            for (String line : lines) {
                line = line.trim();
                // Bỏ qua dòng rỗng
                if (line.isEmpty()) {
                    continue;
                }
                
                // Chia dòng thành các phần: [pod-name] [CPU] [Memory]
                String[] parts = line.split("\\s+");
                if (parts.length < 3) {
                    continue;
                }
                
                // Parse CPU và Memory từ output
                double cpu = parseCpuCores(parts[1]);
                long memory = parseMemoryBytes(parts[2]);
                
                // Cộng dồn vào usage
                usage.addCpu(cpu).addMemory(memory);
            }
        } catch (Exception e) {
            // Nếu có lỗi, log nhưng vẫn trả về usage (có thể là 0 nếu chưa parse được gì)
        }
        return usage;
    }

    /**
     * Mở SSH session tới server MASTER để chạy lệnh kubectl.
     * 
     * Quy trình xử lý:
     * 1. Tạo JSch object để quản lý SSH connection
     * 2. Tạo session với thông tin đăng nhập (username, IP, port)
     * 3. Set password cho authentication
     * 4. Cấu hình session (tắt StrictHostKeyChecking để không cần xác nhận host
     * key)
     * 5. Set timeout 7 giây
     * 6. Kết nối thực tế đến server
     * 
     * @param server ServerEntity chứa thông tin server MASTER (IP, port, username,
     *               password)
     * @return Session đã kết nối thành công, sẵn sàng để thực thi lệnh
     * @throws Exception nếu không thể kết nối (sai thông tin đăng nhập, server
     *                   không khả dụng, etc.)
     */
    /**
     * Thực thi lệnh shell trên server MASTER thông qua SSH.
     * 
     * Quy trình xử lý:
     * 1. Mở channel "exec" để thực thi lệnh
     * 2. Set lệnh cần thực thi
     * 3. Redirect stderr để log lỗi
     * 4. Kết nối channel và bắt đầu thực thi
     * 5. Đọc output từ inputStream liên tục cho đến khi lệnh kết thúc
     * 6. Kiểm tra exit status và xử lý lỗi nếu cần
     * 7. Đóng channel và trả về output
     * 
     * @param session           SSH session đã kết nối
     * @param command           Lệnh shell cần thực thi (ví dụ: "kubectl get pods -n
     *                          default")
     * @param ignoreNonZeroExit Nếu true, không throw exception khi lệnh trả về exit
     *                          code != 0 (chỉ log)
     * @return String chứa output của lệnh (đã trim)
     * @throws Exception nếu có lỗi khi thực thi hoặc exit code != 0 và
     *                   ignoreNonZeroExit=false
     */
    @Override
    public NamespaceResponse createNamespace(NamespaceRequest request) {
        return adminNamespaceService.createNamespace(request);
    }

    @Override
    public NamespaceResponse createNamespaceFromYaml(String yaml) {
        return adminNamespaceService.createNamespaceFromYaml(yaml);
    }

    @Override
    public void deleteIngress(String namespace, String name) {
        adminServiceDiscoveryService.deleteIngress(namespace, name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.ServiceResponse updateServiceFromYaml(String namespace, String name, String yaml) {
        return adminServiceDiscoveryService.updateServiceFromYaml(namespace, name, yaml);
    }

    @Override
    public void deleteService(String namespace, String name) {
        adminServiceDiscoveryService.deleteService(namespace, name);
    }

    @Override
    public StatefulsetResponse getStatefulset(String namespace, String name) {
        return adminWorkloadService.getStatefulset(namespace, name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.StatefulsetDetailResponse getStatefulsetDetail(String namespace, String name) {
        return adminWorkloadService.getStatefulsetDetail(namespace, name);
    }

    @Override
    public StatefulsetResponse scaleStatefulset(String namespace, String name, int replicas) {
        return adminWorkloadService.scaleStatefulset(namespace, name, replicas);
    }

    @Override
    public StatefulsetResponse updateStatefulsetFromYaml(String namespace, String name, String yaml) {
        return adminWorkloadService.updateStatefulsetFromYaml(namespace, name, yaml);
    }

    @Override
    public void deleteStatefulset(String namespace, String name) {
        adminWorkloadService.deleteStatefulset(namespace, name);
    }

    @Override
    public PodResponse getPod(String namespace, String name) {
        return adminWorkloadService.getPod(namespace, name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PodDetailResponse getPodDetail(String namespace, String name) {
        return adminWorkloadService.getPodDetail(namespace, name);
    }

    @Override
    public String getPodLogs(String namespace, String name, String container) {
        return adminWorkloadService.getPodLogs(namespace, name, container);
    }

    @Override
    public String execPodCommand(String namespace, String name, String container, String command) {
        return adminWorkloadService.execPodCommand(namespace, name, container, command);
    }

    @Override
    public PodResponse updatePodFromYaml(String namespace, String name, String yaml) {
        return adminWorkloadService.updatePodFromYaml(namespace, name, yaml);
    }

    @Override
    public void deletePod(String namespace, String name) {
        adminWorkloadService.deletePod(namespace, name);
    }

    @Override
    public DeploymentResponse getDeployment(String namespace, String name) {
        return adminWorkloadService.getDeployment(namespace, name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.DeploymentDetailResponse getDeploymentDetail(String namespace, String name) {
        return adminWorkloadService.getDeploymentDetail(namespace, name);
    }

    @Override
    public DeploymentResponse scaleDeployment(String namespace, String name, int replicas) {
        return adminWorkloadService.scaleDeployment(namespace, name, replicas);
    }

    @Override
    public DeploymentResponse updateDeploymentFromYaml(String namespace, String name, String yaml) {
        return adminWorkloadService.updateDeploymentFromYaml(namespace, name, yaml);
    }

    @Override
    public void deleteDeployment(String namespace, String name) {
        adminWorkloadService.deleteDeployment(namespace, name);
    }

    @Override
    public NamespaceResponse updateNamespaceFromYaml(String name, String yaml) {
        return adminNamespaceService.updateNamespaceFromYaml(name, yaml);
    }

    @Override
    public void deleteNamespace(String name) {
        adminNamespaceService.deleteNamespace(name);
    }

    /**
     * Parse chuỗi CPU từ kubectl về đơn vị cores (double).
     * 
     * Kubernetes có thể trả về CPU theo 2 định dạng:
     * - Millicores: "15m", "3950m" (m = millicores, 1000m = 1 core)
     * - Cores: "0.2", "4", "1.5" (số cores trực tiếp)
     * 
     * Logic xử lý:
     * 1. Kiểm tra chuỗi có rỗng không
     * 2. Chuyển về lowercase để xử lý
     * 3. Nếu kết thúc bằng "m" → millicores, chia cho 1000 để chuyển sang cores
     * 4. Nếu không → cores trực tiếp, parse thành double
     * 
     * Ví dụ:
     * - "15m" → 0.015 cores
     * - "3950m" → 3.95 cores
     * - "0.2" → 0.2 cores
     * - "4" → 4.0 cores
     * 
     * @param cpuStr Chuỗi CPU từ kubectl (ví dụ: "15m", "0.2", "3950m")
     * @return double số cores (ví dụ: 0.015, 0.2, 3.95)
     */
    /**
     * Parse chuỗi Memory từ kubectl và trả về bytes.
     * 
     * Kubernetes có thể trả về Memory theo nhiều định dạng:
     * - Binary units (1024-based): Ki (Kibibytes), Mi (Mebibytes), Gi (Gibibytes),
     * Ti (Tebibytes)
     * - Decimal units (1000-based): K (Kilobytes), M (Megabytes), G (Gigabytes)
     * - Không có đơn vị: được coi là bytes
     * 
     * Logic xử lý:
     * 1. Kiểm tra chuỗi rỗng
     * 2. Chuyển về uppercase để xử lý
     * 3. Kiểm tra đơn vị (KI, MI, GI, TI, K, M, G)
     * 4. Tính factor tương ứng (số bytes trong 1 đơn vị)
     * 5. Lấy phần số (bỏ đơn vị)
     * 6. Nhân số với factor để chuyển sang bytes
     * 
     * Ví dụ:
     * - "100Ki" → 100 * 1024 = 102,400 bytes
     * - "512Mi" → 512 * 1024^2 = 536,870,912 bytes
     * - "2Gi" → 2 * 1024^3 = 2,147,483,648 bytes
     * - "1G" → 1 * 1000^3 = 1,000,000,000 bytes
     * 
     * @param memStr Chuỗi Memory từ kubectl (ví dụ: "100Mi", "2Gi", "512Ki")
     * @return long số bytes tương ứng
     */
    /**
     * Chuyển đổi bytes sang GB (Gigabytes).
     * 
     * Sử dụng hệ số quy đổi binary: 1 GB = 1024^3 bytes = 1,073,741,824 bytes
     * 
     * @param bytes Số bytes cần chuyển đổi
     * @return double số GB tương ứng (có thể có phần thập phân)
     */
    /**
     * Parse Quantity object từ Kubernetes và trả về số cores (CPU).
     * 
     * Quantity cho CPU có thể là:
     * - Số cores trực tiếp: "4", "2"
     * - Millicores: "4000m", "2000m"
     * - Quantity object: "quantity{number=4, format=decimal_si}"
     * 
     * @param quantity Quantity object từ Kubernetes (có thể là Object hoặc String)
     * @return double số cores
     */
    /**
     * Parse Quantity object từ Kubernetes và trả về bytes (Memory).
     * 
     * Quantity cho Memory có thể là:
     * - Bytes: "1073741824"
     * - String với unit: "1Gi", "512Mi"
     * - Quantity object: "quantity{number=1073741824, format=binary_si}"
     * 
     * @param quantity Quantity object từ Kubernetes (có thể là Object hoặc String)
     * @return long số bytes
     */
    /**
     * Parse Quantity object từ Kubernetes và chuyển sang GB (Gigabytes).
     * 
     * Quantity trong Kubernetes có thể có format khác nhau:
     * - BINARY_SI: Binary units (1024-based) - number đã là bytes
     * - DECIMAL_SI: Decimal units (1000-based) - number đã là bytes
     * 
     * Logic:
     * 1. Parse từ toString() của Quantity object (format:
     * "Quantity{number=1073741824, format=BINARY_SI}")
     * 2. Lấy number từ string (đã là bytes)
     * 3. Chuyển sang GB bằng bytesToGb()
     * 4. Format thành string với "GB"
     * 
     * @param quantity Quantity object từ Kubernetes (có thể là Object)
     * @return String capacity dạng "X.XXX GB" hoặc "" nếu quantity null
     */
    /**
     * Làm tròn số về 3 chữ số thập phân.
     * 
     * Mục đích: Giữ format hiển thị gọn gàng, dễ đọc (ví dụ: 1.234 thay vì
     * 1.23456789)
     * 
     * Logic: Nhân với 1000, làm tròn, rồi chia lại cho 1000
     * 
     * Ví dụ:
     * - 1.23456789 → 1.235
     * - 0.123456 → 0.123
     * - 5.0 → 5.0
     * 
     * @param value Số cần làm tròn
     * @return double đã làm tròn đến 3 chữ số thập phân
     */
    /**
     * Record gom tổng usage và usage theo từng namespace để tái sử dụng ở nhiều
     * hàm.
     * 
     * Record này chứa:
     * - totalUsage: ResourceUsage chứa tổng CPU/Memory của tất cả namespace
     * - namespaceUsage: Map<String, ResourceUsage> chứa CPU/Memory theo từng
     * namespace
     * 
     * Mục đích: Tránh phải truy vấn Kubernetes nhiều lần cho cùng một tập
     * namespace.
     * Một lần tính toán có thể được sử dụng cho nhiều mục đích khác nhau.
     * 
     * @param totalUsage     Tổng usage của tất cả namespace cộng lại
     * @param namespaceUsage Map namespace -> ResourceUsage của namespace đó
     */
    private record ResourceUsageMap(BaseKubernetesService.ResourceUsage totalUsage, Map<String, BaseKubernetesService.ResourceUsage> namespaceUsage) {
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
     * Lấy tổng CPU và RAM capacity (tổng dung lượng) của cluster sử dụng Kubernetes
     * Java Client.
     * 
     * Capacity là tổng tài nguyên vật lý của cluster (tất cả node cộng lại).
     * 
     * Quy trình xử lý:
     * 1. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 2. Tạo Kubernetes Java Client từ kubeconfig
     * 3. Sử dụng CoreV1Api để lấy danh sách nodes
     * 4. Parse V1Node objects để lấy CPU và Memory capacity từ status.capacity
     * 5. Cộng dồn tất cả node để có tổng capacity
     * 6. Chuyển đổi và làm tròn dữ liệu
     * 
     * @return ClusterCapacityResponse chứa tổng CPU cores và Memory GB của cluster
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public ClusterCapacityResponse getClusterCapacity() {
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

            // Khởi tạo biến để cộng dồn
            double totalCpu = 0.0; // Tổng CPU cores
            long totalMemoryBytes = 0L; // Tổng Memory bytes

            // Lấy danh sách nodes từ Kubernetes API
            try {
                V1NodeList nodeList = api.listNode(
                        null, null, null, null, null, null, null, null, null, null, null);

                if (nodeList != null && nodeList.getItems() != null) {
                    for (V1Node v1Node : nodeList.getItems()) {
                        try {
                            V1NodeStatus status = v1Node.getStatus();
                            if (status != null && status.getCapacity() != null) {
                                // Lấy CPU capacity
                                if (status.getCapacity().containsKey("cpu")) {
                                    double cpu = parseQuantityToCpuCores(status.getCapacity().get("cpu"));
                            totalCpu += cpu;
                                }

                                // Lấy Memory capacity
                                if (status.getCapacity().containsKey("memory")) {
                                    long memoryBytes = parseQuantityToMemoryBytes(status.getCapacity().get("memory"));
                            totalMemoryBytes += memoryBytes;
                        }
                    }
                        } catch (Exception e) {
                            // Bỏ qua node nếu có lỗi, tiếp tục với node tiếp theo
                }
                    }
                }
            } catch (ApiException e) {
                throw new RuntimeException("Không thể lấy danh sách nodes từ Kubernetes API: " + e.getMessage(), e);
            }

            // Tạo response và set dữ liệu
            ClusterCapacityResponse response = new ClusterCapacityResponse();
            response.setTotalCpuCores(roundToThreeDecimals(totalCpu));
            response.setTotalMemoryGb(roundToThreeDecimals(bytesToGb(totalMemoryBytes)));
            
            return response;

        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy cluster capacity: " + e.getMessage(), e);
        } finally {
            // Đảm bảo đóng SSH session
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    /**
     * Lấy tổng CPU và RAM allocatable (khả dụng) của cluster sử dụng Kubernetes
     * Java Client.
     * 
     * Allocatable là tài nguyên khả dụng sau khi trừ đi phần dành cho hệ thống
     * (system reserved).
     * Thường nhỏ hơn capacity vì một phần tài nguyên được dành cho OS và các thành
     * phần hệ thống.
     * 
     * Quy trình xử lý:
     * 1. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 2. Tạo Kubernetes Java Client từ kubeconfig
     * 3. Sử dụng CoreV1Api để lấy danh sách nodes
     * 4. Parse V1Node objects để lấy CPU và Memory allocatable từ
     * status.allocatable
     * 5. Cộng dồn tất cả node để có tổng allocatable
     * 6. Chuyển đổi và làm tròn dữ liệu
     * 
     * @return ClusterAllocatableResponse chứa tổng CPU cores và Memory GB
     *         allocatable của cluster
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public ClusterAllocatableResponse getClusterAllocatable() {
        
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

            // Khởi tạo biến để cộng dồn
            double totalCpu = 0.0; // Tổng CPU cores allocatable
            long totalMemoryBytes = 0L; // Tổng Memory bytes allocatable

            // Lấy danh sách nodes từ Kubernetes API
            try {
                V1NodeList nodeList = api.listNode(
                        null, null, null, null, null, null, null, null, null, null, null);

                if (nodeList != null && nodeList.getItems() != null) {
                    for (V1Node v1Node : nodeList.getItems()) {
                        try {
                            V1NodeStatus status = v1Node.getStatus();
                            if (status != null && status.getAllocatable() != null) {
                                // Lấy CPU allocatable
                                if (status.getAllocatable().containsKey("cpu")) {
                                    double cpu = parseQuantityToCpuCores(status.getAllocatable().get("cpu"));
                            totalCpu += cpu;
                                }

                                // Lấy Memory allocatable
                                if (status.getAllocatable().containsKey("memory")) {
                                    long memoryBytes = parseQuantityToMemoryBytes(
                                            status.getAllocatable().get("memory"));
                            totalMemoryBytes += memoryBytes;
                        }
                    }
                        } catch (Exception e) {
                            // Bỏ qua node nếu có lỗi, tiếp tục với node tiếp theo
                }
                    }
                }
            } catch (ApiException e) {
                throw new RuntimeException("Không thể lấy danh sách nodes từ Kubernetes API: " + e.getMessage(), e);
            }

            // Tạo response và set dữ liệu
            ClusterAllocatableResponse response = new ClusterAllocatableResponse();
            response.setTotalCpuCores(roundToThreeDecimals(totalCpu));
            response.setTotalMemoryGb(roundToThreeDecimals(bytesToGb(totalMemoryBytes)));
            
            return response;

        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy cluster allocatable: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    /**
     * Lấy thông tin cluster: số lượng nodes, trạng thái (healthy/unhealthy), và
     * Kubernetes version.
     * 
     * Quy trình xử lý:
     * 1. Lấy danh sách servers từ database có cluster_status=AVAILABLE và role là
     * MASTER hoặc WORKER
     * 2. Đếm số lượng nodes
     * 3. Kiểm tra trạng thái: healthy nếu tất cả nodes có status=ONLINE, unhealthy
     * nếu có node OFFLINE
     * 4. Lấy Kubernetes version từ kubectl get nodes trên master AVAILABLE
     * 
     * @return ClusterInfoResponse chứa nodeCount, status, version
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi thực thi
     *                          lệnh
     */
    @Override
    public ClusterInfoResponse getClusterInfo() {
        ClusterInfoResponse response = new ClusterInfoResponse();
        
        // Bước 1: Lấy danh sách servers có cluster_status=AVAILABLE và role
        // MASTER/WORKER
        List<ServerEntity> allServers = serverRepository.findAll();
        List<ServerEntity> clusterServers = allServers.stream()
                .filter(s -> s != null 
                        && "AVAILABLE".equals(s.getClusterStatus())
                        && ("MASTER".equals(s.getRole()) || "WORKER".equals(s.getRole())))
                .collect(Collectors.toList());
        
        // Bước 2: Đếm số lượng nodes
        int nodeCount = clusterServers.size();
        response.setNodeCount(nodeCount);
        
        // Bước 3: Kiểm tra trạng thái (healthy/unhealthy)
        // healthy nếu tất cả nodes có status=ONLINE, unhealthy nếu có node OFFLINE
        boolean allOnline = clusterServers.stream()
                .allMatch(s -> s.getStatus() == ServerEntity.ServerStatus.ONLINE);
        response.setStatus(allOnline ? "healthy" : "unhealthy");
        
        // Bước 4: Lấy Kubernetes version từ Kubernetes API
        String version = "Unknown";
        try {
            // Tìm master server có cluster_status=AVAILABLE và ONLINE
            ServerEntity masterServer = clusterServers.stream()
                    .filter(s -> "MASTER".equals(s.getRole()) 
                            && s.getStatus() == ServerEntity.ServerStatus.ONLINE)
                    .findFirst()
                    .orElse(null);
            
            if (masterServer != null) {
                Session session = null;
                try {
                    // Kết nối SSH đến MASTER server để lấy kubeconfig
                    session = createSession(masterServer);

                    // Tạo Kubernetes client từ kubeconfig
                    ApiClient client = createKubernetesClient(session);
                    CoreV1Api api = new CoreV1Api(client);

                    // Lấy danh sách nodes và lấy version từ node đầu tiên
                    V1NodeList nodeList = api.listNode(
                            null, null, null, null, null, null, null, null, null, null, null);

                    if (nodeList != null && nodeList.getItems() != null && !nodeList.getItems().isEmpty()) {
                        V1Node firstNode = nodeList.getItems().get(0);
                        V1NodeStatus status = firstNode.getStatus();
                        if (status != null && status.getNodeInfo() != null) {
                            String kubeletVersion = status.getNodeInfo().getKubeletVersion();
                            if (kubeletVersion != null && !kubeletVersion.trim().isEmpty()) {
                                version = kubeletVersion.trim();
                            }
                        }
                    }
                } catch (Exception e) {
                    // Nếu không lấy được version, giữ giá trị mặc định "Unknown"
                    System.err.println("Không thể lấy Kubernetes version: " + e.getMessage());
                } finally {
                    if (session != null && session.isConnected()) {
                        session.disconnect();
                    }
                }
            }
        } catch (Exception e) {
            // Nếu có lỗi, giữ giá trị mặc định
            System.err.println("Lỗi khi lấy cluster info: " + e.getMessage());
        }
        
        response.setVersion(version);
        return response;
    }

    /**
     * Lấy chi tiết database bao gồm thông tin Pod, Service, StatefulSet, PVC, PV.
     * 
     * Quy trình xử lý:
     * 1. Lấy database entity từ database và kiểm tra thông tin cơ bản (project,
     * namespace, uuid_k8s)
     * 2. Tạo tên các Kubernetes resource dựa trên uuid_k8s:
     * - Pod: db-{uuid}-0 (StatefulSet pattern)
     * - Service: db-{uuid}-svc
     * - StatefulSet: db-{uuid}
     * - PVC: mysql-data-db-{uuid}-0 hoặc mongodb-data-db-{uuid}-0
     * 3. Kết nối SSH đến MASTER server
     * 4. Set thông tin database từ entity (IP, Port, name, username, password,
     * type)
     * 5. Lấy thông tin Pod (name, node, status) - thử theo tên trước, fallback theo
     * label
     * 6. Lấy thông tin Service (name, external IP, port)
     * 7. Lấy thông tin StatefulSet (name)
     * 8. Lấy thông tin PVC (name, status, volume, capacity)
     * 9. Lấy thông tin PV từ volume name (name, capacity, node)
     * 
     * @param databaseId ID của database cần lấy chi tiết
     * @return AdminDatabaseDetailResponse chứa đầy đủ thông tin database và
     *         Kubernetes resources
     * @throws RuntimeException nếu database không tồn tại hoặc thiếu thông tin cần
     *                          thiết
     */
    @Override
    public AdminDatabaseDetailResponse getDatabaseDetail(Long databaseId) {
        
        // Bước 1: Lấy database entity từ database
        ProjectDatabaseEntity database = projectDatabaseRepository.findById(databaseId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy database với id " + databaseId));
        
        // Bước 2: Kiểm tra database có thuộc về project không
        ProjectEntity project = database.getProject();
        if (project == null) {
            throw new RuntimeException("Database không thuộc về project nào");
        }
        
        // Bước 3: Kiểm tra project có namespace không (bắt buộc để truy vấn Kubernetes)
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace");
        }
        namespace = namespace.trim();
        
        // Bước 4: Kiểm tra database có uuid_k8s không (bắt buộc để tạo tên resource)
        String uuid_k8s = database.getUuid_k8s();
        if (uuid_k8s == null || uuid_k8s.trim().isEmpty()) {
            throw new RuntimeException("Database không có uuid_k8s");
        }
        uuid_k8s = uuid_k8s.trim();
        
        // Bước 5: Tạo tên các Kubernetes resource dựa trên uuid_k8s
        String resourceName = "db-" + uuid_k8s; // Tên chung cho database resource
        String serviceName = resourceName + "-svc"; // Service name: db-{uuid}-svc
        String statefulSetName = resourceName; // StatefulSet name: db-{uuid}
        String podName = resourceName + "-0"; // Pod name: db-{uuid}-0 (StatefulSet pattern: {name}-{ordinal})
        
        // Bước 6: Lấy thông tin server MASTER để kết nối SSH
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));
        
        Session session = null;
        AdminDatabaseDetailResponse response = new AdminDatabaseDetailResponse();
        
        try {
            // Bước 7: Kết nối SSH đến MASTER server để lấy kubeconfig
            session = createSession(masterServer);

            // Tạo Kubernetes client từ kubeconfig
            ApiClient client = createKubernetesClient(session);
            CoreV1Api coreApi = new CoreV1Api(client);
            AppsV1Api appsApi = new AppsV1Api(client);
            
            // Bước 8: Set thông tin database từ entity (không cần truy vấn Kubernetes)
            response.setDatabaseId(database.getId());
            response.setDatabaseType(database.getDatabaseType());
            response.setDatabaseIp(database.getDatabaseIp());
            response.setDatabasePort(database.getDatabasePort());
            response.setDatabaseName(database.getDatabaseName());
            response.setDatabaseUsername(database.getDatabaseUsername());
            response.setDatabasePassword(database.getDatabasePassword());
            
            // Bước 9: Lấy thông tin Pod (name, node, status) - BẮT BUỘC từ Kubernetes Client
            // Không fallback về DB, nếu không tìm thấy thì throw error
            try {
                // Strategy 1: Thử lấy pod theo tên chính xác (StatefulSet pod name pattern:
                // db-{uuid}-0)
                V1Pod v1Pod = null;
                try {
                    v1Pod = coreApi.readNamespacedPod(podName, namespace, null);
                } catch (ApiException e) {
                    // Pod không tồn tại theo tên, thử Strategy 2: lấy theo label selector
                    if (e.getCode() == 404) {
                            io.kubernetes.client.openapi.models.V1PodList podList = coreApi.listNamespacedPod(
                                    namespace, null, null, null, null,
                                    "app=" + resourceName, null, null, null, null, null, null);
                            if (podList != null && podList.getItems() != null && !podList.getItems().isEmpty()) {
                            v1Pod = podList.getItems().get(0);
                        }
                    }
                }
                
                // Nếu không tìm thấy Pod, throw error
                if (v1Pod == null || v1Pod.getMetadata() == null) {
                    throw new RuntimeException("Không tìm thấy Pod trong Kubernetes cluster. Pod name: " + podName + ", namespace: " + namespace);
                }
                
                // Set thông tin Pod từ Kubernetes
                                    response.setPodName(v1Pod.getMetadata().getName());
                                if (v1Pod.getSpec() != null && v1Pod.getSpec().getNodeName() != null) {
                                    response.setPodNode(v1Pod.getSpec().getNodeName());
                                }
                                if (v1Pod.getStatus() != null && v1Pod.getStatus().getPhase() != null) {
                                    response.setPodStatus(v1Pod.getStatus().getPhase());
                                }
            } catch (ApiException e) {
                throw new RuntimeException("Không thể lấy thông tin Pod từ Kubernetes: " + e.getMessage(), e);
            }
            
            // Bước 10: Lấy thông tin Service (name, external IP, port) - BẮT BUỘC từ Kubernetes Client
            // Không fallback về DB, nếu không tìm thấy thì throw error
            try {
                V1Service v1Service = coreApi.readNamespacedService(serviceName, namespace, null);
                if (v1Service == null || v1Service.getMetadata() == null) {
                    throw new RuntimeException("Không tìm thấy Service trong Kubernetes cluster. Service name: " + serviceName + ", namespace: " + namespace);
                }

                // Set thông tin Service từ Kubernetes
                response.setServiceName(v1Service.getMetadata().getName());

                V1ServiceStatus status = v1Service.getStatus();
                if (status != null && status.getLoadBalancer() != null
                        && status.getLoadBalancer().getIngress() != null
                        && !status.getLoadBalancer().getIngress().isEmpty()) {
                    io.kubernetes.client.openapi.models.V1LoadBalancerIngress ingress = status.getLoadBalancer()
                            .getIngress().get(0);
                    if (ingress.getIp() != null) {
                        response.setServiceExternalIp(ingress.getIp());
                    }
                }

                V1ServiceSpec spec = v1Service.getSpec();
                if (spec != null && spec.getPorts() != null && !spec.getPorts().isEmpty()) {
                    V1ServicePort port = spec.getPorts().get(0);
                    if (port.getPort() != null) {
                        response.setServicePort(port.getPort());
                    }
                }
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    throw new RuntimeException("Không tìm thấy Service trong Kubernetes cluster. Service name: " + serviceName + ", namespace: " + namespace);
                }
                throw new RuntimeException("Không thể lấy thông tin Service từ Kubernetes: " + e.getMessage(), e);
            }
            
            // Bước 11: Lấy thông tin StatefulSet (name) - BẮT BUỘC từ Kubernetes Client
            // Không fallback về DB, nếu không tìm thấy thì throw error
            try {
                V1StatefulSet v1StatefulSet = appsApi.readNamespacedStatefulSet(statefulSetName, namespace, null);
                if (v1StatefulSet == null || v1StatefulSet.getMetadata() == null) {
                    throw new RuntimeException("Không tìm thấy StatefulSet trong Kubernetes cluster. StatefulSet name: " + statefulSetName + ", namespace: " + namespace);
                }
                response.setStatefulSetName(v1StatefulSet.getMetadata().getName());
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    throw new RuntimeException("Không tìm thấy StatefulSet trong Kubernetes cluster. StatefulSet name: " + statefulSetName + ", namespace: " + namespace);
                }
                throw new RuntimeException("Không thể lấy thông tin StatefulSet từ Kubernetes: " + e.getMessage(), e);
            }
            
            // Bước 12: Lấy thông tin PVC (PersistentVolumeClaim) - sử dụng Kubernetes
            // Client
            // PVC name pattern: mysql-data-db-{uuid}-0 hoặc mongodb-data-db-{uuid}-0
            try {
                String pvcNamePattern = database.getDatabaseType().equalsIgnoreCase("MYSQL") 
                        ? "mysql-data-" + statefulSetName + "-0" // MySQL: mysql-data-db-{uuid}-0
                    : "mongodb-data-" + statefulSetName + "-0"; // MongoDB: mongodb-data-db-{uuid}-0
                
                V1PersistentVolumeClaim v1PVC = coreApi.readNamespacedPersistentVolumeClaim(
                        pvcNamePattern, namespace, null);

                if (v1PVC != null) {
                    if (v1PVC.getMetadata() != null) {
                        response.setPvcName(v1PVC.getMetadata().getName());
                    }

                    V1PersistentVolumeClaimStatus pvcStatus = v1PVC.getStatus();
                    if (pvcStatus != null && pvcStatus.getPhase() != null) {
                        response.setPvcStatus(pvcStatus.getPhase());
                    }

                    V1PersistentVolumeClaimSpec pvcSpec = v1PVC.getSpec();
                    if (pvcSpec != null && pvcSpec.getVolumeName() != null) {
                        response.setPvcVolume(pvcSpec.getVolumeName());
                        }
                        
                    if (pvcStatus != null && pvcStatus.getCapacity() != null
                            && pvcStatus.getCapacity().containsKey("storage")) {
                        String capacity = parseQuantityToGB(pvcStatus.getCapacity().get("storage"));
                        response.setPvcCapacity(capacity);
                    }
                }
            } catch (ApiException e) {
                // Bỏ qua lỗi khi lấy thông tin PVC
            }
            
            // Bước 13: Lấy thông tin PV (PersistentVolume) - sử dụng Kubernetes Client
            // PV là tài nguyên cluster-level, không thuộc namespace
            if (response.getPvcVolume() != null && !response.getPvcVolume().isEmpty()) {
                try {
                    V1PersistentVolume v1PV = coreApi.readPersistentVolume(response.getPvcVolume(), null);

                    if (v1PV != null) {
                        if (v1PV.getMetadata() != null) {
                            response.setPvName(v1PV.getMetadata().getName());
                    }
                    
                        V1PersistentVolumeSpec pvSpec = v1PV.getSpec();
                        if (pvSpec != null && pvSpec.getCapacity() != null
                                && pvSpec.getCapacity().containsKey("storage")) {
                            String capacity = parseQuantityToGB(pvSpec.getCapacity().get("storage"));
                            response.setPvCapacity(capacity);
                    }
                    
                        // Thử lấy node từ nodeAffinity (chỉ có với local storage)
                        if (pvSpec != null && pvSpec.getNodeAffinity() != null
                                && pvSpec.getNodeAffinity().getRequired() != null
                                && pvSpec.getNodeAffinity().getRequired().getNodeSelectorTerms() != null
                                && !pvSpec.getNodeAffinity().getRequired().getNodeSelectorTerms().isEmpty()) {
                            try {
                                io.kubernetes.client.openapi.models.V1NodeSelectorTerm term = pvSpec.getNodeAffinity()
                                        .getRequired().getNodeSelectorTerms().get(0);
                                if (term.getMatchExpressions() != null && !term.getMatchExpressions().isEmpty()) {
                                    io.kubernetes.client.openapi.models.V1NodeSelectorRequirement req = term
                                            .getMatchExpressions().get(0);
                                    if (req.getValues() != null && !req.getValues().isEmpty()) {
                                        response.setPvNode(req.getValues().get(0));
                                    }
                        }
                    } catch (Exception e) {
                        // Node info có thể không có, bỏ qua
                    }
                        }
                    }
                } catch (ApiException e) {
                    // Bỏ qua lỗi khi lấy thông tin PV
                }
            }
            
            return response;
            
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chi tiết database: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    /**
     * Lấy chi tiết backend bao gồm thông tin Deployment, Pod, Service, Ingress.
     * 
     * Quy trình xử lý:
     * 1. Lấy backend entity và kiểm tra thông tin cơ bản (project, namespace,
     * uuid_k8s)
     * 2. Tạo tên các Kubernetes resource:
     * - Deployment: app-{uuid}
     * - Service: app-{uuid}-svc
     * - Ingress: app-{uuid}-ing
     * 3. Kết nối SSH đến MASTER server
     * 4. Set thông tin backend từ entity (deployment type, framework, domain,
     * docker image, database connection)
     * 5. Lấy thông tin Deployment (name, replicas)
     * 6. Lấy thông tin Pod (name, node, status) - lấy pod đầu tiên từ deployment
     * 7. Lấy thông tin Service (name, type, port)
     * 8. Lấy thông tin Ingress (name, hosts, address, port, class) - có fallback
     * nếu không tìm thấy theo tên
     * 
     * @param backendId ID của backend cần lấy chi tiết
     * @return AdminBackendDetailResponse chứa đầy đủ thông tin backend và
     *         Kubernetes resources
     * @throws RuntimeException nếu backend không tồn tại hoặc thiếu thông tin cần
     *                          thiết
     */
    @Override
    public AdminBackendDetailResponse getBackendDetail(Long backendId) {
        // Bước 1: Lấy backend entity từ database
        ProjectBackendEntity backend = projectBackendRepository.findById(backendId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy backend với id " + backendId));
        
        // Bước 2: Kiểm tra backend có thuộc về project không
        ProjectEntity project = backend.getProject();
        if (project == null) {
            throw new RuntimeException("Backend không thuộc về project nào");
        }
        
        // Bước 3: Kiểm tra project có namespace không
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace");
        }
        namespace = namespace.trim();
        
        // Bước 4: Kiểm tra backend có uuid_k8s không
        String uuid_k8s = backend.getUuid_k8s();
        if (uuid_k8s == null || uuid_k8s.trim().isEmpty()) {
            throw new RuntimeException("Backend không có uuid_k8s");
        }
        uuid_k8s = uuid_k8s.trim();
        
        // Bước 5: Tạo tên các Kubernetes resource dựa trên uuid_k8s
        String resourceName = "app-" + uuid_k8s; // Tên chung cho backend resource
        String deploymentName = resourceName; // Deployment name: app-{uuid}
        String serviceName = resourceName + "-svc"; // Service name: app-{uuid}-svc
        String ingressName = resourceName + "-ing"; // Ingress name: app-{uuid}-ing
        
        // Bước 6: Lấy thông tin server MASTER
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));
        
        Session session = null;
        AdminBackendDetailResponse response = new AdminBackendDetailResponse();
        
        try {
            // Bước 7: Kết nối SSH đến MASTER server để lấy kubeconfig
            session = createSession(masterServer);

            // Tạo Kubernetes client từ kubeconfig
            ApiClient client = createKubernetesClient(session);
            CoreV1Api coreApi = new CoreV1Api(client);
            AppsV1Api appsApi = new AppsV1Api(client);
            NetworkingV1Api networkingApi = new NetworkingV1Api(client);
            
            // Bước 8: Set thông tin backend từ entity (không cần truy vấn Kubernetes)
            response.setBackendId(backend.getId());
            response.setProjectName(backend.getProjectName());
            response.setDeploymentType(backend.getDeploymentType());
            response.setFrameworkType(backend.getFrameworkType());
            response.setDomainNameSystem(backend.getDomainNameSystem());
            response.setDockerImage(backend.getDockerImage());
            
            // Bước 9: Set thông tin kết nối database (backend sử dụng để kết nối database)
            response.setDatabaseIp(backend.getDatabaseIp());
            response.setDatabasePort(backend.getDatabasePort());
            response.setDatabaseName(backend.getDatabaseName());
            response.setDatabaseUsername(backend.getDatabaseUsername());
            response.setDatabasePassword(backend.getDatabasePassword());
            
            // Bước 10: Lấy thông tin Deployment (name, replicas) - BẮT BUỘC từ Kubernetes Client
            // Không fallback về DB, nếu không tìm thấy thì throw error
            try {
                V1Deployment v1Deployment = appsApi.readNamespacedDeployment(deploymentName, namespace, null);
                if (v1Deployment == null || v1Deployment.getMetadata() == null) {
                    throw new RuntimeException("Không tìm thấy Deployment trong Kubernetes cluster. Deployment name: " + deploymentName + ", namespace: " + namespace);
                }
                
                // Set thông tin Deployment từ Kubernetes
                response.setDeploymentName(v1Deployment.getMetadata().getName());
                    if (v1Deployment.getSpec() != null && v1Deployment.getSpec().getReplicas() != null) {
                        response.setReplicas(v1Deployment.getSpec().getReplicas());
                }
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    throw new RuntimeException("Không tìm thấy Deployment trong Kubernetes cluster. Deployment name: " + deploymentName + ", namespace: " + namespace);
                }
                throw new RuntimeException("Không thể lấy thông tin Deployment từ Kubernetes: " + e.getMessage(), e);
            }
            
            // Lấy thông tin Pod (lấy pod đầu tiên từ deployment) - BẮT BUỘC từ Kubernetes Client
            // Không fallback về DB, nếu không tìm thấy thì throw error
            try {
                io.kubernetes.client.openapi.models.V1PodList podList = coreApi.listNamespacedPod(
                        namespace, null, null, null, null,
                        "app=" + resourceName, null, null, null, null, null, null);
                if (podList == null || podList.getItems() == null || podList.getItems().isEmpty()) {
                    throw new RuntimeException("Không tìm thấy Pod trong Kubernetes cluster. Label selector: app=" + resourceName + ", namespace: " + namespace);
                }
                
                    V1Pod v1Pod = podList.getItems().get(0);
                if (v1Pod.getMetadata() == null) {
                    throw new RuntimeException("Pod không có metadata trong Kubernetes cluster");
                    }
                
                // Set thông tin Pod từ Kubernetes
                response.setPodName(v1Pod.getMetadata().getName());
                    if (v1Pod.getSpec() != null && v1Pod.getSpec().getNodeName() != null) {
                        response.setPodNode(v1Pod.getSpec().getNodeName());
                    }
                    if (v1Pod.getStatus() != null && v1Pod.getStatus().getPhase() != null) {
                        response.setPodStatus(v1Pod.getStatus().getPhase());
                }
            } catch (ApiException e) {
                throw new RuntimeException("Không thể lấy thông tin Pod từ Kubernetes: " + e.getMessage(), e);
            }
            
            // Lấy thông tin Service - BẮT BUỘC từ Kubernetes Client
            // Không fallback về DB, nếu không tìm thấy thì throw error
            try {
                V1Service v1Service = coreApi.readNamespacedService(serviceName, namespace, null);
                if (v1Service == null || v1Service.getMetadata() == null) {
                    throw new RuntimeException("Không tìm thấy Service trong Kubernetes cluster. Service name: " + serviceName + ", namespace: " + namespace);
                }
                
                // Set thông tin Service từ Kubernetes
                response.setServiceName(v1Service.getMetadata().getName());
                    V1ServiceSpec spec = v1Service.getSpec();
                    if (spec != null) {
                        if (spec.getType() != null) {
                            response.setServiceType(spec.getType());
                }
                        if (spec.getPorts() != null && !spec.getPorts().isEmpty()
                                && spec.getPorts().get(0).getPort() != null) {
                            response.setServicePort(spec.getPorts().get(0).getPort().toString());
                    }
                }
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    throw new RuntimeException("Không tìm thấy Service trong Kubernetes cluster. Service name: " + serviceName + ", namespace: " + namespace);
                }
                throw new RuntimeException("Không thể lấy thông tin Service từ Kubernetes: " + e.getMessage(), e);
            }
            
            // Bước 13: Lấy thông tin Ingress (name, hosts, address, port, class) - sử dụng
            // Kubernetes Client
            // Strategy: Thử tìm theo tên trước, nếu không có thì tìm tất cả ingress và
            // filter theo service name
            try {
                // Strategy 1: Kiểm tra xem ingress có tồn tại không (theo tên chuẩn)
                try {
                    V1Ingress v1Ingress = networkingApi.readNamespacedIngress(ingressName, namespace, null);
                    if (v1Ingress != null) {
                    response.setIngressName(ingressName);
                    
                        V1IngressSpec spec = v1Ingress.getSpec();
                        if (spec != null) {
                            // Lấy hosts
                            if (spec.getRules() != null) {
                                List<String> hosts = new ArrayList<>();
                                for (V1IngressRule rule : spec.getRules()) {
                                    if (rule.getHost() != null && !rule.getHost().isEmpty()) {
                                        hosts.add(rule.getHost());
                                    }
                                }
                                if (!hosts.isEmpty()) {
                                    response.setIngressHosts(String.join(" ", hosts));
                                }
                    }
                    
                            // Lấy ingress class
                            if (spec.getIngressClassName() != null) {
                                response.setIngressClass(spec.getIngressClassName());
                            }

                            // Lấy port từ paths
                            if (spec.getRules() != null) {
                                for (V1IngressRule rule : spec.getRules()) {
                                    if (rule.getHttp() != null && rule.getHttp().getPaths() != null) {
                                        for (io.kubernetes.client.openapi.models.V1HTTPIngressPath path : rule.getHttp()
                                                .getPaths()) {
                                            if (path.getBackend() != null
                                                    && path.getBackend().getService() != null
                                                    && path.getBackend().getService().getPort() != null) {
                                                io.kubernetes.client.openapi.models.V1ServiceBackendPort servicePort = path
                                                        .getBackend().getService().getPort();
                                                if (servicePort.getNumber() != null) {
                                                    response.setIngressPort(servicePort.getNumber().toString());
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Lấy address từ status
                        V1IngressStatus ingressStatus = v1Ingress.getStatus();
                        if (ingressStatus != null && ingressStatus.getLoadBalancer() != null
                                && ingressStatus.getLoadBalancer().getIngress() != null
                                && !ingressStatus.getLoadBalancer().getIngress().isEmpty()) {
                            V1IngressLoadBalancerIngress lbIngress = ingressStatus.getLoadBalancer().getIngress()
                                    .get(0);
                            if (lbIngress.getIp() != null) {
                                response.setIngressAddress(lbIngress.getIp());
                            } else if (lbIngress.getHostname() != null) {
                                response.setIngressAddress(lbIngress.getHostname());
                            }
                        }
                    }
                } catch (ApiException e) {
                    // Ingress không tồn tại theo tên, thử Strategy 2: tìm tất cả ingress và filter
                    if (e.getCode() == 404) {
                        try {
                            io.kubernetes.client.openapi.models.V1IngressList ingressList = networkingApi
                                    .listNamespacedIngress(namespace, null, null, null, null, null, null, null, null,
                                            null, null, null);
                            if (ingressList != null && ingressList.getItems() != null) {
                                for (V1Ingress v1Ingress : ingressList.getItems()) {
                                    // Kiểm tra xem ingress có backend service trùng với serviceName không
                                    boolean found = false;
                                    if (v1Ingress.getSpec() != null && v1Ingress.getSpec().getRules() != null) {
                                        for (V1IngressRule rule : v1Ingress.getSpec().getRules()) {
                                            if (rule.getHttp() != null && rule.getHttp().getPaths() != null) {
                                                for (io.kubernetes.client.openapi.models.V1HTTPIngressPath path : rule
                                                        .getHttp().getPaths()) {
                                                    if (path.getBackend() != null
                                                            && path.getBackend().getService() != null
                                                            && serviceName
                                                                    .equals(path.getBackend().getService().getName())) {
                                                        found = true;
                                                        break;
                                                    }
                                                }
                                            }
                                            if (found)
                                                break;
                                        }
                                    }

                                    if (found && v1Ingress.getMetadata() != null) {
                                        String foundIngressName = v1Ingress.getMetadata().getName();
                                    response.setIngressName(foundIngressName);
                                    
                                    // Lấy các thông tin tương tự như Strategy 1
                                        V1IngressSpec spec = v1Ingress.getSpec();
                                        if (spec != null) {
                                            // Hosts
                                            if (spec.getRules() != null) {
                                                List<String> hosts = new ArrayList<>();
                                                for (V1IngressRule rule : spec.getRules()) {
                                                    if (rule.getHost() != null && !rule.getHost().isEmpty()) {
                                                        hosts.add(rule.getHost());
                                                    }
                                                }
                                                if (!hosts.isEmpty()) {
                                                    response.setIngressHosts(String.join(" ", hosts));
                                    }
                                            }

                                            // Ingress class
                                            if (spec.getIngressClassName() != null) {
                                                response.setIngressClass(spec.getIngressClassName());
                                            }

                                            // Port
                                            if (spec.getRules() != null) {
                                                for (V1IngressRule rule : spec.getRules()) {
                                                    if (rule.getHttp() != null && rule.getHttp().getPaths() != null) {
                                                        for (io.kubernetes.client.openapi.models.V1HTTPIngressPath path : rule
                                                                .getHttp().getPaths()) {
                                                            if (path.getBackend() != null
                                                                    && path.getBackend().getService() != null
                                                                    && path.getBackend().getService()
                                                                            .getPort() != null) {
                                                                io.kubernetes.client.openapi.models.V1ServiceBackendPort servicePort = path
                                                                        .getBackend().getService().getPort();
                                                                if (servicePort.getNumber() != null) {
                                                                    response.setIngressPort(
                                                                            servicePort.getNumber().toString());
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // Address
                                        V1IngressStatus ingressStatus = v1Ingress.getStatus();
                                        if (ingressStatus != null && ingressStatus.getLoadBalancer() != null
                                                && ingressStatus.getLoadBalancer().getIngress() != null
                                                && !ingressStatus.getLoadBalancer().getIngress().isEmpty()) {
                                            V1IngressLoadBalancerIngress lbIngress = ingressStatus.getLoadBalancer()
                                                    .getIngress().get(0);
                                            if (lbIngress.getIp() != null) {
                                                response.setIngressAddress(lbIngress.getIp());
                                            } else if (lbIngress.getHostname() != null) {
                                                response.setIngressAddress(lbIngress.getHostname());
                                            }
                                    }
                                        break; // Tìm thấy rồi, không cần tìm tiếp
                                }
                            }
                            }
                        } catch (ApiException ex) {
                            // Bỏ qua lỗi
                        }
                    }
                }
            } catch (Exception e) {
                // Bỏ qua lỗi khi lấy thông tin Ingress
            }
            
            return response;
            
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chi tiết backend: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    /**
     * Lấy chi tiết frontend bao gồm thông tin Deployment, Pod, Service, Ingress.
     * 
     * Quy trình xử lý tương tự getBackendDetail, nhưng frontend không có thông tin
     * kết nối database.
     * 
     * Quy trình xử lý:
     * 1. Lấy frontend entity và kiểm tra thông tin cơ bản (project, namespace,
     * uuid_k8s)
     * 2. Tạo tên các Kubernetes resource (giống backend: app-{uuid})
     * 3. Kết nối SSH đến MASTER server
     * 4. Set thông tin frontend từ entity (deployment type, framework, domain,
     * docker image)
     * 5. Lấy thông tin Deployment, Pod, Service, Ingress (tương tự backend)
     * 
     * @param frontendId ID của frontend cần lấy chi tiết
     * @return AdminFrontendDetailResponse chứa đầy đủ thông tin frontend và
     *         Kubernetes resources
     * @throws RuntimeException nếu frontend không tồn tại hoặc thiếu thông tin cần
     *                          thiết
     */
    @Override
    public AdminFrontendDetailResponse getFrontendDetail(Long frontendId) {
        // Bước 1: Lấy frontend entity từ database
        ProjectFrontendEntity frontend = projectFrontendRepository.findById(frontendId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy frontend với id " + frontendId));
        
        // Bước 2: Kiểm tra frontend có thuộc về project không
        ProjectEntity project = frontend.getProject();
        if (project == null) {
            throw new RuntimeException("Frontend không thuộc về project nào");
        }
        
        // Bước 3: Kiểm tra project có namespace không
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace");
        }
        namespace = namespace.trim();
        
        // Bước 4: Kiểm tra frontend có uuid_k8s không
        String uuid_k8s = frontend.getUuid_k8s();
        if (uuid_k8s == null || uuid_k8s.trim().isEmpty()) {
            throw new RuntimeException("Frontend không có uuid_k8s");
        }
        uuid_k8s = uuid_k8s.trim();
        
        // Bước 5: Tạo tên các Kubernetes resource (giống backend)
        String resourceName = "app-" + uuid_k8s; // Tên chung cho frontend resource
        String deploymentName = resourceName; // Deployment name: app-{uuid}
        String serviceName = resourceName + "-svc"; // Service name: app-{uuid}-svc
        String ingressName = resourceName + "-ing"; // Ingress name: app-{uuid}-ing
        
        // Bước 6: Lấy thông tin server MASTER
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));
        
        Session session = null;
        AdminFrontendDetailResponse response = new AdminFrontendDetailResponse();
        
        try {
            // Bước 7: Kết nối SSH đến MASTER server để lấy kubeconfig
            session = createSession(masterServer);

            // Tạo Kubernetes client từ kubeconfig
            ApiClient client = createKubernetesClient(session);
            CoreV1Api coreApi = new CoreV1Api(client);
            AppsV1Api appsApi = new AppsV1Api(client);
            NetworkingV1Api networkingApi = new NetworkingV1Api(client);
            
            // Bước 8: Set thông tin frontend từ entity (không cần truy vấn Kubernetes)
            response.setFrontendId(frontend.getId());
            response.setProjectName(frontend.getProjectName());
            response.setDeploymentType(frontend.getDeploymentType());
            response.setFrameworkType(frontend.getFrameworkType());
            response.setDomainNameSystem(frontend.getDomainNameSystem());
            response.setDockerImage(frontend.getDockerImage());
            
            // Bước 9: Lấy thông tin Deployment (name, replicas) - BẮT BUỘC từ Kubernetes Client
            // Không fallback về DB, nếu không tìm thấy thì throw error
            try {
                V1Deployment v1Deployment = appsApi.readNamespacedDeployment(deploymentName, namespace, null);
                if (v1Deployment == null || v1Deployment.getMetadata() == null) {
                    throw new RuntimeException("Không tìm thấy Deployment trong Kubernetes cluster. Deployment name: " + deploymentName + ", namespace: " + namespace);
                }
                
                // Set thông tin Deployment từ Kubernetes
                response.setDeploymentName(v1Deployment.getMetadata().getName());
                    if (v1Deployment.getSpec() != null && v1Deployment.getSpec().getReplicas() != null) {
                        response.setReplicas(v1Deployment.getSpec().getReplicas());
                }
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    throw new RuntimeException("Không tìm thấy Deployment trong Kubernetes cluster. Deployment name: " + deploymentName + ", namespace: " + namespace);
                }
                throw new RuntimeException("Không thể lấy thông tin Deployment từ Kubernetes: " + e.getMessage(), e);
            }
            
            // Bước 10: Lấy thông tin Pod (name, node, status) - BẮT BUỘC từ Kubernetes Client
            // Không fallback về DB, nếu không tìm thấy thì throw error
            try {
                io.kubernetes.client.openapi.models.V1PodList podList = coreApi.listNamespacedPod(
                        namespace, null, null, null, null,
                        "app=" + resourceName, null, null, null, null, null, null);
                if (podList == null || podList.getItems() == null || podList.getItems().isEmpty()) {
                    throw new RuntimeException("Không tìm thấy Pod trong Kubernetes cluster. Label selector: app=" + resourceName + ", namespace: " + namespace);
                }
                
                    V1Pod v1Pod = podList.getItems().get(0);
                if (v1Pod.getMetadata() == null) {
                    throw new RuntimeException("Pod không có metadata trong Kubernetes cluster");
                    }
                
                // Set thông tin Pod từ Kubernetes
                response.setPodName(v1Pod.getMetadata().getName());
                    if (v1Pod.getSpec() != null && v1Pod.getSpec().getNodeName() != null) {
                        response.setPodNode(v1Pod.getSpec().getNodeName());
                    }
                    if (v1Pod.getStatus() != null && v1Pod.getStatus().getPhase() != null) {
                        response.setPodStatus(v1Pod.getStatus().getPhase());
                }
            } catch (ApiException e) {
                throw new RuntimeException("Không thể lấy thông tin Pod từ Kubernetes: " + e.getMessage(), e);
            }
            
            // Bước 11: Lấy thông tin Service (name, type, port) - BẮT BUỘC từ Kubernetes Client
            // Không fallback về DB, nếu không tìm thấy thì throw error
            try {
                V1Service v1Service = coreApi.readNamespacedService(serviceName, namespace, null);
                if (v1Service == null || v1Service.getMetadata() == null) {
                    throw new RuntimeException("Không tìm thấy Service trong Kubernetes cluster. Service name: " + serviceName + ", namespace: " + namespace);
                }
                
                // Set thông tin Service từ Kubernetes
                response.setServiceName(v1Service.getMetadata().getName());
                    V1ServiceSpec spec = v1Service.getSpec();
                    if (spec != null) {
                        if (spec.getType() != null) {
                            response.setServiceType(spec.getType());
                }
                        if (spec.getPorts() != null && !spec.getPorts().isEmpty()
                                && spec.getPorts().get(0).getPort() != null) {
                            response.setServicePort(spec.getPorts().get(0).getPort().toString());
                    }
                }
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    throw new RuntimeException("Không tìm thấy Service trong Kubernetes cluster. Service name: " + serviceName + ", namespace: " + namespace);
                }
                throw new RuntimeException("Không thể lấy thông tin Service từ Kubernetes: " + e.getMessage(), e);
            }
            
            // Bước 12: Lấy thông tin Ingress (name, hosts, address, port, class) - sử dụng
            // Kubernetes Client
            // Strategy: Thử tìm theo tên trước, nếu không có thì tìm tất cả ingress và
            // filter theo service name
            try {
                // Strategy 1: Kiểm tra xem ingress có tồn tại không (theo tên chuẩn)
                try {
                    V1Ingress v1Ingress = networkingApi.readNamespacedIngress(ingressName, namespace, null);
                    if (v1Ingress != null) {
                    response.setIngressName(ingressName);
                    
                        V1IngressSpec spec = v1Ingress.getSpec();
                        if (spec != null) {
                    // Lấy hosts
                            if (spec.getRules() != null) {
                                List<String> hosts = new ArrayList<>();
                                for (V1IngressRule rule : spec.getRules()) {
                                    if (rule.getHost() != null && !rule.getHost().isEmpty()) {
                                        hosts.add(rule.getHost());
                                    }
                                }
                                if (!hosts.isEmpty()) {
                                    response.setIngressHosts(String.join(" ", hosts));
                                }
                    }
                    
                            // Lấy ingress class
                            if (spec.getIngressClassName() != null) {
                                response.setIngressClass(spec.getIngressClassName());
                            }

                            // Lấy port từ paths
                            if (spec.getRules() != null) {
                                for (V1IngressRule rule : spec.getRules()) {
                                    if (rule.getHttp() != null && rule.getHttp().getPaths() != null) {
                                        for (io.kubernetes.client.openapi.models.V1HTTPIngressPath path : rule.getHttp()
                                                .getPaths()) {
                                            if (path.getBackend() != null
                                                    && path.getBackend().getService() != null
                                                    && path.getBackend().getService().getPort() != null) {
                                                io.kubernetes.client.openapi.models.V1ServiceBackendPort servicePort = path
                                                        .getBackend().getService().getPort();
                                                if (servicePort.getNumber() != null) {
                                                    response.setIngressPort(servicePort.getNumber().toString());
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Lấy address từ status
                        V1IngressStatus ingressStatus = v1Ingress.getStatus();
                        if (ingressStatus != null && ingressStatus.getLoadBalancer() != null
                                && ingressStatus.getLoadBalancer().getIngress() != null
                                && !ingressStatus.getLoadBalancer().getIngress().isEmpty()) {
                            V1IngressLoadBalancerIngress lbIngress = ingressStatus.getLoadBalancer().getIngress()
                                    .get(0);
                            if (lbIngress.getIp() != null) {
                                response.setIngressAddress(lbIngress.getIp());
                            } else if (lbIngress.getHostname() != null) {
                                response.setIngressAddress(lbIngress.getHostname());
                            }
                        }
                    }
                } catch (ApiException e) {
                    // Ingress không tồn tại theo tên, thử Strategy 2: tìm tất cả ingress và filter
                    if (e.getCode() == 404) {
                        try {
                            io.kubernetes.client.openapi.models.V1IngressList ingressList = networkingApi
                                    .listNamespacedIngress(namespace, null, null, null, null, null, null, null, null,
                                            null, null, null);
                            if (ingressList != null && ingressList.getItems() != null) {
                                for (V1Ingress v1Ingress : ingressList.getItems()) {
                                    // Kiểm tra xem ingress có backend service trùng với serviceName không
                                    boolean found = false;
                                    if (v1Ingress.getSpec() != null && v1Ingress.getSpec().getRules() != null) {
                                        for (V1IngressRule rule : v1Ingress.getSpec().getRules()) {
                                            if (rule.getHttp() != null && rule.getHttp().getPaths() != null) {
                                                for (io.kubernetes.client.openapi.models.V1HTTPIngressPath path : rule
                                                        .getHttp().getPaths()) {
                                                    if (path.getBackend() != null
                                                            && path.getBackend().getService() != null
                                                            && serviceName
                                                                    .equals(path.getBackend().getService().getName())) {
                                                        found = true;
                                                        break;
                                                    }
                                                }
                                            }
                                            if (found)
                                                break;
                                        }
                                    }

                                    if (found && v1Ingress.getMetadata() != null) {
                                        String foundIngressName = v1Ingress.getMetadata().getName();
                                    response.setIngressName(foundIngressName);
                                    
                                    // Lấy các thông tin tương tự như Strategy 1
                                        V1IngressSpec spec = v1Ingress.getSpec();
                                        if (spec != null) {
                                            // Hosts
                                            if (spec.getRules() != null) {
                                                List<String> hosts = new ArrayList<>();
                                                for (V1IngressRule rule : spec.getRules()) {
                                                    if (rule.getHost() != null && !rule.getHost().isEmpty()) {
                                                        hosts.add(rule.getHost());
                                                    }
                                                }
                                                if (!hosts.isEmpty()) {
                                                    response.setIngressHosts(String.join(" ", hosts));
                                    }
                                            }

                                            // Ingress class
                                            if (spec.getIngressClassName() != null) {
                                                response.setIngressClass(spec.getIngressClassName());
                                            }

                                            // Port
                                            if (spec.getRules() != null) {
                                                for (V1IngressRule rule : spec.getRules()) {
                                                    if (rule.getHttp() != null && rule.getHttp().getPaths() != null) {
                                                        for (io.kubernetes.client.openapi.models.V1HTTPIngressPath path : rule
                                                                .getHttp().getPaths()) {
                                                            if (path.getBackend() != null
                                                                    && path.getBackend().getService() != null
                                                                    && path.getBackend().getService()
                                                                            .getPort() != null) {
                                                                io.kubernetes.client.openapi.models.V1ServiceBackendPort servicePort = path
                                                                        .getBackend().getService().getPort();
                                                                if (servicePort.getNumber() != null) {
                                                                    response.setIngressPort(
                                                                            servicePort.getNumber().toString());
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // Address
                                        V1IngressStatus ingressStatus = v1Ingress.getStatus();
                                        if (ingressStatus != null && ingressStatus.getLoadBalancer() != null
                                                && ingressStatus.getLoadBalancer().getIngress() != null
                                                && !ingressStatus.getLoadBalancer().getIngress().isEmpty()) {
                                            V1IngressLoadBalancerIngress lbIngress = ingressStatus.getLoadBalancer()
                                                    .getIngress().get(0);
                                            if (lbIngress.getIp() != null) {
                                                response.setIngressAddress(lbIngress.getIp());
                                            } else if (lbIngress.getHostname() != null) {
                                                response.setIngressAddress(lbIngress.getHostname());
                                            }
                                    }
                                        break; // Tìm thấy rồi, không cần tìm tiếp
                                }
                            }
                            }
                        } catch (ApiException ex) {
                            // Bỏ qua lỗi
                        }
                    }
                }
            } catch (Exception e) {
                // Bỏ qua lỗi khi lấy thông tin Ingress
            }
            
            return response;
            
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chi tiết frontend: " + e.getMessage(), e);
        } finally {
            // Đảm bảo đóng SSH session
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    /**
     * Lấy thông tin tổng quan về cluster metrics (Nodes, Pods, Deployments,
     * CPU/Memory usage).
     * Sử dụng Kubernetes Java Client cho nodes, pods, deployments. Metrics (kubectl
     * top) vẫn dùng SSH.
     * 
     * Quy trình xử lý:
     * 1. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 2. Tạo Kubernetes Java Client từ kubeconfig
     * 3. Lấy thông tin Nodes từ CoreV1Api - đếm total, healthy (Ready), unhealthy
     * (NotReady)
     * 4. Lấy thông tin Pods từ CoreV1Api - đếm total, running, pending, failed
     * 5. Lấy thông tin Deployments từ AppsV1Api - đếm total, active (ready > 0),
     * error (ready = 0)
     * 6. Lấy CPU/Memory usage từ kubectl top (vẫn cần SSH vì không có trong
     * standard API)
     * 7. Tổng hợp và trả về DashboardMetricsResponse
     * 
     * @return DashboardMetricsResponse chứa thông tin nodes, pods, deployments,
     *         cpuUsage, memoryUsage
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public DashboardMetricsResponse getDashboardMetrics() {
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
            CoreV1Api coreApi = new CoreV1Api(client);
            AppsV1Api appsApi = new AppsV1Api(client);
            
            DashboardMetricsResponse response = new DashboardMetricsResponse();
            
            // Bước 1: Lấy thông tin Nodes
            // Đồng bộ với getNodes(): Đếm tất cả servers có clusterStatus=AVAILABLE (không chỉ nodes đã join K8s)
            try {
                // Lấy danh sách servers đã được gán vào cluster (clusterStatus = "AVAILABLE")
                List<ServerEntity> clusterServers = serverRepository.findAllByClusterStatusIgnoreCase("AVAILABLE")
                        .stream()
                        .filter(s -> "MASTER".equals(s.getRole()) || "WORKER".equals(s.getRole()))
                        .collect(java.util.stream.Collectors.toList());
                
                // Lấy danh sách nodes từ K8s để kiểm tra trạng thái
                V1NodeList nodeList = coreApi.listNode(
                        null, null, null, null, null, null, null, null, null, null, null);
                
                // Tạo map để tra cứu nhanh node status theo tên hoặc IP
                Map<String, Boolean> nodeReadyMap = new HashMap<>(); // nodeName/IP -> isReady
                Set<String> k8sNodeNames = new HashSet<>();
                Set<String> k8sNodeIps = new HashSet<>();
                
                if (nodeList != null && nodeList.getItems() != null) {
                    for (V1Node v1Node : nodeList.getItems()) {
                        if (v1Node.getMetadata() != null && v1Node.getMetadata().getName() != null) {
                            String nodeName = v1Node.getMetadata().getName().toLowerCase();
                            k8sNodeNames.add(nodeName);
                            
                            // Kiểm tra Ready status
                            boolean isReady = false;
                            V1NodeStatus status = v1Node.getStatus();
                            if (status != null && status.getConditions() != null) {
                                for (V1NodeCondition condition : status.getConditions()) {
                                    if (condition != null && "Ready".equals(condition.getType())
                                            && "True".equals(condition.getStatus())) {
                                        isReady = true;
                                        break;
                                    }
                                }
                            }
                            nodeReadyMap.put(nodeName, isReady);
                            
                            // Lấy IP từ node addresses
                            if (status != null && status.getAddresses() != null) {
                                for (io.kubernetes.client.openapi.models.V1NodeAddress address : status.getAddresses()) {
                                    if (address != null && "InternalIP".equals(address.getType()) && address.getAddress() != null) {
                                        k8sNodeIps.add(address.getAddress().trim());
                                        nodeReadyMap.put(address.getAddress().trim(), isReady);
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Đếm nodes: Đếm tất cả servers đã assign vào cluster
                int totalNodes = clusterServers.size();
                int healthyNodes = 0;
                int unhealthyNodes = 0;
                
                for (ServerEntity server : clusterServers) {
                    boolean isNodeReady = false;
                    boolean foundInK8s = false;
                    
                    // Kiểm tra xem server đã join K8s chưa
                    if (server.getName() != null && k8sNodeNames.contains(server.getName().toLowerCase())) {
                        foundInK8s = true;
                        isNodeReady = nodeReadyMap.getOrDefault(server.getName().toLowerCase(), false);
                    } else if (server.getIp() != null && k8sNodeIps.contains(server.getIp().trim())) {
                        foundInK8s = true;
                        isNodeReady = nodeReadyMap.getOrDefault(server.getIp().trim(), false);
                    }
                    
                    // Nếu đã join K8s và Ready -> healthy
                    // Nếu chưa join K8s hoặc NotReady -> unhealthy
                    if (foundInK8s && isNodeReady) {
                        healthyNodes++;
                    } else {
                        unhealthyNodes++; // Bao gồm: NotReady, NOT_JOIN_K8S, NOT_ASSIGN
                    }
                }
                
                response.setNodes(new DashboardMetricsResponse.NodeMetrics(totalNodes, healthyNodes, unhealthyNodes));
                System.out.println("[AdminService] getDashboardMetrics() - Nodes: total=" + totalNodes + ", healthy=" + healthyNodes + ", unhealthy=" + unhealthyNodes);
            } catch (Exception e) {
                System.out.println("[AdminService] getDashboardMetrics() - Error getting nodes: " + e.getMessage());
                // Nếu lỗi, set giá trị mặc định
                response.setNodes(new DashboardMetricsResponse.NodeMetrics(0, 0, 0));
            }
            
            // Bước 2: Lấy thông tin Pods
            try {
                io.kubernetes.client.openapi.models.V1PodList podList = coreApi.listPodForAllNamespaces(
                        null, null, null, null, null, null, null, null, null, null, null);
                
                int totalPods = 0;
                int runningPods = 0;
                int pendingPods = 0;
                int failedPods = 0;
                
                if (podList != null && podList.getItems() != null) {
                    for (V1Pod v1Pod : podList.getItems()) {
                        totalPods++;
                        V1PodStatus status = v1Pod.getStatus();
                        if (status != null && status.getPhase() != null) {
                            String phase = status.getPhase();
                            if ("Running".equalsIgnoreCase(phase)) {
                                runningPods++;
                            } else if ("Pending".equalsIgnoreCase(phase)) {
                                pendingPods++;
                            } else if ("Failed".equalsIgnoreCase(phase) || "Error".equalsIgnoreCase(phase)) {
                                failedPods++;
                            }
                        }
                    }
                }
                
                response.setPods(
                        new DashboardMetricsResponse.PodMetrics(totalPods, runningPods, pendingPods, failedPods));
            } catch (Exception e) {
                // Nếu lỗi, set giá trị mặc định
                response.setPods(new DashboardMetricsResponse.PodMetrics(0, 0, 0, 0));
            }
            
            // Bước 3: Lấy thông tin Deployments
            try {
                io.kubernetes.client.openapi.models.V1DeploymentList deploymentList = appsApi
                        .listDeploymentForAllNamespaces(
                                null, null, null, null, null, null, null, null, null, null, null);
                
                int totalDeployments = 0;
                int activeDeployments = 0;
                int errorDeployments = 0;
                
                if (deploymentList != null && deploymentList.getItems() != null) {
                    for (V1Deployment v1Deployment : deploymentList.getItems()) {
                        totalDeployments++;
                        V1DeploymentStatus status = v1Deployment.getStatus();
                        int ready = (status != null && status.getReadyReplicas() != null) ? status.getReadyReplicas()
                                : 0;
                        int desired = (v1Deployment.getSpec() != null && v1Deployment.getSpec().getReplicas() != null)
                                ? v1Deployment.getSpec().getReplicas()
                                : 0;

                                if (ready > 0) {
                                    activeDeployments++;
                                } else if (desired > 0) {
                                    errorDeployments++;
                        }
                    }
                }
                
                response.setDeployments(new DashboardMetricsResponse.DeploymentMetrics(totalDeployments,
                        activeDeployments, errorDeployments));
            } catch (Exception e) {
                // Nếu lỗi, set giá trị mặc định
                response.setDeployments(new DashboardMetricsResponse.DeploymentMetrics(0, 0, 0));
            }
            
            // Bước 4: Lấy CPU/Memory usage từ tất cả pods trong cluster (--all-namespaces)
            try {
                // Lấy allocatable để làm total
                ClusterAllocatableResponse allocatable = getClusterAllocatable();
                
                // Tính tổng CPU/Memory từ tất cả pods trong cluster
                String topPodsCmd = "kubectl top pods --all-namespaces --no-headers";
                String topPodsOutput = executeCommand(session, topPodsCmd, true);
                
                double totalCpuUsed = 0.0;
                long totalMemoryBytes = 0L;
                
                if (topPodsOutput != null && !topPodsOutput.trim().isEmpty()) {
                    String[] lines = topPodsOutput.trim().split("\n");
                    for (String line : lines) {
                        if (line.trim().isEmpty())
                            continue;
                        
                        // Format: NAMESPACE POD_NAME CPU MEMORY
                        // Ví dụ: default nginx-pod 15m 100Mi
                        String[] parts = line.trim().split("\\s+");
                        if (parts.length >= 4) {
                            try {
                                // Parse CPU từ cột thứ 3 (index 2)
                                double cpu = parseCpuCores(parts[2]);
                                // Parse Memory từ cột thứ 4 (index 3)
                                long memory = parseMemoryBytes(parts[3]);
                                
                                totalCpuUsed += cpu;
                                totalMemoryBytes += memory;
                            } catch (NumberFormatException e) {
                                // Bỏ qua dòng không parse được
                            }
                        }
                    }
                }
                
                // Chuyển đổi Memory từ bytes sang GB
                double totalMemoryGb = bytesToGb(totalMemoryBytes);
                
                response.setCpuUsage(new DashboardMetricsResponse.ResourceUsage(
                    roundToThreeDecimals(totalCpuUsed),
                        allocatable.getTotalCpuCores()));
                
                response.setMemoryUsage(new DashboardMetricsResponse.ResourceUsage(
                    roundToThreeDecimals(totalMemoryGb),
                        allocatable.getTotalMemoryGb()));
            } catch (Exception e) {
                // Nếu lỗi, set giá trị mặc định
                response.setCpuUsage(new DashboardMetricsResponse.ResourceUsage(0.0, 0.0));
                response.setMemoryUsage(new DashboardMetricsResponse.ResourceUsage(0.0, 0.0));
            }
            
            return response;
            
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy dashboard metrics: " + e.getMessage(), e);
        } finally {
            // Đảm bảo đóng SSH session
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    /**
     * Lấy danh sách tất cả nodes trong cluster với thông tin chi tiết về CPU,
     * Memory, Disk, Pods.
     * Sử dụng Kubernetes Java Client thay vì SSH + kubectl commands để tăng hiệu
     * suất.
     * 
     * Quy trình xử lý:
     * 1. Kiểm tra MASTER server tồn tại và ONLINE
     * 2. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 3. Tạo Kubernetes Java Client từ kubeconfig
     * 4. Sử dụng CoreV1Api để lấy danh sách nodes
     * 5. Parse V1Node objects thành NodeResponse:
     * - Status từ conditions (Ready/NotReady)
     * - Role từ labels (master/worker)
     * - OS và Kernel từ nodeInfo
     * - CPU/Memory capacity và allocatable từ status
     * - CPU/Memory usage từ kubectl top (vẫn cần SSH)
     * - Pod count từ kubectl (vẫn cần SSH)
     * - Disk info từ SSH vào từng node server
     * 6. Tổng hợp và trả về NodeListResponse
     * 
     * @return NodeListResponse chứa danh sách nodes với đầy đủ thông tin
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public NodeListResponse getNodes() {
        // Bước 1: Lấy danh sách servers đã được gán vào cluster (clusterStatus = "AVAILABLE" và role = MASTER hoặc WORKER)
        List<ServerEntity> clusterServers = serverRepository.findAllByClusterStatusIgnoreCase("AVAILABLE")
                .stream()
                .filter(s -> "MASTER".equals(s.getRole()) || "WORKER".equals(s.getRole()))
                .collect(java.util.stream.Collectors.toList());
        
        System.out.println("[AdminService] getNodes() - So luong servers trong cluster: " + clusterServers.size());
        // Hiển thị danh sách servers
        for (ServerEntity server : clusterServers) {
            String username = server.getUsername() != null ? server.getUsername() : (server.getName() != null ? server.getName() : "server-" + server.getId());
            String ip = server.getIp() != null ? server.getIp() : "unknown";
            System.out.println("[AdminService] getNodes() -   - " + username + " (IP: " + ip + ")");
        }

        // Bước 2: Kiểm tra MASTER server tồn tại
        ServerEntity masterServer = clusterServers.stream()
                .filter(s -> "MASTER".equals(s.getRole()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER trong cluster. Vui lòng cấu hình server MASTER trong hệ thống."));

        // Bước 3: Kiểm tra MASTER server đang ONLINE
        if (masterServer.getStatus() != ServerEntity.ServerStatus.ONLINE) {
            throw new RuntimeException(
                    "MASTER node (" + masterServer.getIp() + ") đang offline. " +
                            "Không thể kết nối đến Kubernetes cluster. " +
                            "Vui lòng kiểm tra kết nối máy chủ và đảm bảo MASTER node đang hoạt động.");
        }

        Session session = null;
        try {
            // Bước 4: Kết nối SSH đến MASTER server để lấy kubeconfig
            session = createSession(masterServer);

            // Bước 5: Tạo Kubernetes client từ kubeconfig
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            
            List<NodeResponse> nodes = new ArrayList<>();
            Set<String> k8sNodeNames = new HashSet<>(); // Set để track các node đã có trong K8s
            Set<String> k8sServerIps = new HashSet<>(); // Set để track các IP của servers đã có trong K8s
            
            // Bước 6: Lấy danh sách nodes từ Kubernetes API
            try {
                System.out.println("[AdminService] getNodes() - Dang goi Kubernetes API de lay danh sach nodes...");
                V1NodeList nodeList = api.listNode(
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

                System.out.println("[AdminService] getNodes() - Kubernetes API tra ve nodeList: "
                        + (nodeList != null ? "not null" : "null"));
                if (nodeList != null) {
                    System.out.println("[AdminService] getNodes() - nodeList.getItems(): "
                            + (nodeList.getItems() != null ? "not null" : "null"));
                    if (nodeList.getItems() != null) {
                        System.out.println("[AdminService] getNodes() - So luong nodes: " + nodeList.getItems().size());
                    }
                }

                // Bước 7: Lấy danh sách servers từ database để match với nodes (cho disk info)
                Map<String, Map<String, ServerEntity>> serverMaps = createServerMaps();
                Map<String, ServerEntity> serverByName = serverMaps.get("byName");
                Map<String, ServerEntity> serverByIp = serverMaps.get("byIp");

                // Bước 8: Lấy CPU/Memory usage từ kubectl top nodes (vẫn cần SSH) - sử dụng helper method
                Map<String, BaseKubernetesService.ResourceUsage> nodeUsageMap = getAllNodesUsageFromKubectlTop(session);

                // Bước 9: Parse từng node từ K8s và map với servers
                if (nodeList != null && nodeList.getItems() != null && !nodeList.getItems().isEmpty()) {
                    System.out.println("[AdminService] getNodes() - Bat dau parse " + nodeList.getItems().size() + " nodes tu K8s...");
                    int parsedCount = 0;
                    int skippedCount = 0;
                    for (V1Node v1Node : nodeList.getItems()) {
                        try {
                            // Basic info - kiểm tra metadata không null
                            if (v1Node.getMetadata() == null || v1Node.getMetadata().getName() == null) {
                                System.out.println(
                                        "[AdminService] getNodes() - WARNING: Bo qua node vi metadata hoac name la null");
                                skippedCount++;
                                continue; // Bỏ qua node không có metadata hoặc name
                            }
                            String nodeName = v1Node.getMetadata().getName();
                            k8sNodeNames.add(nodeName.toLowerCase()); // Track node đã có trong K8s

                            // Sử dụng helper method để parse node (tái sử dụng code)
                            // parseNodeToResponse sẽ set status = "ready" hoặc "notready" từ K8s conditions
                            NodeResponse node = parseNodeToResponse(
                                    v1Node, 
                                    api, 
                                    session, 
                                    false, // includeDetails = false cho API danh sách
                                    nodeUsageMap, 
                                    serverByName, 
                                    serverByIp
                            );
                        
                            // Track IP của server đã được map với node này
                            ServerEntity mappedServer = findServerForNode(nodeName, v1Node.getStatus(), serverByName, serverByIp);
                            
                            // QUAN TRỌNG: Kiểm tra xem node đã join K8s nhưng chưa assign vào cluster không
                            // Nếu node có trong K8s (đã join) nhưng server chưa có clusterStatus=AVAILABLE (chưa assign)
                            // thì phải override status thành "NOT_ASSIGN" (không giữ "ready"/"notready" từ K8s)
                            if (mappedServer != null) {
                                // Tìm thấy server tương ứng
                                String mappedServerIp = mappedServer.getIp();
                                String mappedServerClusterStatus = mappedServer.getClusterStatus();
                                
                                if (mappedServerIp != null) {
                                    k8sServerIps.add(mappedServerIp.trim());
                                    // Fallback: Nếu node chưa có IP (từ K8s), dùng IP từ server
                                    if (node.getIp() == null || node.getIp().trim().isEmpty()) {
                                        node.setIp(mappedServerIp.trim());
                                        System.out.println("[AdminService] getNodes() - Node " + nodeName + " - Sử dụng IP từ server: " + mappedServerIp);
                                    }
                                }
                                
                                // Kiểm tra xem server có clusterStatus=AVAILABLE không
                                if (!"AVAILABLE".equals(mappedServerClusterStatus)) {
                                    // Node đã join K8s nhưng server chưa được gán vào cluster (clusterStatus != AVAILABLE)
                                    // Override status từ "ready"/"notready" thành "NOT_ASSIGN"
                                    node.setStatus("NOT_ASSIGN");
                                    node.setNotAssignAction("ASSIGN");
                                    System.out.println("[AdminService] getNodes() - Node " + nodeName + " -> NOT_ASSIGN (server clusterStatus=" + mappedServerClusterStatus + ")");
                                }
                                // Nếu clusterStatus=AVAILABLE, giữ nguyên status từ K8s (ready/notready) - không cần log
                            } else {
                                // Node đã join K8s nhưng không có server tương ứng trong database
                                // Override status thành "NOT_ASSIGN"
                                node.setStatus("NOT_ASSIGN");
                                node.setNotAssignAction("ASSIGN");
                                System.out.println("[AdminService] getNodes() - Node " + nodeName + " -> NOT_ASSIGN (khong co server tuong ung)");
                            }
                            
                            nodes.add(node);
                            
                            // Track IP trực tiếp từ K8s node addresses (InternalIP, ExternalIP)
                            if (v1Node.getStatus() != null && v1Node.getStatus().getAddresses() != null) {
                                for (io.kubernetes.client.openapi.models.V1NodeAddress address : v1Node.getStatus().getAddresses()) {
                                    if (address != null && address.getAddress() != null) {
                                        String ip = address.getAddress().trim();
                                        k8sServerIps.add(ip);
                                        // Nếu là IPv6 hoặc có port, thêm phần IPv4
                                        if (ip.contains(":")) {
                                            String ipv4 = ip.split(":")[0];
                                            k8sServerIps.add(ipv4);
                                        }
                                    }
                                }
                            }
                            
                            parsedCount++;
                        
                    } catch (Exception e) {
                            skippedCount++;
                            System.out.println("[AdminService] getNodes() - ERROR khi parse node: " + e.getMessage());
                            e.printStackTrace();
                        // Bỏ qua node nếu có lỗi, tiếp tục với node tiếp theo
                    }
                    }

                    System.out.println("[AdminService] getNodes() - Ket qua tu K8s: parsed=" + parsedCount + ", skipped="
                            + skippedCount);
                } else {
                    System.out.println(
                            "[AdminService] getNodes() - WARNING: Khong co nodes nao trong K8s cluster hoac nodeList.getItems() la null/empty");
                }

            } catch (ApiException e) {
                System.out.println("[AdminService] getNodes() - ApiException: " + e.getMessage());
                System.out.println("[AdminService] getNodes() - ApiException code: " + e.getCode());
                System.out.println("[AdminService] getNodes() - ApiException response body: " + e.getResponseBody());
                e.printStackTrace();
                // Không throw exception, tiếp tục với việc tạo nodes từ servers không có trong K8s
            }
            
            // Bước 10: Tạo NodeResponse cho các servers đã gán vào cluster (clusterStatus=AVAILABLE) 
            // nhưng chưa có trong K8s (không có trong kubectl get nodes)
            int notAssignedCount = 0;
            for (ServerEntity server : clusterServers) {
                // Tất cả servers trong clusterServers đều có clusterStatus=AVAILABLE (đã filter ở bước 1)
                // Kiểm tra xem server đã có trong K8s nodes chưa (theo tên hoặc IP)
                boolean foundInK8s = false;
                
                // Kiểm tra theo tên server (so sánh case-insensitive)
                if (server.getName() != null && k8sNodeNames.contains(server.getName().toLowerCase(Locale.ROOT))) {
                    foundInK8s = true;
                }
                
                // Kiểm tra theo IP (nếu chưa tìm thấy theo tên)
                if (!foundInK8s && server.getIp() != null && k8sServerIps.contains(server.getIp().trim())) {
                    foundInK8s = true;
                }
                
                // Nếu server chưa có trong K8s, tạo NodeResponse với status "NOT_JOIN_K8S"
                if (!foundInK8s) {
                    NodeResponse notAssignedNode = createNodeResponseFromServer(server);
                    notAssignedNode.setStatus("NOT_JOIN_K8S");
                    notAssignedNode.setNotAssignAction("JOIN_K8S");
                    nodes.add(notAssignedNode);
                    notAssignedCount++;
                    System.out.println("[AdminService] getNodes() - Server " + server.getName() + " (" + server.getIp() + ") -> NOT_JOIN_K8S");
                }
            }
            
            // Đếm số lượng nodes theo từng loại
            int k8sNormalNodes = 0; // K8s nodes bình thường (ready/notready)
            int k8sNotAssignNodes = 0; // K8s nodes nhưng chưa assign vào cluster (NOT_ASSIGN)
            int notJoinK8sNodes = 0; // Server đã trong cluster nhưng chưa join K8s (NOT_JOIN_K8S)
            
            for (NodeResponse n : nodes) {
                if ("NOT_ASSIGN".equals(n.getStatus())) {
                    k8sNotAssignNodes++; // Node có trong K8s nhưng chưa assign vào cluster
                } else if ("NOT_JOIN_K8S".equals(n.getStatus())) {
                    notJoinK8sNodes++; // Server đã trong cluster nhưng chưa join K8s
                } else {
                    k8sNormalNodes++; // K8s nodes bình thường (ready/notready)
                }
            }
            
            int totalK8sNodes = k8sNormalNodes + k8sNotAssignNodes; // Tổng số nodes từ K8s
            System.out.println("[AdminService] getNodes() - Tong ket: K8s nodes=" + totalK8sNodes + " (trong do: normal=" + k8sNormalNodes + ", chua assign=" + k8sNotAssignNodes + "), NOT_JOIN_K8S=" + notJoinK8sNodes + ", total=" + nodes.size());
            
            return new NodeListResponse(nodes);
            
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy danh sách nodes: " + e.getMessage(), e);
        } finally {
            // Đảm bảo đóng SSH session
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    /**
     * Join node vào K8s cluster bằng cách:
     * 1. Kiểm tra server có clusterStatus=AVAILABLE và ONLINE
     * 2. Kết nối SSH vào server cần join
     * 3. Reset worker node (stop kubelet, kubeadm reset, clean up CNI/iptables/kubelet config)
     * 4. Cấu hình kernel và sysctl
     * 5. Kiểm tra và cài đặt các dependencies (kubelet, kubeadm, kubectl, container runtime)
     * 6. Kết nối đến master để lấy join command
     * 7. Thực thi join command trên server
     * 8. Restart và enable kubelet
     * 
     * @param serverId ID của server cần join vào K8s cluster
     * @throws RuntimeException nếu không tìm thấy server, không thể kết nối, hoặc lỗi khi join
     */
    @Override
    public void joinNodeToK8s(Long serverId) {
        System.out.println("[AdminService] joinNodeToK8s() - Bat dau join server: id=" + serverId);
        
        // Bước 1: Lấy thông tin server cần join
        ServerEntity workerServer = serverRepository.findById(serverId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + serverId));
        
        String username = workerServer.getUsername() != null ? workerServer.getUsername() : (workerServer.getName() != null ? workerServer.getName() : "server-" + serverId);
        String ip = workerServer.getIp() != null ? workerServer.getIp() : "unknown";
        System.out.println("[AdminService] joinNodeToK8s() - Server: " + username + " (IP: " + ip + ")");
        
        // Kiểm tra server có clusterStatus=AVAILABLE không
        if (!"AVAILABLE".equals(workerServer.getClusterStatus())) {
            throw new RuntimeException("Server " + username + " (IP: " + ip + ") chua duoc gan vao cluster (clusterStatus=" + workerServer.getClusterStatus() + "). Vui long assign server vao cluster truoc.");
        }
        
        // Kiểm tra server có ONLINE không
        if (workerServer.getStatus() != ServerEntity.ServerStatus.ONLINE) {
            throw new RuntimeException("Server " + username + " (IP: " + ip + ") dang offline. Vui long kiem tra ket noi server.");
        }
        
        // Bước 2: Lấy thông tin MASTER server
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException("Khong tim thay server MASTER. Vui long cau hinh server MASTER trong he thong."));
        
        if (masterServer.getStatus() != ServerEntity.ServerStatus.ONLINE) {
            throw new RuntimeException("MASTER server (" + masterServer.getIp() + ") dang offline. Khong the lay join command.");
        }
        
        Session workerSession = null;
        Session masterSession = null;
        try {
            // Bước 3: Kết nối SSH đến worker server
            System.out.println("[AdminService] joinNodeToK8s() - Ket noi SSH den worker server: " + username + " (IP: " + ip + ")");
            workerSession = createSession(workerServer);
            
            // Bước 3.5: Reset worker node trước khi join (nếu đã từng join cluster trước đó)
            System.out.println("[AdminService] joinNodeToK8s() - Reset worker node truoc khi join...");
            
            // Stop kubelet service (nếu đang chạy)
            System.out.println("[AdminService] joinNodeToK8s() - Dang stop kubelet service...");
            try {
                executeCommand(workerSession, "sudo systemctl stop kubelet || true", true);
                System.out.println("[AdminService] joinNodeToK8s() - Da stop kubelet service");
            } catch (Exception e) {
                System.out.println("[AdminService] joinNodeToK8s() - Warning: Khong the stop kubelet (co the chua duoc cai dat): " + e.getMessage());
            }
            
            // Chạy kubeadm reset để clean up state (nếu đã từng join cluster)
            System.out.println("[AdminService] joinNodeToK8s() - Dang chay kubeadm reset...");
            try {
                executeCommand(workerSession, "sudo kubeadm reset -f || true", false);
                System.out.println("[AdminService] joinNodeToK8s() - Da chay kubeadm reset");
            } catch (Exception e) {
                System.out.println("[AdminService] joinNodeToK8s() - Warning: Khong the chay kubeadm reset (co the chua duoc cai dat hoac chua join cluster): " + e.getMessage());
            }
            
            // Clean up CNI config và iptables rules
            System.out.println("[AdminService] joinNodeToK8s() - Dang clean up CNI config va iptables...");
            try {
                // Clean up CNI config
                executeCommand(workerSession, "sudo rm -rf /etc/cni/net.d/* || true", true);
                // Clean up iptables rules liên quan đến Kubernetes
                executeCommand(workerSession, "sudo iptables -F && sudo iptables -t nat -F && sudo iptables -t mangle -F && sudo iptables -X || true", true);
                // Clean up kubelet config
                executeCommand(workerSession, "sudo rm -rf /var/lib/kubelet/* || true", true);
                System.out.println("[AdminService] joinNodeToK8s() - Da clean up CNI config va iptables");
            } catch (Exception e) {
                System.out.println("[AdminService] joinNodeToK8s() - Warning: Khong the clean up hoan toan (co the khong co quyen): " + e.getMessage());
            }
            
            // Bước 4: Cấu hình kernel và sysctl (theo playbook)
            System.out.println("[AdminService] joinNodeToK8s() - Cau hinh kernel va sysctl...");
            
            // Disable swap
            System.out.println("[AdminService] joinNodeToK8s() - Disable swap...");
            executeCommand(workerSession, "sudo swapoff -a || true", true);
            
            // Comment swap lines trong /etc/fstab
            System.out.println("[AdminService] joinNodeToK8s() - Comment swap lines trong /etc/fstab...");
            executeCommand(workerSession, "sudo sed -i 's/^\\(.*swap.*\\)$/# \\1/' /etc/fstab", true);
            
            // Load kernel modules (overlay, br_netfilter)
            System.out.println("[AdminService] joinNodeToK8s() - Load kernel modules...");
            executeCommand(workerSession, "sudo mkdir -p /etc/modules-load.d && echo -e 'overlay\\nbr_netfilter' | sudo tee /etc/modules-load.d/containerd.conf", false);
            executeCommand(workerSession, "sudo modprobe overlay && sudo modprobe br_netfilter", true);
            
            // Apply sysctl config
            System.out.println("[AdminService] joinNodeToK8s() - Apply sysctl config...");
            String sysctlConfig = "net.bridge.bridge-nf-call-iptables  = 1\\n" +
                                 "net.bridge.bridge-nf-call-ip6tables = 1\\n" +
                                 "net.ipv4.ip_forward                 = 1";
            executeCommand(workerSession, "printf '" + sysctlConfig + "\\n' | sudo tee /etc/sysctl.d/99-kubernetes-cri.conf", false);
            executeCommand(workerSession, "sudo sysctl --system", false);
            
            // Bước 5: Kiểm tra và cài đặt dependencies
            System.out.println("[AdminService] joinNodeToK8s() - Kiem tra va cai dat dependencies...");
            
            // Kiểm tra container runtime (containerd hoặc docker)
            String containerRuntimeCheck = "which containerd || which docker";
            String containerRuntimeOutput = executeCommand(workerSession, containerRuntimeCheck, true);
            if (containerRuntimeOutput == null || containerRuntimeOutput.trim().isEmpty()) {
                System.out.println("[AdminService] joinNodeToK8s() - Container runtime chua duoc cai dat, dang cai dat containerd...");
                // Cài đặt containerd
                executeCommand(workerSession, "export DEBIAN_FRONTEND=noninteractive && sudo apt-get update && sudo apt-get install -y containerd", false);
            }
            
            // Cấu hình containerd với SystemdCgroup = true
            System.out.println("[AdminService] joinNodeToK8s() - Cau hinh containerd...");
            executeCommand(workerSession, "sudo mkdir -p /etc/containerd && containerd config default | sudo tee /etc/containerd/config.toml", false);
            executeCommand(workerSession, "sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml", true);
            executeCommand(workerSession, "sudo systemctl restart containerd && sudo systemctl enable containerd", false);
            
            // Kiểm tra kubelet, kubeadm, kubectl
            String kubeletCheck = "which kubelet";
            String kubeletOutput = executeCommand(workerSession, kubeletCheck, true);
            if (kubeletOutput == null || kubeletOutput.trim().isEmpty()) {
                System.out.println("[AdminService] joinNodeToK8s() - Kubernetes tools chua duoc cai dat, dang cai dat...");
                // Cài đặt Kubernetes tools
                String installK8s = "export DEBIAN_FRONTEND=noninteractive && " +
                        "sudo apt-get update && " +
                        "sudo apt-get install -y apt-transport-https ca-certificates curl && " +
                        "sudo curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg && " +
                        "echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list && " +
                        "sudo apt-get update && " +
                        "sudo apt-get install -y kubelet kubeadm kubectl && " +
                        "sudo apt-mark hold kubelet kubeadm kubectl";
                executeCommand(workerSession, installK8s, false);
            }
            
            // Bước 6: Kết nối SSH đến master server để lấy join command
            System.out.println("[AdminService] joinNodeToK8s() - Ket noi SSH den master server de lay join command...");
            masterSession = createSession(masterServer);
            
            // Lấy join command từ master
            String getJoinCommand = "sudo kubeadm token create --print-join-command";
            String joinCommandOutput = executeCommand(masterSession, getJoinCommand, false);
            
            if (joinCommandOutput == null || joinCommandOutput.trim().isEmpty()) {
                throw new RuntimeException("Khong the lay join command tu master server");
            }
            
            // Parse join command (có thể có nhiều dòng, lấy dòng chứa "kubeadm join")
            String[] lines = joinCommandOutput.split("\\r?\\n");
            String joinCommand = null;
            for (String line : lines) {
                if (line.trim().startsWith("kubeadm join")) {
                    joinCommand = line.trim();
                    break;
                }
            }
            
            if (joinCommand == null) {
                throw new RuntimeException("Khong tim thay join command trong output: " + joinCommandOutput);
            }
            
            System.out.println("[AdminService] joinNodeToK8s() - Join command: " + joinCommand);
            
            // Bước 7: Thực thi join command trên worker server với --ignore-preflight-errors=all
            System.out.println("[AdminService] joinNodeToK8s() - Thuc thi join command tren worker server...");
            String joinCommandWithFlags = joinCommand + " --ignore-preflight-errors=all";
            String joinResult = executeCommand(workerSession, "sudo " + joinCommandWithFlags, true);
            
            System.out.println("[AdminService] joinNodeToK8s() - Join command output: " + joinResult);
            
            // Bước 8: Restart và enable kubelet
            System.out.println("[AdminService] joinNodeToK8s() - Restart kubelet...");
            executeCommand(workerSession, "sudo systemctl restart kubelet && sudo systemctl enable kubelet", false);
            
            System.out.println("[AdminService] joinNodeToK8s() - Da join thanh cong server: " + username + " (IP: " + ip + ") vao K8s cluster");
            
        } catch (Exception e) {
            System.out.println("[AdminService] joinNodeToK8s() - Loi: " + e.getMessage());
            throw new RuntimeException("Khong the join server " + username + " (IP: " + ip + ") vao K8s cluster: " + e.getMessage(), e);
        } finally {
            // Đảm bảo đóng SSH sessions
            if (workerSession != null && workerSession.isConnected()) {
                workerSession.disconnect();
            }
            if (masterSession != null && masterSession.isConnected()) {
                masterSession.disconnect();
            }
        }
    }

    /**
     * Xóa node khỏi K8s cluster một cách an toàn.
     * Thực hiện các bước:
     * 1. Kiểm tra node tồn tại trong cluster
     * 2. Cordon node để đánh dấu không schedulable
     * 3. Drain node để di chuyển pods ra khỏi node
     * 4. Delete node khỏi cluster
     * 5. Stop dịch vụ trên máy worker (kubelet, containerd)
     * 6. Unassign server khỏi cluster (set clusterStatus = UNAVAILABLE)
     * 
     * @param nodeName Tên của node cần xóa
     * @param nodeIp IP của node (optional, nếu có sẽ tối ưu hơn)
     * @throws RuntimeException nếu không tìm thấy master server, không thể kết nối, hoặc lỗi khi xóa node
     */
    @Override
    public void removeNodeFromK8s(String nodeName, String nodeIp) {
        System.out.println("[AdminService] removeNodeFromK8s() - Bắt đầu xóa node: " + nodeName + (nodeIp != null ? " (IP: " + nodeIp + ")" : ""));
        
        Session masterSession = null;
        try {
            // Bước 1: Tìm master server
            ServerEntity masterServer = serverRepository.findByRole("MASTER")
                    .orElseThrow(() -> new RuntimeException(
                            "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

            System.out.println("[AdminService] removeNodeFromK8s() - Kết nối SSH đến master server: " + masterServer.getName());
            masterSession = createSession(masterServer);

            // Bước 2: Kiểm tra node có tồn tại trong cluster không
            String checkNodeCmd = "kubectl get node " + nodeName;
            try {
                String checkResult = executeCommand(masterSession, checkNodeCmd, true);
                if (checkResult == null || checkResult.trim().isEmpty() || checkResult.contains("NotFound")) {
                    throw new RuntimeException("Node '" + nodeName + "' không tồn tại trong cluster");
                }
            } catch (Exception e) {
                throw new RuntimeException("Không thể kiểm tra node '" + nodeName + "': " + e.getMessage());
            }

            // Bước 3: Lấy IP từ node TRƯỚC KHI xóa để tìm server (chỉ lấy nếu chưa có IP từ parameter)
            if (nodeIp == null || nodeIp.trim().isEmpty()) {
                System.out.println("[AdminService] removeNodeFromK8s() - Đang lấy IP từ node: " + nodeName);
                String nodeInfoCmd = "kubectl get node " + nodeName + " -o jsonpath='{.status.addresses[?(@.type==\"InternalIP\")].address}'";
                try {
                    String ipFromNode = executeCommand(masterSession, nodeInfoCmd, true);
                    if (ipFromNode != null && !ipFromNode.trim().isEmpty()) {
                        nodeIp = ipFromNode.trim();
                        System.out.println("[AdminService] removeNodeFromK8s() - Đã lấy được IP từ node: " + nodeIp);
                    }
                } catch (Exception e) {
                    System.out.println("[AdminService] removeNodeFromK8s() - Warning: Không thể lấy IP từ node: " + e.getMessage());
                }
            } else {
                nodeIp = nodeIp.trim();
                System.out.println("[AdminService] removeNodeFromK8s() - Sử dụng IP từ parameter: " + nodeIp);
            }

            // Bước 4: Tìm server tương ứng theo IP (ưu tiên) hoặc theo tên node
            System.out.println("[AdminService] removeNodeFromK8s() - Đang tìm server tương ứng với node: " + nodeName + (nodeIp != null ? " (IP: " + nodeIp + ")" : ""));
            ServerEntity serverToUnassign = null;
            
            // Ưu tiên tìm theo IP
            if (nodeIp != null && !nodeIp.isEmpty()) {
                List<ServerEntity> allServers = serverRepository.findAll();
                for (ServerEntity server : allServers) {
                    if (nodeIp.equals(server.getIp())) {
                        serverToUnassign = server;
                        System.out.println("[AdminService] removeNodeFromK8s() - Tìm thấy server theo IP: " + server.getName() + " (ID: " + server.getId() + ")");
                        break;
                    }
                }
            }
            
            // Nếu không tìm thấy theo IP, thử tìm theo tên node
            if (serverToUnassign == null) {
                List<ServerEntity> allServers = serverRepository.findAll();
                for (ServerEntity server : allServers) {
                    if (nodeName.equals(server.getName())) {
                        serverToUnassign = server;
                        System.out.println("[AdminService] removeNodeFromK8s() - Tìm thấy server theo tên: " + server.getName() + " (ID: " + server.getId() + ")");
                        break;
                    }
                }
            }

            // Kiểm tra và validate server trước khi xóa node
            if (serverToUnassign != null) {
                String serverRole = serverToUnassign.getRole();
                System.out.println("[AdminService] removeNodeFromK8s() - Đã tìm thấy server: " + serverToUnassign.getName() + " (ID: " + serverToUnassign.getId() + ", Role: " + serverRole + ")");
                
                // Chỉ kiểm tra nếu đang xóa MASTER cuối cùng (bảo vệ cluster)
                // Worker nodes có thể được gỡ hoàn toàn (cho phép cluster không có worker)
                if ("MASTER".equals(serverRole)) {
                    System.out.println("[AdminService] removeNodeFromK8s() - Đây là MASTER node, kiểm tra số lượng MASTER còn lại...");
                    List<ServerEntity> mastersInCluster = serverRepository.findAllByClusterStatusIgnoreCase("AVAILABLE");
                    long masterCount = mastersInCluster.stream()
                            .filter(s -> "MASTER".equals(s.getRole()))
                            .count();
                    System.out.println("[AdminService] removeNodeFromK8s() - Số lượng MASTER nodes trong cluster: " + masterCount);
                    if (masterCount <= 1) {
                        System.out.println("[AdminService] removeNodeFromK8s() - ERROR: Không thể xóa MASTER cuối cùng!");
                        throw new RuntimeException("Không thể bỏ server MASTER này. Phải có ít nhất 1 MASTER trong cluster.");
                    }
                    System.out.println("[AdminService] removeNodeFromK8s() - OK: Còn nhiều hơn 1 MASTER, cho phép xóa.");
                } else if ("WORKER".equals(serverRole)) {
                    System.out.println("[AdminService] removeNodeFromK8s() - Đây là WORKER node, cho phép gỡ (không kiểm tra số lượng worker còn lại)");
                    // Worker nodes: Cho phép gỡ tất cả worker nodes (không kiểm tra)
                } else {
                    System.out.println("[AdminService] removeNodeFromK8s() - Warning: Server có role không xác định: " + serverRole + ", vẫn tiếp tục xóa node.");
                }
            } else {
                System.out.println("[AdminService] removeNodeFromK8s() - Warning: Không tìm thấy server tương ứng với node: " + nodeName + (nodeIp != null ? " (IP: " + nodeIp + ")" : ""));
                System.out.println("[AdminService] removeNodeFromK8s() - Tiếp tục xóa node khỏi K8s cluster (không có server trong DB)");
            }

            // Bước 5: Cordon node để đánh dấu không schedulable (ngăn pods mới được schedule vào node)
            System.out.println("[AdminService] removeNodeFromK8s() - Đang cordon node: " + nodeName);
            String cordonCmd = "kubectl cordon " + nodeName;
            try {
                String cordonResult = executeCommand(masterSession, cordonCmd, true);
                System.out.println("[AdminService] removeNodeFromK8s() - Cordon result: " + cordonResult);
            } catch (Exception e) {
                System.out.println("[AdminService] removeNodeFromK8s() - Warning: Cordon có thể không hoàn toàn thành công: " + e.getMessage());
                // Tiếp tục với việc drain ngay cả khi cordon có lỗi (drain cũng tự động cordon)
            }

            // Bước 6: Drain node để di chuyển pods ra khỏi node một cách an toàn
            System.out.println("[AdminService] removeNodeFromK8s() - Đang drain node: " + nodeName);
            String drainCmd = String.format(
                "kubectl drain %s --ignore-daemonsets --delete-emptydir-data --force --grace-period=60 --timeout=300s",
                nodeName
            );
            boolean drainSuccess = false;
            String drainError = null;
            try {
                String drainResult = executeCommand(masterSession, drainCmd, true);
                System.out.println("[AdminService] removeNodeFromK8s() - Drain result: " + drainResult);
                
                // Kiểm tra xem drain có thành công không (kiểm tra pods còn lại)
                String checkPodsCmd = String.format("kubectl get pods --all-namespaces --field-selector spec.nodeName=%s --no-headers 2>/dev/null | grep -v Completed | grep -v Succeeded | wc -l", nodeName);
                String remainingPodsStr = executeCommand(masterSession, checkPodsCmd, true);
                int remainingPods = 0;
                try {
                    remainingPods = Integer.parseInt(remainingPodsStr.trim());
                } catch (NumberFormatException e) {
                    // Không parse được, coi như không có pods còn lại
                }
                
                if (remainingPods > 0) {
                    System.out.println("[AdminService] removeNodeFromK8s() - Warning: Vẫn còn " + remainingPods + " pods trên node sau khi drain");
                    drainError = "Vẫn còn " + remainingPods + " pods không thể di chuyển khỏi node. Có thể là pods với nodeSelector hoặc local storage.";
                } else {
                    drainSuccess = true;
                    System.out.println("[AdminService] removeNodeFromK8s() - Drain thành công, không còn pods nào trên node");
                }
            } catch (Exception e) {
                drainError = "Drain không thành công: " + e.getMessage();
                System.out.println("[AdminService] removeNodeFromK8s() - Error: " + drainError);
                
                // Kiểm tra xem có pods nào còn lại không
                try {
                    String checkPodsCmd = String.format("kubectl get pods --all-namespaces --field-selector spec.nodeName=%s --no-headers 2>/dev/null | grep -v Completed | grep -v Succeeded | wc -l", nodeName);
                    String remainingPodsStr = executeCommand(masterSession, checkPodsCmd, true);
                    int remainingPods = 0;
                    try {
                        remainingPods = Integer.parseInt(remainingPodsStr.trim());
                    } catch (NumberFormatException ex) {
                        // Không parse được
                    }
                    
                    if (remainingPods > 0) {
                        drainError += ". Vẫn còn " + remainingPods + " pods trên node.";
                    }
                } catch (Exception ex) {
                    // Không kiểm tra được pods
                }
                
                // Nếu drain thất bại, throw exception để dừng quá trình xóa node
                // Người dùng cần xử lý pods thủ công trước
                throw new RuntimeException("Không thể drain node '" + nodeName + "'. " + drainError + 
                    " Vui lòng di chuyển hoặc xóa các pods này trước khi tiếp tục xóa node. " +
                    "Nếu chắc chắn muốn tiếp tục, vui lòng xử lý pods thủ công.");
            }
            
            // Nếu drain thành công nhưng có cảnh báo, chỉ log warning
            if (!drainSuccess && drainError != null) {
                System.out.println("[AdminService] removeNodeFromK8s() - Warning: " + drainError);
                System.out.println("[AdminService] removeNodeFromK8s() - Tiếp tục với việc xóa node...");
            }

            // Bước 7: Xóa node khỏi cluster
            System.out.println("[AdminService] removeNodeFromK8s() - Đang xóa node: " + nodeName);
            String deleteNodeCmd = "kubectl delete node " + nodeName;
            try {
                String deleteResult = executeCommand(masterSession, deleteNodeCmd, false);
                System.out.println("[AdminService] removeNodeFromK8s() - Delete result: " + deleteResult);
            } catch (Exception e) {
                throw new RuntimeException("Không thể xóa node '" + nodeName + "' khỏi cluster: " + e.getMessage());
            }

            // Bước 8: Stop dịch vụ trên máy worker (kubelet, containerd) - chỉ với WORKER nodes
            Session workerSession = null;
            if (serverToUnassign != null && "WORKER".equals(serverToUnassign.getRole())) {
                try {
                    System.out.println("[AdminService] removeNodeFromK8s() - Đang kết nối đến worker server để stop dịch vụ: " + serverToUnassign.getName());
                    workerSession = createSession(serverToUnassign);
                    
                    // Stop kubelet service
                    System.out.println("[AdminService] removeNodeFromK8s() - Đang stop kubelet service...");
                    try {
                        String stopKubeletCmd = "sudo systemctl stop kubelet || true";
                        executeCommand(workerSession, stopKubeletCmd, true);
                        System.out.println("[AdminService] removeNodeFromK8s() - Đã stop kubelet service");
                    } catch (Exception e) {
                        System.out.println("[AdminService] removeNodeFromK8s() - Warning: Không thể stop kubelet: " + e.getMessage());
                    }
                    
                    // Stop containerd service (nếu có)
                    System.out.println("[AdminService] removeNodeFromK8s() - Đang stop containerd service...");
                    try {
                        String stopContainerdCmd = "sudo systemctl stop containerd || true";
                        executeCommand(workerSession, stopContainerdCmd, true);
                        System.out.println("[AdminService] removeNodeFromK8s() - Đã stop containerd service");
                    } catch (Exception e) {
                        System.out.println("[AdminService] removeNodeFromK8s() - Warning: Không thể stop containerd: " + e.getMessage());
                    }
                    
                } catch (Exception e) {
                    System.out.println("[AdminService] removeNodeFromK8s() - Warning: Không thể kết nối đến worker để stop dịch vụ: " + e.getMessage());
                    // Không throw exception, tiếp tục với việc unassign server
                } finally {
                    if (workerSession != null && workerSession.isConnected()) {
                        workerSession.disconnect();
                    }
                }
            }

            // Bước 9: Unassign server khỏi cluster (set clusterStatus = UNAVAILABLE)
            if (serverToUnassign != null) {
                serverToUnassign.setClusterStatus("UNAVAILABLE");
                serverRepository.save(serverToUnassign);
                System.out.println("[AdminService] removeNodeFromK8s() - Đã unassign server khỏi cluster: " + serverToUnassign.getName());
            }

            System.out.println("[AdminService] removeNodeFromK8s() - Đã xóa node thành công: " + nodeName);

        } catch (Exception e) {
            System.out.println("[AdminService] removeNodeFromK8s() - Lỗi: " + e.getMessage());
            throw new RuntimeException("Không thể xóa node '" + nodeName + "' khỏi K8s cluster: " + e.getMessage(), e);
        } finally {
            // Đảm bảo đóng SSH session
            if (masterSession != null && masterSession.isConnected()) {
                masterSession.disconnect();
            }
        }
    }

    /**
     * Lấy chi tiết một node cụ thể theo tên, bao gồm đầy đủ thông tin: pods, labels, yaml.
     * 
     * @param name Tên của node cần lấy chi tiết
     * @return NodeResponse chứa đầy đủ thông tin node
     * @throws RuntimeException nếu không tìm thấy node hoặc lỗi khi lấy thông tin
     */
    @Override
    public NodeResponse getNode(String name) {
        // Bước 1: Kiểm tra MASTER server tồn tại
        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        // Bước 2: Kiểm tra MASTER server đang ONLINE
        if (masterServer.getStatus() != ServerEntity.ServerStatus.ONLINE) {
            throw new RuntimeException(
                    "MASTER node (" + masterServer.getIp() + ") đang offline. " +
                            "Không thể kết nối đến Kubernetes cluster. " +
                            "Vui lòng kiểm tra kết nối máy chủ và đảm bảo MASTER node đang hoạt động.");
        }

        Session session = null;
        try {
            // Bước 3: Kết nối SSH đến MASTER server để lấy kubeconfig
            session = createSession(masterServer);

            // Bước 4: Tạo Kubernetes client từ kubeconfig
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            
            // Bước 5: Lấy node cụ thể từ Kubernetes API
            V1Node v1Node;
            try {
                System.out.println("[AdminService] getNode() - Đang lấy node: " + name);
                v1Node = api.readNode(name, null);
                
                if (v1Node == null) {
                    throw new RuntimeException("Không tìm thấy node với tên: " + name);
                }
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    throw new RuntimeException("Không tìm thấy node với tên: " + name);
                }
                throw new RuntimeException("Không thể lấy node từ Kubernetes API: " + e.getMessage(), e);
            }

            // Bước 6: Parse node thành NodeResponse với đầy đủ thông tin
            NodeResponse node = parseNodeToResponse(
                    v1Node, 
                    api, 
                    session, 
                    true, // includeDetails = true cho API chi tiết
                    null, // nodeUsageMap = null (sẽ gọi kubectl top riêng)
                    null, // serverByName = null (sẽ tạo mới)
                    null  // serverByIp = null (sẽ tạo mới)
            );
            
            return node;
            
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chi tiết node: " + e.getMessage(), e);
        } finally {
            // Đảm bảo đóng SSH session
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    /**
     * Tạo server maps từ database để tái sử dụng
     * 
     * @return Map với key "byName" và "byIp" chứa các maps tương ứng
     */
    private Map<String, Map<String, ServerEntity>> createServerMaps() {
            List<ServerEntity> allServers = serverRepository.findAll();
                Map<String, ServerEntity> serverByName = new HashMap<>();
                Map<String, ServerEntity> serverByIp = new HashMap<>();
            for (ServerEntity server : allServers) {
                    if (server.getName() != null) {
                        serverByName.put(server.getName().toLowerCase(Locale.ROOT), server);
                    }
                    if (server.getIp() != null) {
                        serverByIp.put(server.getIp().trim(), server);
                    }
                }
        Map<String, Map<String, ServerEntity>> result = new HashMap<>();
        result.put("byName", serverByName);
        result.put("byIp", serverByIp);
        return result;
    }

    /**
     * Tìm server entity tương ứng với node name hoặc IP
     * 
     * @param nodeName Tên node
     * @param status Node status để lấy IP addresses
     * @param serverByName Map server theo tên
     * @param serverByIp Map server theo IP
     * @return ServerEntity hoặc null nếu không tìm thấy
     */
    private ServerEntity findServerForNode(
            String nodeName,
            V1NodeStatus status,
            Map<String, ServerEntity> serverByName,
            Map<String, ServerEntity> serverByIp) {
        ServerEntity nodeServer = null;
        
        // Bước 1: Ưu tiên tìm theo IP (chính xác hơn)
        if (status != null && status.getAddresses() != null) {
            for (io.kubernetes.client.openapi.models.V1NodeAddress address : status.getAddresses()) {
                if (address != null && address.getAddress() != null) {
                    String normalizedIp = address.getAddress().trim();
                    nodeServer = serverByIp.get(normalizedIp);
                    if (nodeServer == null && normalizedIp.contains(":")) {
                        // IPv6 hoặc IP có port -> lấy phần trước dấu :
                        String ipv4 = normalizedIp.split(":")[0];
                        nodeServer = serverByIp.get(ipv4);
                    }
                    if (nodeServer != null) {
                        break;
                    }
                }
            }
        }
        
        // Bước 2: Nếu không tìm thấy theo IP, thử tìm theo tên (chính xác)
        if (nodeServer == null) {
            nodeServer = serverByName.get(nodeName.toLowerCase(Locale.ROOT));
        }
        
        // Bước 3: Nếu vẫn không tìm thấy, thử so khớp gần đúng (nodeName chứa serverName hoặc ngược lại)
        // Nhưng chỉ match nếu serverName có độ dài >= 3 để tránh match sai (ví dụ: "1" match với "k8s-worker1")
        if (nodeServer == null) {
            String nodeNameLower = nodeName.toLowerCase(Locale.ROOT);
            for (Map.Entry<String, ServerEntity> entry : serverByName.entrySet()) {
                String serverNameLower = entry.getKey();
                // Chỉ match nếu serverName có độ dài >= 3 để tránh match sai
                if (serverNameLower.length() >= 3) {
                    if (nodeNameLower.contains(serverNameLower) || serverNameLower.contains(nodeNameLower)) {
                        nodeServer = entry.getValue();
                        break;
                    }
                }
            }
        }
        
        return nodeServer;
    }

    /**
     * Tạo NodeResponse từ ServerEntity với status "NOT_JOIN_K8S"
     * Dùng cho các server đã được gán vào cluster nhưng chưa có trong K8s
     * 
     * @param server Server entity
     * @return NodeResponse với status "NOT_JOIN_K8S" (sẽ được set lại ở nơi gọi)
     */
    private NodeResponse createNodeResponseFromServer(ServerEntity server) {
        NodeResponse node = new NodeResponse();
        
        // Basic info
        node.setId(String.valueOf(server.getId()));
        // Dùng username làm tên hiển thị cho NOT_JOIN_K8S nodes (vì name có thể là id)
        node.setName(server.getUsername() != null ? server.getUsername() : (server.getName() != null ? server.getName() : "server-" + server.getId()));
        node.setIp(server.getIp() != null ? server.getIp().trim() : null); // Lưu IP từ server
        node.setStatus("NOT_JOIN_K8S"); // Status mặc định, có thể được override ở nơi gọi
        node.setRole(server.getRole() != null ? server.getRole().toLowerCase() : "worker");
        
        // Resource info - lấy từ server metrics nếu có, nếu không thì set 0
        NodeResponse.NodeResource cpu = new NodeResponse.NodeResource();
        cpu.setRequested(0.0);
        cpu.setLimit(0.0);
        if (server.getCpuCores() != null && !server.getCpuCores().isEmpty()) {
            try {
                double cpuCapacity = Double.parseDouble(server.getCpuCores());
                cpu.setCapacity(cpuCapacity);
                cpu.setLimit(cpuCapacity);
            } catch (NumberFormatException e) {
                cpu.setCapacity(0.0);
            }
        } else {
            cpu.setCapacity(0.0);
        }
        node.setCpu(cpu);
        
        NodeResponse.NodeResource memory = new NodeResponse.NodeResource();
        memory.setRequested(0.0);
        memory.setLimit(0.0);
        if (server.getRamTotal() != null && !server.getRamTotal().isEmpty()) {
            try {
                double memoryCapacity = parseMemoryBytes(server.getRamTotal()) / BYTES_PER_GB;
                memory.setCapacity(memoryCapacity);
                memory.setLimit(memoryCapacity);
            } catch (Exception e) {
                memory.setCapacity(0.0);
            }
        } else {
            memory.setCapacity(0.0);
        }
        node.setMemory(memory);
        
        // Disk info - lấy từ server metrics nếu có
        NodeResponse.NodeResource disk = new NodeResponse.NodeResource();
        disk.setRequested(0.0);
        disk.setLimit(0.0);
        if (server.getDiskTotal() != null && !server.getDiskTotal().isEmpty()) {
            try {
                double diskCapacity = parseMemoryBytes(server.getDiskTotal()) / BYTES_PER_GB;
                disk.setCapacity(diskCapacity);
                disk.setLimit(diskCapacity);
            } catch (Exception e) {
                disk.setCapacity(0.0);
            }
        } else {
            disk.setCapacity(0.0);
        }
        node.setDisk(disk);
        
        // Other info
        node.setPodCount(0);
        node.setOs("Unknown");
        node.setKernel("Unknown");
        node.setKubeletVersion("N/A");
        node.setContainerRuntime("N/A");
        node.setUpdatedAt(java.time.LocalDateTime.now().toString());
        node.setLabels(new HashMap<>());
        node.setPods(new ArrayList<>());
        node.setYaml("");
        
        return node;
    }

    /**
     * Lấy thông tin disk từ server bằng cách SSH và chạy df -h /
     * 
     * @param server Server entity
     * @return Map với key "used" và "capacity" (đơn vị GB)
     */
    private Map<String, Double> getDiskInfoFromServer(ServerEntity server) {
        Map<String, Double> result = new HashMap<>();
        result.put("used", 0.0);
        result.put("capacity", 0.0);
        
        if (server == null) {
            return result;
        }
        
        Session nodeSession = null;
        try {
            nodeSession = createSession(server);
            String dfCmd = "df -h / | tail -n 1";
            String dfOutput = executeCommand(nodeSession, dfCmd, true);
            
            if (dfOutput != null && !dfOutput.trim().isEmpty()) {
                String[] dfParts = dfOutput.trim().split("\\s+");
                if (dfParts.length >= 4) {
                    String sizeStr = dfParts[1]; // Size
                    String usedStr = dfParts[2]; // Used
                    result.put("capacity", parseMemoryBytes(sizeStr) / BYTES_PER_GB);
                    result.put("used", parseMemoryBytes(usedStr) / BYTES_PER_GB);
                        }
                    }
                } catch (Exception e) {
            // Nếu không thể lấy disk info, để giá trị mặc định 0
        } finally {
            if (nodeSession != null && nodeSession.isConnected()) {
                nodeSession.disconnect();
            }
        }
        
        return result;
    }

    // Các methods getNodeUsageFromKubectlTop, getAllNodesUsageFromKubectlTop, extractNodeRole 
    // đã được chuyển vào BaseKubernetesService để tái sử dụng

    /**
     * Parse thông tin cơ bản của node (basic info, status, role, OS, CPU/Memory capacity)
     * 
     * @param v1Node V1Node từ Kubernetes API
     * @param nodeName Tên node
     * @param node NodeResponse object để set values
     */
    private void parseNodeBasicInfo(V1Node v1Node, String nodeName, NodeResponse node) {
        // Basic info
                node.setId(nodeName);
                node.setName(nodeName);
                
                        // Lấy IP từ node addresses (InternalIP)
                        V1NodeStatus status = v1Node.getStatus();
                        if (status != null && status.getAddresses() != null) {
                            for (io.kubernetes.client.openapi.models.V1NodeAddress address : status.getAddresses()) {
                                if (address != null && "InternalIP".equals(address.getType()) && address.getAddress() != null) {
                                    node.setIp(address.getAddress().trim());
                                    break; // Lấy InternalIP đầu tiên
                                }
                            }
                        }
                        // Nếu không tìm thấy InternalIP, thử lấy bất kỳ IP nào
                        if (node.getIp() == null && status != null && status.getAddresses() != null) {
                            for (io.kubernetes.client.openapi.models.V1NodeAddress address : status.getAddresses()) {
                                if (address != null && address.getAddress() != null) {
                                    String ip = address.getAddress().trim();
                                    // Lấy phần IPv4 nếu là IPv6 hoặc có port
                                    if (ip.contains(":")) {
                                        ip = ip.split(":")[0];
                                    }
                                    node.setIp(ip);
                                    break;
                                }
                            }
                        }
                
                        // Status từ conditions
                        if (status != null && status.getConditions() != null) {
                            for (V1NodeCondition condition : status.getConditions()) {
                                if (condition != null && "Ready".equals(condition.getType())) {
                                    if ("True".equals(condition.getStatus())) {
                        node.setStatus("ready");
                    } else {
                        node.setStatus("notready");
                    }
                                    break;
                                }
                            }
        }
        if (node.getStatus() == null) {
                            node.setStatus("notready");
                    }
                    
        // Role từ labels - sử dụng helper method từ BaseKubernetesService
        node.setRole(extractNodeRole(v1Node, nodeName));
        
        // OS, Kernel, Kubelet, Container Runtime từ nodeInfo
        V1NodeSystemInfo nodeInfo = status != null ? status.getNodeInfo() : null;
        if (nodeInfo != null) {
            node.setOs(nodeInfo.getOperatingSystem() != null ? nodeInfo.getOperatingSystem() : "Unknown");
            node.setKernel(nodeInfo.getKernelVersion() != null ? nodeInfo.getKernelVersion() : "Unknown");
            node.setKubeletVersion(nodeInfo.getKubeletVersion() != null ? nodeInfo.getKubeletVersion() : "Unknown");
            node.setContainerRuntime(nodeInfo.getContainerRuntimeVersion() != null
                    ? nodeInfo.getContainerRuntimeVersion() : "Unknown");
        } else {
            node.setOs("Unknown");
            node.setKernel("Unknown");
            node.setKubeletVersion("Unknown");
            node.setContainerRuntime("Unknown");
        }
        
        // UpdatedAt từ creationTimestamp
        if (v1Node.getMetadata() != null && v1Node.getMetadata().getCreationTimestamp() != null) {
            node.setUpdatedAt(v1Node.getMetadata().getCreationTimestamp().toString());
        } else {
            node.setUpdatedAt("");
        }
    }

    /**
     * Helper method để parse V1Node thành NodeResponse
     * 
     * @param v1Node V1Node từ Kubernetes API
     * @param api CoreV1Api để lấy pods
     * @param masterSession SSH session đến master server
     * @param includeDetails true nếu cần lấy đầy đủ pods, labels, yaml; false nếu chỉ lấy thông tin cơ bản
     * @param nodeUsageMap Map chứa CPU/Memory usage đã lấy sẵn (có thể null)
     * @param serverByName Map server theo tên (có thể null, sẽ tạo mới nếu null)
     * @param serverByIp Map server theo IP (có thể null, sẽ tạo mới nếu null)
     * @return NodeResponse
     */
    private NodeResponse parseNodeToResponse(
            V1Node v1Node, 
            CoreV1Api api, 
            Session masterSession,
            boolean includeDetails,
            Map<String, BaseKubernetesService.ResourceUsage> nodeUsageMap,
            Map<String, ServerEntity> serverByName,
            Map<String, ServerEntity> serverByIp) {
        NodeResponse node = new NodeResponse();
        
        // Basic info
        if (v1Node.getMetadata() == null || v1Node.getMetadata().getName() == null) {
            throw new RuntimeException("Node không có metadata hoặc name");
        }
        String nodeName = v1Node.getMetadata().getName();
        System.out.println("[AdminService] parseNodeToResponse() - Dang parse node: " + nodeName);
        
        V1NodeStatus status = v1Node.getStatus();
        
        // Parse thông tin cơ bản sử dụng helper method
        parseNodeBasicInfo(v1Node, nodeName, node);
        
        // Labels - chỉ lấy nếu includeDetails = true
        if (includeDetails) {
                        if (v1Node.getMetadata() != null && v1Node.getMetadata().getLabels() != null) {
                            node.setLabels(v1Node.getMetadata().getLabels());
                        } else {
                            node.setLabels(Collections.emptyMap());
                        }
                        } else {
            node.setLabels(Collections.emptyMap());
                        }

        // CPU và Memory capacity và allocatable từ status
                        double cpuCapacity = 0.0;
                    double cpuAllocatable = 0.0;
        long memCapacityBytes = 0L;
        long memAllocatableBytes = 0L;
        
                        if (status != null && status.getCapacity() != null && status.getCapacity().containsKey("cpu")) {
                            cpuCapacity = parseQuantityToCpuCores(status.getCapacity().get("cpu"));
                        }
        if (status != null && status.getAllocatable() != null && status.getAllocatable().containsKey("cpu")) {
                            cpuAllocatable = parseQuantityToCpuCores(status.getAllocatable().get("cpu"));
                        }

        if (status != null && status.getCapacity() != null && status.getCapacity().containsKey("memory")) {
                            memCapacityBytes = parseQuantityToMemoryBytes(status.getCapacity().get("memory"));
                        }
        if (status != null && status.getAllocatable() != null && status.getAllocatable().containsKey("memory")) {
                            memAllocatableBytes = parseQuantityToMemoryBytes(status.getAllocatable().get("memory"));
                    }
                    
        // Lấy CPU/Memory usage - ưu tiên từ nodeUsageMap nếu có, nếu không thì gọi kubectl top
        double cpuUsed = 0.0;
        long memUsedBytes = 0L;
        if (nodeUsageMap != null && nodeUsageMap.containsKey(nodeName)) {
            BaseKubernetesService.ResourceUsage usage = nodeUsageMap.get(nodeName);
            cpuUsed = usage != null ? usage.getCpuCores() : 0.0;
            memUsedBytes = usage != null ? usage.getMemoryBytes() : 0L;
        } else {
            // Fallback: gọi kubectl top cho node cụ thể (kém hiệu quả hơn)
            BaseKubernetesService.ResourceUsage usage = getNodeUsageFromKubectlTop(nodeName, masterSession);
            if (usage != null) {
                cpuUsed = usage.getCpuCores();
                memUsedBytes = usage.getMemoryBytes();
            }
        }
        
        // Lấy pods trên node - chỉ lấy danh sách đầy đủ nếu includeDetails = true
                        int podCount = 0;
                        List<NodeResponse.NodePod> nodePods = new ArrayList<>();
                    try {
                            io.kubernetes.client.openapi.models.V1PodList podList = api.listPodForAllNamespaces(
                    null, null, "spec.nodeName=" + nodeName, null, null, null, null, null, null, null, null);
                            if (podList != null && podList.getItems() != null) {
                                podCount = podList.getItems().size();
                // Chỉ parse danh sách pods nếu includeDetails = true
                if (includeDetails) {
                                for (io.kubernetes.client.openapi.models.V1Pod pod : podList.getItems()) {
                                    NodeResponse.NodePod nodePod = new NodeResponse.NodePod();
                                    if (pod.getMetadata() != null) {
                            nodePod.setName(pod.getMetadata().getName() != null ? pod.getMetadata().getName() : "-");
                                        nodePod.setNamespace(pod.getMetadata().getNamespace() != null
                                    ? pod.getMetadata().getNamespace() : "-");
                                        nodePod.setAge(pod.getMetadata().getCreationTimestamp() != null
                                    ? pod.getMetadata().getCreationTimestamp().toString() : "-");
                                    } else {
                                        nodePod.setName("-");
                                        nodePod.setNamespace("-");
                                        nodePod.setAge("-");
                                    }

                                    io.kubernetes.client.openapi.models.V1PodStatus podStatus = pod.getStatus();
                                    if (podStatus != null) {
                            nodePod.setStatus(podStatus.getPhase() != null ? podStatus.getPhase() : "unknown");
                                        nodePod.setIp(podStatus.getPodIP() != null ? podStatus.getPodIP() : "-");
                                    } else {
                                        nodePod.setStatus("unknown");
                                        nodePod.setIp("-");
                                    }
                                    nodePods.add(nodePod);
                    }
                                }
                        }
                        } catch (ApiException e) {
            // Nếu không lấy được pods, để giá trị mặc định
                    }
                    node.setPodCount(podCount);
                        node.setPods(nodePods);
                    
                    // Tạo NodeResource cho CPU
                    NodeResponse.NodeResource cpuResource = new NodeResponse.NodeResource();
                    cpuResource.setRequested(roundToThreeDecimals(cpuUsed));
                    cpuResource.setLimit(roundToThreeDecimals(cpuAllocatable));
                    cpuResource.setCapacity(roundToThreeDecimals(cpuCapacity));
                    node.setCpu(cpuResource);
                    
                    // Tạo NodeResource cho Memory
                    NodeResponse.NodeResource memResource = new NodeResponse.NodeResource();
                    memResource.setRequested(roundToThreeDecimals(bytesToGb(memUsedBytes)));
                    memResource.setLimit(roundToThreeDecimals(bytesToGb(memAllocatableBytes)));
                    memResource.setCapacity(roundToThreeDecimals(bytesToGb(memCapacityBytes)));
                    node.setMemory(memResource);
                    
        // Disk: Lấy từ server bằng cách SSH vào server và chạy df -h /
                    NodeResponse.NodeResource diskResource = new NodeResponse.NodeResource();
                    double diskUsed = 0.0;
                    double diskCapacity = 0.0;
                    
        // Tìm server tương ứng với node name - tái sử dụng maps nếu có, nếu không thì tạo mới
        Map<String, ServerEntity> localServerByName = serverByName;
        Map<String, ServerEntity> localServerByIp = serverByIp;
        if (localServerByName == null || localServerByIp == null) {
            Map<String, Map<String, ServerEntity>> serverMaps = createServerMaps();
            localServerByName = serverMaps.get("byName");
            localServerByIp = serverMaps.get("byIp");
                        }

        // Tìm server entity sử dụng helper method
        ServerEntity nodeServer = findServerForNode(nodeName, status, localServerByName, localServerByIp);
        
        // Lấy disk info từ server sử dụng helper method
                                    if (nodeServer != null) {
            Map<String, Double> diskInfo = getDiskInfoFromServer(nodeServer);
            diskUsed = diskInfo.get("used");
            diskCapacity = diskInfo.get("capacity");
        }
                    
                    diskResource.setRequested(roundToThreeDecimals(diskUsed));
                        diskResource.setLimit(roundToThreeDecimals(diskCapacity));
                    diskResource.setCapacity(roundToThreeDecimals(diskCapacity));
                    node.setDisk(diskResource);
                    
        // UpdatedAt đã được set trong parseNodeBasicInfo
        
        // YAML - chỉ lấy nếu includeDetails = true
        if (includeDetails) {
                        try {
                            node.setYaml(Yaml.dump(v1Node));
                        } catch (Exception yamlException) {
                            node.setYaml("");
                        }
        } else {
            node.setYaml("");
        }
        
        return node;
    }

    @Override
    public NamespaceListResponse getNamespaces() {
        return adminNamespaceService.getNamespaces();
    }

    @Override
    public NamespaceDetailResponse getNamespace(String name) {
        return adminNamespaceService.getNamespace(name);
    }


    /**
     * Lấy danh sách tất cả deployments trong cluster sử dụng Kubernetes Java
     * Client.
     * 
     * Quy trình xử lý:
     * 1. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 2. Tạo Kubernetes Java Client từ kubeconfig
     * 3. Sử dụng AppsV1Api để lấy danh sách deployments từ tất cả namespaces
     * 4. Parse V1Deployment objects thành DeploymentResponse:
     * - Namespace, Name
     * - Replicas (desired, ready, updated, available) từ spec và status
     * - Status từ conditions và replicas
     * - Containers và Images từ spec.template.spec.containers
     * - Selector từ spec.selector.matchLabels
     * - Age từ creationTimestamp
     * 5. Tổng hợp và trả về DeploymentListResponse
     * 
     * @return DeploymentListResponse chứa danh sách deployments
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public DeploymentListResponse getDeployments() {
        return adminWorkloadService.getDeployments();
    }

    @Override
    public DeploymentResponse createDeployment(my_spring_app.my_spring_app.dto.request.DeploymentRequest request) {
        return adminWorkloadService.createDeployment(request);
    }

    @Override
    public DeploymentResponse createDeploymentFromYaml(String yaml) {
        return adminWorkloadService.createDeploymentFromYaml(yaml);
    }


    /**
     * Tính toán age từ creationTimestamp (OffsetDateTime)
     */
    /**
     * Lấy danh sách tất cả pods trong cluster sử dụng Kubernetes Java Client.
     * 
     * Quy trình xử lý:
     * 1. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 2. Tạo Kubernetes Java Client từ kubeconfig
     * 3. Sử dụng CoreV1Api để lấy danh sách pods từ tất cả namespaces
     * 4. Parse V1Pod objects thành PodResponse:
     * - Namespace, Name
     * - Ready (ready/total) từ container statuses
     * - Status từ phase
     * - Restarts từ container statuses
     * - Age từ creationTimestamp
     * - IP từ status.podIP
     * - Node từ spec.nodeName
     * 5. Tổng hợp và trả về PodListResponse
     * 
     * @return PodListResponse chứa danh sách pods
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public PodListResponse getPods() {
        return adminWorkloadService.getPods();
    }

    @Override
    public PodResponse createPod(my_spring_app.my_spring_app.dto.request.PodRequest request) {
        return adminWorkloadService.createPod(request);
    }

    @Override
    public PodResponse createPodFromYaml(String yaml) {
        return adminWorkloadService.createPodFromYaml(yaml);
    }

    /**
     * Lấy danh sách tất cả statefulsets trong cluster sử dụng Kubernetes Java
     * Client.
     * 
     * Quy trình xử lý:
     * 1. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 2. Tạo Kubernetes Java Client từ kubeconfig
     * 3. Sử dụng AppsV1Api để lấy danh sách statefulsets từ tất cả namespaces
     * 4. Parse V1StatefulSet objects thành StatefulsetResponse:
     * - Namespace, Name
     * - Ready (ready/desired) từ status
     * - Status từ conditions
     * - Service từ spec.serviceName
     * - Containers và Images từ spec.template.spec.containers
     * - Age từ creationTimestamp
     * 5. Tổng hợp và trả về StatefulsetListResponse
     * 
     * @return StatefulsetListResponse chứa danh sách statefulsets
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public StatefulsetListResponse getStatefulsets() {
        return adminWorkloadService.getStatefulsets();
    }

    @Override
    public StatefulsetResponse createStatefulset(my_spring_app.my_spring_app.dto.request.StatefulsetRequest request) {
        return adminWorkloadService.createStatefulset(request);
    }

    @Override
    public StatefulsetResponse createStatefulsetFromYaml(String yaml) {
        return adminWorkloadService.createStatefulsetFromYaml(yaml);
    }

    /**
     * Lấy danh sách tất cả services trong cluster sử dụng Kubernetes Java Client.
     * 
     * Quy trình xử lý:
     * 1. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 2. Tạo Kubernetes Java Client từ kubeconfig
     * 3. Sử dụng CoreV1Api để lấy danh sách services từ tất cả namespaces
     * 4. Parse V1Service objects thành ServiceResponse:
     * - Namespace, Name
     * - Type từ spec.type (ClusterIP, NodePort, LoadBalancer)
     * - ClusterIP từ spec.clusterIP
     * - ExternalIP từ status.loadBalancer.ingress hoặc spec.externalIPs
     * - Ports từ spec.ports (port, targetPort, protocol)
     * - Selector từ spec.selector
     * - Age từ creationTimestamp
     * 5. Tổng hợp và trả về ServiceListResponse
     * 
     * @return ServiceListResponse chứa danh sách services
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public ServiceListResponse getServices() {
        return adminServiceDiscoveryService.getServices();
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.ServiceResponse getService(String namespace, String name) {
        return adminServiceDiscoveryService.getService(namespace, name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.ServiceDetailResponse getServiceDetail(String namespace, String name) {
        return adminServiceDiscoveryService.getServiceDetail(namespace, name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.ServiceResponse createService(my_spring_app.my_spring_app.dto.request.ServiceRequest request) {
        return adminServiceDiscoveryService.createService(request);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.ServiceResponse createServiceFromYaml(String yaml) {
        return adminServiceDiscoveryService.createServiceFromYaml(yaml);
    }

    /**
     * Lấy danh sách tất cả ingress trong cluster sử dụng Kubernetes Java Client.
     * 
     * Quy trình xử lý:
     * 1. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 2. Tạo Kubernetes Java Client từ kubeconfig
     * 3. Sử dụng NetworkingV1Api để lấy danh sách ingress từ tất cả namespaces
     * 4. Parse V1Ingress objects thành IngressResponse:
     * - Namespace, Name
     * - IngressClass từ spec.ingressClassName
     * - Hosts từ spec.rules[*].host
     * - Address từ status.loadBalancer.ingress[*].ip hoặc hostname
     * - Ports từ spec.rules[*].http.paths[*].backend.service.port.number (hoặc mặc
     * định 80, 443)
     * - Age từ creationTimestamp
     * 5. Tổng hợp và trả về IngressListResponse
     * 
     * @return IngressListResponse chứa danh sách ingress
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public IngressListResponse getIngress() {
        return adminServiceDiscoveryService.getIngress();
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.IngressResponse getIngress(String namespace, String name) {
        return adminServiceDiscoveryService.getIngress(namespace, name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.IngressDetailResponse getIngressDetail(String namespace, String name) {
        return adminServiceDiscoveryService.getIngressDetail(namespace, name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.IngressResponse createIngress(my_spring_app.my_spring_app.dto.request.IngressRequest request) {
        return adminServiceDiscoveryService.createIngress(request);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.IngressResponse updateIngress(String namespace, String name, my_spring_app.my_spring_app.dto.request.IngressRequest request) {
        return adminServiceDiscoveryService.updateIngress(namespace, name, request);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.IngressResponse updateIngressFromYaml(String namespace, String name, String yaml) {
        return adminServiceDiscoveryService.updateIngressFromYaml(namespace, name, yaml);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.IngressResponse createIngressFromYaml(String yaml) {
        return adminServiceDiscoveryService.createIngressFromYaml(yaml);
    }

    /**
     * Lấy danh sách tất cả PVCs (PersistentVolumeClaims) trong cluster sử dụng
     * Kubernetes Java Client.
     * 
     * Quy trình xử lý:
     * 1. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 2. Tạo Kubernetes Java Client từ kubeconfig
     * 3. Sử dụng CoreV1Api để lấy danh sách PVCs từ tất cả namespaces
     * 4. Parse V1PersistentVolumeClaim objects thành PVCResponse:
     * - Namespace, Name
     * - Status từ status.phase (Bound/Pending)
     * - Volume từ spec.volumeName
     * - Capacity từ status.capacity.storage
     * - AccessModes từ spec.accessModes
     * - StorageClass từ spec.storageClassName
     * - VolumeAttributesClass từ spec.volumeAttributesClassName
     * - VolumeMode từ spec.volumeMode
     * - Age từ creationTimestamp
     * 5. Tổng hợp và trả về PVCListResponse
     * 
     * @return PVCListResponse chứa danh sách PVCs
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public PVCListResponse getPVCs() {
        return adminStorageService.getPVCs();
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PVCResponse getPVC(String namespace, String name) {
        return adminStorageService.getPVC(namespace, name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PVCDetailResponse getPVCDetail(String namespace, String name) {
        return adminStorageService.getPVCDetail(namespace, name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PVCResponse updatePVCFromYaml(String namespace, String name, String yaml) {
        return adminStorageService.updatePVCFromYaml(namespace, name, yaml);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PVCResponse createPVCFromYaml(String yaml) {
        return adminStorageService.createPVCFromYaml(yaml);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PVCResponse createPVC(my_spring_app.my_spring_app.dto.request.PVCRequest request) {
        return adminStorageService.createPVC(request);
    }

    @Override
    public void deletePVC(String namespace, String name) {
        adminStorageService.deletePVC(namespace, name);
    }

    /**
     * Lấy danh sách tất cả PVs (PersistentVolumes) trong cluster sử dụng Kubernetes
     * Java Client.
     * 
     * Quy trình xử lý:
     * 1. Kết nối SSH đến MASTER server để lấy kubeconfig
     * 2. Tạo Kubernetes Java Client từ kubeconfig
     * 3. Sử dụng CoreV1Api để lấy danh sách PVs
     * 4. Parse V1PersistentVolume objects thành PVResponse:
     * - Name
     * - Capacity từ spec.capacity.storage
     * - AccessModes từ spec.accessModes
     * - ReclaimPolicy từ spec.persistentVolumeReclaimPolicy
     * - Status từ status.phase (Available/Bound/Released)
     * - StorageClass từ spec.storageClassName
     * - Claim từ spec.claimRef (namespace và name)
     * - VolumeAttributesClass từ spec.volumeAttributesClassName
     * - Reason từ status.reason
     * - VolumeMode từ spec.volumeMode
     * - Age từ creationTimestamp
     * 5. Tổng hợp và trả về PVListResponse
     * 
     * @return PVListResponse chứa danh sách PVs
     * @throws RuntimeException nếu không thể kết nối MASTER hoặc lỗi khi gọi
     *                          Kubernetes API
     */
    @Override
    public PVListResponse getPVs() {
        return adminStorageService.getPVs();
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PVResponse getPV(String name) {
        return adminStorageService.getPV(name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PVDetailResponse getPVDetail(String name) {
        return adminStorageService.getPVDetail(name);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PVResponse updatePVFromYaml(String name, String yaml) {
        return adminStorageService.updatePVFromYaml(name, yaml);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PVResponse createPVFromYaml(String yaml) {
        return adminStorageService.createPVFromYaml(yaml);
    }

    @Override
    public my_spring_app.my_spring_app.dto.reponse.PVResponse createPV(my_spring_app.my_spring_app.dto.request.PVRequest request) {
        return adminStorageService.createPV(request);
    }

    @Override
    public void deletePV(String name) {
        adminStorageService.deletePV(name);
    }
}
