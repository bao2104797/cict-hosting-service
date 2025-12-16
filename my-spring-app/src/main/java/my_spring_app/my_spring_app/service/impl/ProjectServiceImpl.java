package my_spring_app.my_spring_app.service.impl;

import my_spring_app.my_spring_app.dto.reponse.CreateProjectResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectBackendListResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectBasicInfoResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectDatabaseListResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectFrontendListResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectOverviewResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectSummaryResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectDeploymentHistoryResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectRequestHistoryResponse;
import my_spring_app.my_spring_app.dto.request.CreateProjectRequest;
import my_spring_app.my_spring_app.entity.BackendRequestEntity;
import my_spring_app.my_spring_app.entity.FrontendRequestEntity;
import my_spring_app.my_spring_app.repository.BackendRequestRepository;
import my_spring_app.my_spring_app.repository.FrontendRequestRepository;
import com.jcraft.jsch.*;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.Configuration;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Namespace;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.util.Config;
import my_spring_app.my_spring_app.entity.ProjectBackendEntity;
import my_spring_app.my_spring_app.entity.ProjectDatabaseEntity;
import my_spring_app.my_spring_app.entity.ProjectEntity;
import my_spring_app.my_spring_app.entity.ProjectFrontendEntity;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.entity.UserEntity;
import my_spring_app.my_spring_app.repository.ProjectRepository;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.repository.UserRepository;
import my_spring_app.my_spring_app.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ProjectServiceImpl extends BaseKubernetesService implements ProjectService {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ServerRepository serverRepository;
    
    @Autowired
    private BackendRequestRepository backendRequestRepository;
    
    @Autowired
    private FrontendRequestRepository frontendRequestRepository;

    @Override
    public CreateProjectResponse createProject(CreateProjectRequest request) {
        System.out.println("[createProject] Bắt đầu tạo project mới với tên: " + request.getProjectName());

        // Tìm user theo username
        Optional<UserEntity> userOptional = userRepository.findByUsername(request.getUsername());
        if (userOptional.isEmpty()) {
            System.err.println("[createProject] Lỗi: User không tồn tại với username: " + request.getUsername());
            throw new RuntimeException("User không tồn tại với username: " + request.getUsername());
        }
        UserEntity user = userOptional.get();
        System.out.println("[createProject] Tìm thấy user với ID: " + user.getId());
        System.out.println("[createProject] Tier của user: " + user.getTier());

        // Kiểm tra giới hạn tier
        if ("STANDARD".equalsIgnoreCase(user.getTier())) {
            long projectCount = projectRepository.countByUser(user);
            System.out.println("[createProject] User STANDARD hiện có " + projectCount + " project(s)");
            if (projectCount >= 1) {
                String errorMessage = "Tài khoản STANDARD chỉ được phép tạo 1 dự án. Vui lòng nâng cấp gói để tiếp tục.";
                System.err.println("[createProject] Lỗi: " + errorMessage);
                throw new RuntimeException(errorMessage);
            }
        }

        // Tạo UUID cho project
        String fullUuid = UUID.randomUUID().toString();
        String uuid_k8s = fullUuid.replace("-", "").substring(0, 12);
        String namespace = "ns-" + uuid_k8s;
        System.out.println("[createProject] Tạo UUID cho project: " + uuid_k8s);

        // Tạo namespace trong Kubernetes trước khi lưu vào database
        try {
            createProjectNamespace(namespace);
            System.out.println("[createProject] Đã tạo namespace trong Kubernetes: " + namespace);
        } catch (Exception e) {
            System.err.println("[createProject] Lỗi khi tạo namespace trong Kubernetes: " + e.getMessage());
            // Nếu không thể tạo namespace, vẫn tiếp tục tạo project trong database
            // nhưng sẽ ghi log lỗi để xử lý sau
            System.err.println("[createProject] Tiếp tục tạo project trong database...");
        }

        // Tạo ProjectEntity
        ProjectEntity projectEntity = new ProjectEntity();
        projectEntity.setProjectName(request.getProjectName());
        projectEntity.setDescription(request.getDescription());
        projectEntity.setNamespace(namespace);
        projectEntity.setUuid_k8s(uuid_k8s);
        projectEntity.setUser(user);
        System.out.println("[createProject] Đã thiết lập thông tin project: projectName=" + request.getProjectName() + ", namespace=" + namespace + ", uuid_k8s=" + uuid_k8s);

        // Lưu vào database
        System.out.println("[createProject] Lưu project vào database");
        ProjectEntity savedProjectEntity = projectRepository.save(projectEntity);
        System.out.println("[createProject] Đã lưu project thành công với ID: " + savedProjectEntity.getId());

        // Chuyển đổi sang CreateProjectResponse
        System.out.println("[createProject] Chuyển đổi sang CreateProjectResponse");
        CreateProjectResponse response = new CreateProjectResponse();
        response.setId(savedProjectEntity.getId());
        response.setProjectName(savedProjectEntity.getProjectName());
        response.setDescription(savedProjectEntity.getDescription());
        response.setUuid_k8s(savedProjectEntity.getUuid_k8s());
        response.setNamespace(savedProjectEntity.getNamespace());
        response.setCreatedAt(savedProjectEntity.getCreatedAt());

        System.out.println("[createProject] Hoàn tất tạo project thành công: projectName=" + savedProjectEntity.getProjectName() + ", id=" + savedProjectEntity.getId());
        return response;
    }

    @Override
    public ProjectSummaryResponse getUserProjects(String username) {
        System.out.println("[getUserProjects] Bắt đầu lấy danh sách projects cho user: " + username);

        // Tìm user theo username
        Optional<UserEntity> userOptional = userRepository.findByUsername(username);
        if (userOptional.isEmpty()) {
            System.err.println("[getUserProjects] Lỗi: User không tồn tại với username: " + username);
            throw new RuntimeException("User không tồn tại với username: " + username);
        }
        UserEntity user = userOptional.get();
        System.out.println("[getUserProjects] Tìm thấy user với ID: " + user.getId());

        // Lấy danh sách projects của user - fetch từng collection riêng biệt để tránh MultipleBagFetchException
        List<ProjectEntity> projects = projectRepository.findByUser(user);
        System.out.println("[getUserProjects] Tìm thấy " + projects.size() + " projects");
        
        // Fetch collections riêng biệt để tránh LazyInitializationException
        List<ProjectEntity> projectsWithDatabases = projectRepository.findByUserWithDatabases(user);
        List<ProjectEntity> projectsWithBackends = projectRepository.findByUserWithBackends(user);
        List<ProjectEntity> projectsWithFrontends = projectRepository.findByUserWithFrontends(user);
        
        // Tạo map để lưu counts
        java.util.Map<Long, Integer> databaseCountMap = new java.util.HashMap<>();
        java.util.Map<Long, Integer> backendCountMap = new java.util.HashMap<>();
        java.util.Map<Long, Integer> frontendCountMap = new java.util.HashMap<>();
        
        // Đếm databases
        for (ProjectEntity p : projectsWithDatabases) {
            databaseCountMap.put(p.getId(), p.getDatabases() != null ? p.getDatabases().size() : 0);
        }
        
        // Đếm backends
        for (ProjectEntity p : projectsWithBackends) {
            backendCountMap.put(p.getId(), p.getBackends() != null ? p.getBackends().size() : 0);
        }
        
        // Đếm frontends
        for (ProjectEntity p : projectsWithFrontends) {
            frontendCountMap.put(p.getId(), p.getFrontends() != null ? p.getFrontends().size() : 0);
        }

        // Chuyển đổi sang ProjectSummaryResponse
        List<ProjectSummaryResponse.ProjectSummaryItem> projectSummaries = projects.stream()
                .map(project -> {
                    // Lấy số lượng từ maps, nếu không có thì mặc định là 0
                    int databaseCount = databaseCountMap.getOrDefault(project.getId(), 0);
                    int backendCount = backendCountMap.getOrDefault(project.getId(), 0);
                    int frontendCount = frontendCountMap.getOrDefault(project.getId(), 0);

                    // Đảm bảo updatedAt được set (nếu null thì dùng createdAt)
                    java.time.LocalDateTime updatedAt = project.getUpdatedAt() != null 
                            ? project.getUpdatedAt() 
                            : project.getCreatedAt();

                    return new ProjectSummaryResponse.ProjectSummaryItem(
                            project.getId(),
                            project.getProjectName(),
                            project.getDescription(),
                            databaseCount,
                            backendCount,
                            frontendCount,
                            updatedAt
                    );
                })
                .collect(Collectors.toList());

        ProjectSummaryResponse response = new ProjectSummaryResponse();
        response.setProjects(projectSummaries);

        System.out.println("[getUserProjects] Hoàn tất lấy danh sách projects: " + projectSummaries.size() + " projects");
        return response;
    }

    @Override
    public ProjectDetailResponse getProjectDetail(Long projectId, String username) {
        System.out.println("[getProjectDetail] Bắt đầu lấy chi tiết project với ID: " + projectId + " cho user: " + username);

        // Tìm user theo username
        Optional<UserEntity> userOptional = userRepository.findByUsername(username);
        if (userOptional.isEmpty()) {
            System.err.println("[getProjectDetail] Lỗi: User không tồn tại với username: " + username);
            throw new RuntimeException("User không tồn tại với username: " + username);
        }
        UserEntity user = userOptional.get();
        System.out.println("[getProjectDetail] Tìm thấy user với ID: " + user.getId());

        // Tìm project theo ID
        Optional<ProjectEntity> projectOptional = projectRepository.findById(projectId);
        if (projectOptional.isEmpty()) {
            System.err.println("[getProjectDetail] Lỗi: Project không tồn tại với ID: " + projectId);
            throw new RuntimeException("Project không tồn tại với ID: " + projectId);
        }
        ProjectEntity project = projectOptional.get();
        System.out.println("[getProjectDetail] Tìm thấy project với tên: " + project.getProjectName());

        // Validate project thuộc về user
        if (project.getUser() == null || !project.getUser().getId().equals(user.getId())) {
            System.err.println("[getProjectDetail] Lỗi: Project không thuộc về user này. Project user ID: " + 
                              (project.getUser() != null ? project.getUser().getId() : "null") + 
                              ", Request user ID: " + user.getId());
            throw new RuntimeException("Bạn không có quyền truy cập project này");
        }

        // Fetch các collections riêng biệt để tránh LazyInitializationException
        // Sử dụng các query riêng để fetch databases, backends, frontends
        ProjectEntity projectWithDatabases = projectRepository.findByIdWithDatabases(projectId).orElse(project);
        ProjectEntity projectWithBackends = projectRepository.findByIdWithBackends(projectId).orElse(project);
        ProjectEntity projectWithFrontends = projectRepository.findByIdWithFrontends(projectId).orElse(project);

        // Map databases
        List<ProjectDetailResponse.DatabaseDetail> databases = (projectWithDatabases.getDatabases() != null ? projectWithDatabases.getDatabases() : project.getDatabases())
                .stream()
                .map(db -> {
                    ProjectDetailResponse.DatabaseDetail detail = new ProjectDetailResponse.DatabaseDetail();
                    detail.setId(db.getId());
                    detail.setProjectName(db.getProjectName());
                    detail.setDescription(db.getDescription());
                    detail.setDatabaseType(db.getDatabaseType());
                    detail.setDatabaseIp(db.getDatabaseIp());
                    detail.setDatabasePort(db.getDatabasePort());
                    detail.setDatabaseName(db.getDatabaseName());
                    detail.setDatabaseUsername(db.getDatabaseUsername());
                    detail.setDatabasePassword(db.getDatabasePassword());
                    detail.setUuid_k8s(db.getUuid_k8s());
                    detail.setSourcePath(db.getSourcePath());
                    detail.setYamlPath(db.getYamlPath());
                    detail.setStatus(db.getStatus());
                    detail.setCreatedAt(db.getCreatedAt());
                    return detail;
                })
                .collect(Collectors.toList());

        // Map backends
        List<ProjectDetailResponse.BackendDetail> backends = (projectWithBackends.getBackends() != null ? projectWithBackends.getBackends() : project.getBackends())
                .stream()
                .map(be -> {
                    ProjectDetailResponse.BackendDetail detail = new ProjectDetailResponse.BackendDetail();
                    detail.setId(be.getId());
                    detail.setProjectName(be.getProjectName());
                    detail.setDescription(be.getDescription());
                    detail.setDeploymentType(be.getDeploymentType());
                    detail.setFrameworkType(be.getFrameworkType());
                    detail.setDatabaseIp(be.getDatabaseIp());
                    detail.setDatabasePort(be.getDatabasePort());
                    detail.setDatabaseName(be.getDatabaseName());
                    detail.setDatabaseUsername(be.getDatabaseUsername());
                    detail.setDatabasePassword(be.getDatabasePassword());
                    detail.setUuid_k8s(be.getUuid_k8s());
                    detail.setSourcePath(be.getSourcePath());
                    detail.setYamlPath(be.getYamlPath());
                    detail.setDockerImage(be.getDockerImage());
                    detail.setDomainNameSystem(be.getDomainNameSystem());
                    detail.setStatus(be.getStatus());
                    detail.setCreatedAt(be.getCreatedAt());
                    return detail;
                })
                .collect(Collectors.toList());

        // Map frontends
        List<ProjectDetailResponse.FrontendDetail> frontends = (projectWithFrontends.getFrontends() != null ? projectWithFrontends.getFrontends() : project.getFrontends())
                .stream()
                .map(fe -> {
                    ProjectDetailResponse.FrontendDetail detail = new ProjectDetailResponse.FrontendDetail();
                    detail.setId(fe.getId());
                    detail.setProjectName(fe.getProjectName());
                    detail.setDescription(fe.getDescription());
                    detail.setDeploymentType(fe.getDeploymentType());
                    detail.setFrameworkType(fe.getFrameworkType());
                    detail.setUuid_k8s(fe.getUuid_k8s());
                    detail.setSourcePath(fe.getSourcePath());
                    detail.setYamlPath(fe.getYamlPath());
                    detail.setDockerImage(fe.getDockerImage());
                    detail.setDomainNameSystem(fe.getDomainNameSystem());
                    detail.setStatus(fe.getStatus());
                    detail.setCreatedAt(fe.getCreatedAt());
                    return detail;
                })
                .collect(Collectors.toList());

        // Tạo response
        ProjectDetailResponse response = new ProjectDetailResponse();
        response.setId(project.getId());
        response.setProjectName(project.getProjectName());
        response.setDescription(project.getDescription());
        // Status mặc định - có thể tính toán dựa trên status của components
        response.setStatus("RUNNING"); // TODO: Tính toán status thực tế
        response.setCreatedAt(project.getCreatedAt());
        response.setUpdatedAt(project.getUpdatedAt() != null ? project.getUpdatedAt() : project.getCreatedAt());
        response.setUuid_k8s(project.getUuid_k8s());
        response.setNamespace(project.getNamespace());
        response.setDatabases(databases);
        response.setBackends(backends);
        response.setFrontends(frontends);

        System.out.println("[getProjectDetail] Hoàn tất lấy chi tiết project: " + project.getProjectName() + 
                          ", databases: " + databases.size() + 
                          ", backends: " + backends.size() + 
                          ", frontends: " + frontends.size());
        return response;
    }

    @Override
    public ProjectBasicInfoResponse getProjectBasicInfo(Long projectId) {
        System.out.println("[getProjectBasicInfo] Bắt đầu lấy thông tin cơ bản project với ID: " + projectId);

        // Tìm project theo ID
        Optional<ProjectEntity> projectOptional = projectRepository.findById(projectId);
        if (projectOptional.isEmpty()) {
            System.err.println("[getProjectBasicInfo] Lỗi: Project không tồn tại với ID: " + projectId);
            throw new RuntimeException("Project không tồn tại với ID: " + projectId);
        }
        ProjectEntity project = projectOptional.get();
        System.out.println("[getProjectBasicInfo] Tìm thấy project với tên: " + project.getProjectName());

        // Tạo response
        ProjectBasicInfoResponse response = new ProjectBasicInfoResponse();
        response.setId(project.getId());
        response.setProjectName(project.getProjectName());
        response.setDescription(project.getDescription());
        response.setCreatedAt(project.getCreatedAt());
        // Đảm bảo updatedAt được set (nếu null thì dùng createdAt)
        response.setUpdatedAt(project.getUpdatedAt() != null ? project.getUpdatedAt() : project.getCreatedAt());

        System.out.println("[getProjectBasicInfo] Hoàn tất lấy thông tin cơ bản project: " + project.getProjectName());
        return response;
    }

    @Override
    public ProjectOverviewResponse getProjectOverview(Long projectId) {
        System.out.println("[getProjectOverview] Bắt đầu lấy thông tin tổng quan project với ID: " + projectId);

        // Tìm project theo ID
        Optional<ProjectEntity> projectOptional = projectRepository.findById(projectId);
        if (projectOptional.isEmpty()) {
            System.err.println("[getProjectOverview] Lỗi: Project không tồn tại với ID: " + projectId);
            throw new RuntimeException("Project không tồn tại với ID: " + projectId);
        }
        ProjectEntity project = projectOptional.get();
        System.out.println("[getProjectOverview] Tìm thấy project với tên: " + project.getProjectName());

        // Fetch các collections riêng biệt để tránh LazyInitializationException
        ProjectEntity projectWithDatabases = projectRepository.findByIdWithDatabases(projectId).orElse(project);
        ProjectEntity projectWithBackends = projectRepository.findByIdWithBackends(projectId).orElse(project);
        ProjectEntity projectWithFrontends = projectRepository.findByIdWithFrontends(projectId).orElse(project);

        // Tính toán stats cho databases
        List<ProjectDatabaseEntity> databases = projectWithDatabases.getDatabases() != null 
                ? projectWithDatabases.getDatabases() 
                : (project.getDatabases() != null ? project.getDatabases() : new java.util.ArrayList<>());
        
        ProjectOverviewResponse.ComponentStats databaseStats = new ProjectOverviewResponse.ComponentStats();
        databaseStats.setTotal(databases.size());
        databaseStats.setRunning((int) databases.stream().filter(db -> "RUNNING".equalsIgnoreCase(db.getStatus())).count());
        databaseStats.setPaused(0); // Paused không có trong database entity, có thể thêm sau
        databaseStats.setStopped((int) databases.stream().filter(db -> "STOPPED".equalsIgnoreCase(db.getStatus())).count());
        databaseStats.setError((int) databases.stream().filter(db -> "ERROR".equalsIgnoreCase(db.getStatus())).count());

        // Tính toán stats cho backends
        List<ProjectBackendEntity> backends = projectWithBackends.getBackends() != null 
                ? projectWithBackends.getBackends() 
                : (project.getBackends() != null ? project.getBackends() : new java.util.ArrayList<>());
        
        ProjectOverviewResponse.ComponentStats backendStats = new ProjectOverviewResponse.ComponentStats();
        backendStats.setTotal(backends.size());
        backendStats.setRunning((int) backends.stream().filter(be -> "RUNNING".equalsIgnoreCase(be.getStatus())).count());
        backendStats.setPaused(0); // Paused không có trong backend entity
        backendStats.setStopped((int) backends.stream().filter(be -> "STOPPED".equalsIgnoreCase(be.getStatus())).count());
        backendStats.setError((int) backends.stream().filter(be -> "ERROR".equalsIgnoreCase(be.getStatus())).count());

        // Tính toán stats cho frontends
        List<ProjectFrontendEntity> frontends = projectWithFrontends.getFrontends() != null 
                ? projectWithFrontends.getFrontends() 
                : (project.getFrontends() != null ? project.getFrontends() : new java.util.ArrayList<>());
        
        ProjectOverviewResponse.ComponentStats frontendStats = new ProjectOverviewResponse.ComponentStats();
        frontendStats.setTotal(frontends.size());
        frontendStats.setRunning((int) frontends.stream().filter(fe -> "RUNNING".equalsIgnoreCase(fe.getStatus())).count());
        frontendStats.setPaused(0); // Paused không có trong frontend entity
        frontendStats.setStopped((int) frontends.stream().filter(fe -> "STOPPED".equalsIgnoreCase(fe.getStatus())).count());
        frontendStats.setError((int) frontends.stream().filter(fe -> "ERROR".equalsIgnoreCase(fe.getStatus())).count());

        // Tạo response
        ProjectOverviewResponse response = new ProjectOverviewResponse();
        response.setId(project.getId());
        response.setProjectName(project.getProjectName());
        response.setDescription(project.getDescription());
        response.setCreatedAt(project.getCreatedAt());
        response.setUpdatedAt(project.getUpdatedAt() != null ? project.getUpdatedAt() : project.getCreatedAt());
        response.setUuid_k8s(project.getUuid_k8s());
        response.setNamespace(project.getNamespace());
        response.setDatabases(databaseStats);
        response.setBackends(backendStats);
        response.setFrontends(frontendStats);

        System.out.println("[getProjectOverview] Hoàn tất lấy thông tin tổng quan project: " + project.getProjectName() + 
                          ", databases: " + databaseStats.getTotal() + 
                          ", backends: " + backendStats.getTotal() + 
                          ", frontends: " + frontendStats.getTotal());
        return response;
    }

    @Override
    public ProjectDatabaseListResponse getProjectDatabases(Long projectId) {
        System.out.println("[getProjectDatabases] Bắt đầu lấy danh sách databases của project với ID: " + projectId);

        // Tìm project theo ID
        Optional<ProjectEntity> projectOptional = projectRepository.findById(projectId);
        if (projectOptional.isEmpty()) {
            System.err.println("[getProjectDatabases] Lỗi: Project không tồn tại với ID: " + projectId);
            throw new RuntimeException("Project không tồn tại với ID: " + projectId);
        }
        ProjectEntity project = projectOptional.get();
        System.out.println("[getProjectDatabases] Tìm thấy project với tên: " + project.getProjectName());

        // Fetch databases
        ProjectEntity projectWithDatabases = projectRepository.findByIdWithDatabases(projectId).orElse(project);
        List<ProjectDatabaseEntity> databases = projectWithDatabases.getDatabases() != null 
                ? projectWithDatabases.getDatabases() 
                : (project.getDatabases() != null ? project.getDatabases() : new java.util.ArrayList<>());

        // Lấy master server và tạo SSH session để lấy metrics từ Kubernetes
        Session session = null;
        try {
            ServerEntity masterServer = getMasterServer();
            session = createSession(masterServer);
        } catch (Exception e) {
            System.err.println("[getProjectDatabases] Không thể tạo SSH session để lấy metrics: " + e.getMessage());
            // Tiếp tục mà không có metrics
        }

        final Session finalSession = session;
        final String namespace = project.getNamespace();

        // Map databases sang DTO
        List<ProjectDatabaseListResponse.DatabaseInfo> databaseInfos = databases.stream()
                .map(db -> {
                    ProjectDatabaseListResponse.DatabaseInfo info = new ProjectDatabaseListResponse.DatabaseInfo();
                    info.setId(db.getId());
                    info.setProjectName(db.getProjectName());
                    info.setDescription(db.getDescription());
                    info.setDatabaseType(db.getDatabaseType());
                    info.setDatabaseIp(db.getDatabaseIp());
                    info.setDatabasePort(db.getDatabasePort());
                    info.setDatabaseName(db.getDatabaseName());
                    info.setDatabaseUsername(db.getDatabaseUsername());
                    info.setDatabasePassword(db.getDatabasePassword());
                    info.setStatus(db.getStatus());
                    info.setCreatedAt(db.getCreatedAt());

                    // Lấy CPU và Memory từ Kubernetes dựa vào uuid_k8s và namespace
                    if (finalSession != null && namespace != null && db.getUuid_k8s() != null && !db.getUuid_k8s().isEmpty()) {
                        try {
                            // Sử dụng cú pháp: kubectl top pod -n <namespace> | grep <db-uuid>
                            // Ví dụ: kubectl top pod -n ns-1b27c3a13de1 | grep db-0b007a05d0b0
                            String podNamePrefix = "db-" + db.getUuid_k8s();
                            String cmd = String.format("kubectl top pod -n %s | grep %s", namespace, podNamePrefix);
                            String output = executeCommand(finalSession, cmd, true);
                            
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
                                
                                info.setCpu(formatCpu(totalCpu));
                                info.setMemory(formatMemory(totalMemory));
                            } else {
                                info.setCpu("0m");
                                info.setMemory("0");
                            }
                        } catch (Exception e) {
                            System.err.println("[getProjectDatabases] Lỗi khi lấy metrics cho database " + db.getId() + ": " + e.getMessage());
                            info.setCpu("0m");
                            info.setMemory("0");
                        }
                    } else {
                        info.setCpu("0m");
                        info.setMemory("0");
                    }

                    return info;
                })
                .collect(Collectors.toList());

        // Đóng SSH session
        if (session != null && session.isConnected()) {
            session.disconnect();
        }

        // Tạo response
        ProjectDatabaseListResponse response = new ProjectDatabaseListResponse();
        response.setDatabases(databaseInfos);

        System.out.println("[getProjectDatabases] Hoàn tất lấy danh sách databases: " + databaseInfos.size() + " databases");
        return response;
    }

    @Override
    public ProjectBackendListResponse getProjectBackends(Long projectId) {
        System.out.println("[getProjectBackends] Bắt đầu lấy danh sách backends của project với ID: " + projectId);

        // Tìm project theo ID
        Optional<ProjectEntity> projectOptional = projectRepository.findById(projectId);
        if (projectOptional.isEmpty()) {
            System.err.println("[getProjectBackends] Lỗi: Project không tồn tại với ID: " + projectId);
            throw new RuntimeException("Project không tồn tại với ID: " + projectId);
        }
        ProjectEntity project = projectOptional.get();
        System.out.println("[getProjectBackends] Tìm thấy project với tên: " + project.getProjectName());

        // Fetch backends
        ProjectEntity projectWithBackends = projectRepository.findByIdWithBackends(projectId).orElse(project);
        List<ProjectBackendEntity> backends = projectWithBackends.getBackends() != null 
                ? projectWithBackends.getBackends() 
                : (project.getBackends() != null ? project.getBackends() : new java.util.ArrayList<>());

        // Lấy master server và tạo SSH session để lấy metrics từ Kubernetes
        Session session = null;
        try {
            ServerEntity masterServer = getMasterServer();
            session = createSession(masterServer);
        } catch (Exception e) {
            System.err.println("[getProjectBackends] Không thể tạo SSH session để lấy metrics: " + e.getMessage());
            // Tiếp tục mà không có metrics
        }

        final Session finalSession = session;
        final String namespace = project.getNamespace();

        // Map backends sang DTO
        List<ProjectBackendListResponse.BackendInfo> backendInfos = backends.stream()
                .map(be -> {
                    ProjectBackendListResponse.BackendInfo info = new ProjectBackendListResponse.BackendInfo();
                    info.setId(be.getId());
                    info.setProjectName(be.getProjectName());
                    info.setDescription(be.getDescription());
                    info.setDeploymentType(be.getDeploymentType());
                    info.setFrameworkType(be.getFrameworkType());
                    info.setDatabaseIp(be.getDatabaseIp());
                    info.setDatabasePort(be.getDatabasePort());
                    info.setDatabaseName(be.getDatabaseName());
                    info.setDatabaseUsername(be.getDatabaseUsername());
                    info.setDatabasePassword(be.getDatabasePassword());
                    info.setUuid_k8s(be.getUuid_k8s());
                    info.setSourcePath(be.getSourcePath());
                    info.setYamlPath(be.getYamlPath());
                    info.setDockerImage(be.getDockerImage());
                    info.setDomainNameSystem(be.getDomainNameSystem());
                    info.setStatus(be.getStatus());
                    info.setCreatedAt(be.getCreatedAt());

                    // Lấy CPU và Memory từ Kubernetes dựa vào uuid_k8s và namespace
                    if (finalSession != null && namespace != null && be.getUuid_k8s() != null && !be.getUuid_k8s().isEmpty()) {
                        try {
                            // Sử dụng cú pháp: kubectl top pod -n <namespace> | grep <app-uuid>
                            // Ví dụ: kubectl top pod -n ns-1b27c3a13de1 | grep app-0b007a05d0b0
                            String podNamePrefix = "app-" + be.getUuid_k8s();
                            String cmd = String.format("kubectl top pod -n %s | grep %s", namespace, podNamePrefix);
                            String output = executeCommand(finalSession, cmd, true);
                            
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
                                
                                info.setCpu(formatCpu(totalCpu));
                                info.setMemory(formatMemory(totalMemory));
                            } else {
                                info.setCpu("0m");
                                info.setMemory("0");
                            }
                        } catch (Exception e) {
                            System.err.println("[getProjectBackends] Lỗi khi lấy metrics cho backend " + be.getId() + ": " + e.getMessage());
                            info.setCpu("0m");
                            info.setMemory("0");
                        }
                    } else {
                        info.setCpu("0m");
                        info.setMemory("0");
                    }

                    return info;
                })
                .collect(Collectors.toList());

        // Đóng SSH session
        if (session != null && session.isConnected()) {
            session.disconnect();
        }

        // Tạo response
        ProjectBackendListResponse response = new ProjectBackendListResponse();
        response.setBackends(backendInfos);

        System.out.println("[getProjectBackends] Hoàn tất lấy danh sách backends: " + backendInfos.size() + " backends");
        return response;
    }

    @Override
    public ProjectFrontendListResponse getProjectFrontends(Long projectId) {
        System.out.println("[getProjectFrontends] Bắt đầu lấy danh sách frontends của project với ID: " + projectId);

        // Tìm project theo ID
        Optional<ProjectEntity> projectOptional = projectRepository.findById(projectId);
        if (projectOptional.isEmpty()) {
            System.err.println("[getProjectFrontends] Lỗi: Project không tồn tại với ID: " + projectId);
            throw new RuntimeException("Project không tồn tại với ID: " + projectId);
        }
        ProjectEntity project = projectOptional.get();
        System.out.println("[getProjectFrontends] Tìm thấy project với tên: " + project.getProjectName());

        // Fetch frontends
        ProjectEntity projectWithFrontends = projectRepository.findByIdWithFrontends(projectId).orElse(project);
        List<ProjectFrontendEntity> frontends = projectWithFrontends.getFrontends() != null 
                ? projectWithFrontends.getFrontends() 
                : (project.getFrontends() != null ? project.getFrontends() : new java.util.ArrayList<>());

        // Lấy master server và tạo SSH session để lấy metrics từ Kubernetes
        Session session = null;
        try {
            ServerEntity masterServer = getMasterServer();
            session = createSession(masterServer);
        } catch (Exception e) {
            System.err.println("[getProjectFrontends] Không thể tạo SSH session để lấy metrics: " + e.getMessage());
            // Tiếp tục mà không có metrics
        }

        final Session finalSession = session;
        final String namespace = project.getNamespace();

        // Map frontends sang DTO
        List<ProjectFrontendListResponse.FrontendInfo> frontendInfos = frontends.stream()
                .map(fe -> {
                    ProjectFrontendListResponse.FrontendInfo info = new ProjectFrontendListResponse.FrontendInfo();
                    info.setId(fe.getId());
                    info.setProjectName(fe.getProjectName());
                    info.setDescription(fe.getDescription());
                    info.setDeploymentType(fe.getDeploymentType());
                    info.setFrameworkType(fe.getFrameworkType());
                    info.setUuid_k8s(fe.getUuid_k8s());
                    info.setSourcePath(fe.getSourcePath());
                    info.setYamlPath(fe.getYamlPath());
                    info.setDockerImage(fe.getDockerImage());
                    info.setDomainNameSystem(fe.getDomainNameSystem());
                    info.setStatus(fe.getStatus());
                    info.setCreatedAt(fe.getCreatedAt());

                    // Lấy CPU và Memory từ Kubernetes dựa vào uuid_k8s và namespace
                    if (finalSession != null && namespace != null && fe.getUuid_k8s() != null && !fe.getUuid_k8s().isEmpty()) {
                        try {
                            // Sử dụng cú pháp: kubectl top pod -n <namespace> | grep <app-uuid>
                            // Ví dụ: kubectl top pod -n ns-1b27c3a13de1 | grep app-0b007a05d0b0
                            String podNamePrefix = "app-" + fe.getUuid_k8s();
                            String cmd = String.format("kubectl top pod -n %s | grep %s", namespace, podNamePrefix);
                            String output = executeCommand(finalSession, cmd, true);
                            
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
                                
                                info.setCpu(formatCpu(totalCpu));
                                info.setMemory(formatMemory(totalMemory));
                            } else {
                                info.setCpu("0m");
                                info.setMemory("0");
                            }
                        } catch (Exception e) {
                            System.err.println("[getProjectFrontends] Lỗi khi lấy metrics cho frontend " + fe.getId() + ": " + e.getMessage());
                            info.setCpu("0m");
                            info.setMemory("0");
                        }
                    } else {
                        info.setCpu("0m");
                        info.setMemory("0");
                    }

                    return info;
                })
                .collect(Collectors.toList());

        // Đóng SSH session
        if (session != null && session.isConnected()) {
            session.disconnect();
        }

        // Tạo response
        ProjectFrontendListResponse response = new ProjectFrontendListResponse();
        response.setFrontends(frontendInfos);

        System.out.println("[getProjectFrontends] Hoàn tất lấy danh sách frontends: " + frontendInfos.size() + " frontends");
        return response;
    }

    @Override
    public void deleteProject(Long projectId, String username) {
        System.out.println("[deleteProject] Bắt đầu xóa project với ID: " + projectId + " cho user: " + username);

        // Tìm user theo username
        Optional<UserEntity> userOptional = userRepository.findByUsername(username);
        if (userOptional.isEmpty()) {
            System.err.println("[deleteProject] Lỗi: User không tồn tại với username: " + username);
            throw new RuntimeException("User không tồn tại với username: " + username);
        }
        UserEntity user = userOptional.get();
        System.out.println("[deleteProject] Tìm thấy user với ID: " + user.getId());

        // Tìm project theo ID
        Optional<ProjectEntity> projectOptional = projectRepository.findById(projectId);
        if (projectOptional.isEmpty()) {
            System.err.println("[deleteProject] Lỗi: Project không tồn tại với ID: " + projectId);
            throw new RuntimeException("Project không tồn tại với ID: " + projectId);
        }
        ProjectEntity project = projectOptional.get();
        System.out.println("[deleteProject] Tìm thấy project với tên: " + project.getProjectName());

        // Validate project thuộc về user
        if (project.getUser() == null || !project.getUser().getId().equals(user.getId())) {
            System.err.println("[deleteProject] Lỗi: Project không thuộc về user này. Project user ID: " + 
                              (project.getUser() != null ? project.getUser().getId() : "null") + 
                              ", Request user ID: " + user.getId());
            throw new RuntimeException("Bạn không có quyền xóa project này");
        }

        // Lấy thông tin cần thiết trước khi xóa project
        String namespace = project.getNamespace();
        String uuidK8s = project.getUuid_k8s();
        String projectOwnerUsername = project.getUser() != null ? project.getUser().getUsername() : null;

        // Xóa namespace trong Kubernetes trước
        if (namespace != null && !namespace.trim().isEmpty()) {
            try {
                deleteProjectNamespace(namespace);
                System.out.println("[deleteProject] Đã xóa namespace trong Kubernetes: " + namespace);
            } catch (Exception e) {
                System.err.println("[deleteProject] Lỗi khi xóa namespace trong Kubernetes: " + e.getMessage());
                // Vẫn tiếp tục xóa project trong database ngay cả khi xóa namespace thất bại
                System.err.println("[deleteProject] Tiếp tục xóa project trong database...");
            }
        }

        // Xóa thư mục project trên server
        if (uuidK8s != null && !uuidK8s.trim().isEmpty() && projectOwnerUsername != null && !projectOwnerUsername.trim().isEmpty()) {
            try {
                deleteProjectDirectory(projectOwnerUsername, uuidK8s);
                System.out.println("[deleteProject] Đã xóa thư mục project trên server");
            } catch (Exception e) {
                System.err.println("[deleteProject] Lỗi khi xóa thư mục project trên server: " + e.getMessage());
                // Vẫn tiếp tục xóa project trong database ngay cả khi xóa thư mục thất bại
                System.err.println("[deleteProject] Tiếp tục xóa project trong database...");
            }
        }

        // Xóa project (cascade sẽ xóa các databases, backends, frontends liên quan)
        projectRepository.delete(project);
        System.out.println("[deleteProject] Đã xóa project thành công: " + project.getProjectName());
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
     * Tạo namespace trong Kubernetes cluster
     * 
     * @param namespace Tên namespace cần tạo
     * @throws Exception Nếu có lỗi khi tạo namespace
     */
    private void createProjectNamespace(String namespace) throws Exception {
        if (namespace == null || namespace.trim().isEmpty()) {
            System.out.println("[createProjectNamespace] Namespace trống, bỏ qua tạo namespace");
            return;
        }

        // Lấy thông tin MASTER server (Kubernetes cluster)
        Optional<ServerEntity> masterServerOptional = serverRepository.findByRole("MASTER");
        if (masterServerOptional.isEmpty()) {
            System.err.println("[createProjectNamespace] Không tìm thấy server MASTER. Không thể tạo namespace trong Kubernetes.");
            throw new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống.");
        }

        ServerEntity masterServer = masterServerOptional.get();
        Session clusterSession = null;

        try {
            // Kết nối SSH tới MASTER server
            JSch jsch = new JSch();
            clusterSession = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
            clusterSession.setPassword(masterServer.getPassword());
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            clusterSession.setConfig(config);
            clusterSession.setTimeout(7000);
            clusterSession.connect();
            System.out.println("[createProjectNamespace] Đã kết nối tới MASTER server");

            // Sử dụng method createKubernetesClient từ parent class (đã xử lý thay thế server URL)
            ApiClient client = createKubernetesClient(clusterSession);
            CoreV1Api api = new CoreV1Api();
            
            // Kiểm tra namespace đã tồn tại chưa
            try {
                V1Namespace ns = api.readNamespace(namespace, null);
                System.out.println("[createProjectNamespace] Namespace đã tồn tại: " + namespace + " (Status: " + 
                    (ns.getStatus() != null && ns.getStatus().getPhase() != null ? ns.getStatus().getPhase() : "Unknown") + ")");
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    // Namespace chưa tồn tại, tạo mới
                    System.out.println("[createProjectNamespace] Namespace chưa tồn tại, đang tạo mới: " + namespace);
                    V1Namespace newNamespace = new V1Namespace();
                    V1ObjectMeta metadata = new V1ObjectMeta();
                    metadata.setName(namespace);
                    newNamespace.setMetadata(metadata);
                    
                    V1Namespace createdNamespace = api.createNamespace(newNamespace, null, null, null, null);
                    System.out.println("[createProjectNamespace] Đã tạo namespace thành công: " + namespace);
                } else {
                    System.err.println("[createProjectNamespace] Lỗi API khi kiểm tra namespace. Code: " + e.getCode() + ", Message: " + e.getMessage());
                    throw new RuntimeException("Lỗi khi kiểm tra namespace: " + e.getMessage(), e);
                }
            }
            
        } catch (Exception e) {
            System.err.println("[createProjectNamespace] Lỗi khi tạo namespace: " + e.getMessage());
            throw new RuntimeException("Không thể tạo namespace trong Kubernetes: " + e.getMessage(), e);
        } finally {
            if (clusterSession != null && clusterSession.isConnected()) {
                clusterSession.disconnect();
            }
        }
    }

    /**
     * Xóa namespace trong Kubernetes cluster
     * 
     * @param namespace Tên namespace cần xóa
     * @throws Exception Nếu có lỗi khi xóa namespace
     */
    private void deleteProjectNamespace(String namespace) throws Exception {
        if (namespace == null || namespace.trim().isEmpty()) {
            System.out.println("[deleteProjectNamespace] Namespace trống, bỏ qua xóa namespace");
            return;
        }

        // Lấy thông tin MASTER server (Kubernetes cluster)
        Optional<ServerEntity> masterServerOptional = serverRepository.findByRole("MASTER");
        if (masterServerOptional.isEmpty()) {
            System.err.println("[deleteProjectNamespace] Không tìm thấy server MASTER. Không thể xóa namespace trong Kubernetes.");
            throw new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống.");
        }

        ServerEntity masterServer = masterServerOptional.get();
        Session clusterSession = null;

        try {
            // Kết nối SSH tới MASTER server
            JSch jsch = new JSch();
            clusterSession = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
            clusterSession.setPassword(masterServer.getPassword());
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            clusterSession.setConfig(config);
            clusterSession.setTimeout(7000);
            clusterSession.connect();
            System.out.println("[deleteProjectNamespace] Đã kết nối tới MASTER server");

            // Xóa namespace bằng kubectl
            String deleteNamespaceCmd = String.format("kubectl delete ns %s || true", namespace);
            System.out.println("[deleteProjectNamespace] Thực thi lệnh: " + deleteNamespaceCmd);
            String result = executeCommand(clusterSession, deleteNamespaceCmd, true);
            System.out.println("[deleteProjectNamespace] Kết quả xóa namespace: " + result);
            
        } catch (Exception e) {
            System.err.println("[deleteProjectNamespace] Lỗi khi xóa namespace: " + e.getMessage());
            throw new RuntimeException("Không thể xóa namespace trong Kubernetes: " + e.getMessage(), e);
        } finally {
            if (clusterSession != null && clusterSession.isConnected()) {
                clusterSession.disconnect();
            }
        }
    }

    /**
     * Xóa thư mục project trên server
     * Thư mục có format: /home/<master_username>/uploads/<username>/<uuid_k8s>
     * 
     * @param username Username của user sở hữu project
     * @param uuidK8s UUID của project trong Kubernetes
     * @throws Exception Nếu có lỗi khi xóa thư mục
     */
    private void deleteProjectDirectory(String username, String uuidK8s) throws Exception {
        if (username == null || username.trim().isEmpty()) {
            System.out.println("[deleteProjectDirectory] Username trống, bỏ qua xóa thư mục");
            return;
        }
        if (uuidK8s == null || uuidK8s.trim().isEmpty()) {
            System.out.println("[deleteProjectDirectory] UUID trống, bỏ qua xóa thư mục");
            return;
        }

        // Lấy thông tin MASTER server
        Optional<ServerEntity> masterServerOptional = serverRepository.findByRole("MASTER");
        if (masterServerOptional.isEmpty()) {
            System.err.println("[deleteProjectDirectory] Không tìm thấy server MASTER. Không thể xóa thư mục project.");
            throw new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống.");
        }

        ServerEntity masterServer = masterServerOptional.get();
        Session clusterSession = null;

        try {
            // Kết nối SSH tới MASTER server
            JSch jsch = new JSch();
            clusterSession = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
            clusterSession.setPassword(masterServer.getPassword());
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            clusterSession.setConfig(config);
            clusterSession.setTimeout(7000);
            clusterSession.connect();
            System.out.println("[deleteProjectDirectory] Đã kết nối tới MASTER server");

            // Xác định đường dẫn thư mục project: /home/<master_username>/uploads/<username>/<uuid_k8s>
            String projectDir = String.format("/home/%s/uploads/%s/%s", 
                    masterServer.getUsername(), 
                    username, 
                    uuidK8s);
            
            // Xóa thư mục project và tất cả nội dung bên trong
            String deleteDirCmd = String.format("rm -rf '%s'", escapeSingleQuotes(projectDir));
            System.out.println("[deleteProjectDirectory] Thực thi lệnh: " + deleteDirCmd);
            String result = executeCommand(clusterSession, deleteDirCmd, true);
            System.out.println("[deleteProjectDirectory] Kết quả xóa thư mục: " + result);
            
        } catch (Exception e) {
            System.err.println("[deleteProjectDirectory] Lỗi khi xóa thư mục project: " + e.getMessage());
            throw new RuntimeException("Không thể xóa thư mục project trên server: " + e.getMessage(), e);
        } finally {
            if (clusterSession != null && clusterSession.isConnected()) {
                clusterSession.disconnect();
            }
        }
    }

    /**
     * Helper method để escape single quotes trong shell command
     * 
     * @param input Chuỗi cần escape
     * @return Chuỗi đã escape
     */
    private String escapeSingleQuotes(String input) {
        return input.replace("'", "'\"'\"'");
    }

    /**
     * Helper method để thực thi lệnh qua SSH (tương thích với code cũ)
     * Gọi method từ parent class với ignoreNonZeroExit = false
     */
    private String executeCommand(Session session, String command) throws Exception {
        return executeCommand(session, command, false);
    }

    /**
     * Format CPU cores thành string (ví dụ: "100m", "1.5")
     */
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

    /**
     * Format memory bytes thành string (ví dụ: "256Mi", "1Gi")
     */
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

    /**
     * Lấy master server từ database
     */
    private ServerEntity getMasterServer() {
        Optional<ServerEntity> masterServerOptional = serverRepository.findByRole("MASTER");
        if (masterServerOptional.isEmpty()) {
            throw new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống.");
        }
        return masterServerOptional.get();
    }

    @Override
    public ProjectDeploymentHistoryResponse getProjectDeploymentHistory(Long projectId) {
        System.out.println("[getProjectDeploymentHistory] Bắt đầu lấy lịch sử triển khai project với ID: " + projectId);

        // Tìm project theo ID
        Optional<ProjectEntity> projectOptional = projectRepository.findById(projectId);
        if (projectOptional.isEmpty()) {
            System.err.println("[getProjectDeploymentHistory] Lỗi: Project không tồn tại với ID: " + projectId);
            throw new RuntimeException("Project không tồn tại với ID: " + projectId);
        }
        ProjectEntity project = projectOptional.get();
        System.out.println("[getProjectDeploymentHistory] Tìm thấy project với tên: " + project.getProjectName());

        // Fetch các collections riêng biệt để tránh LazyInitializationException
        ProjectEntity projectWithDatabases = projectRepository.findByIdWithDatabases(projectId).orElse(project);
        ProjectEntity projectWithBackends = projectRepository.findByIdWithBackends(projectId).orElse(project);
        ProjectEntity projectWithFrontends = projectRepository.findByIdWithFrontends(projectId).orElse(project);

        // Tạo danh sách lịch sử triển khai
        List<ProjectDeploymentHistoryResponse.DeploymentHistoryItem> historyItems = new java.util.ArrayList<>();

        // Thêm project vào đầu danh sách
        ProjectDeploymentHistoryResponse.DeploymentHistoryItem projectItem = new ProjectDeploymentHistoryResponse.DeploymentHistoryItem();
        projectItem.setType("PROJECT");
        projectItem.setId(project.getId());
        projectItem.setName(project.getProjectName());
        projectItem.setDescription(project.getDescription());
        projectItem.setCreatedAt(project.getCreatedAt());
        historyItems.add(projectItem);

        // Thêm databases
        List<ProjectDatabaseEntity> databases = projectWithDatabases.getDatabases() != null 
                ? projectWithDatabases.getDatabases() 
                : (project.getDatabases() != null ? project.getDatabases() : new java.util.ArrayList<>());
        
        for (ProjectDatabaseEntity db : databases) {
            ProjectDeploymentHistoryResponse.DeploymentHistoryItem dbItem = new ProjectDeploymentHistoryResponse.DeploymentHistoryItem();
            dbItem.setType("DATABASE");
            dbItem.setId(db.getId());
            dbItem.setName(db.getProjectName());
            dbItem.setDescription(db.getDescription());
            dbItem.setCreatedAt(db.getCreatedAt());
            dbItem.setDatabaseType(db.getDatabaseType());
            historyItems.add(dbItem);
        }

        // Thêm backends
        List<ProjectBackendEntity> backends = projectWithBackends.getBackends() != null 
                ? projectWithBackends.getBackends() 
                : (project.getBackends() != null ? project.getBackends() : new java.util.ArrayList<>());
        
        for (ProjectBackendEntity be : backends) {
            ProjectDeploymentHistoryResponse.DeploymentHistoryItem beItem = new ProjectDeploymentHistoryResponse.DeploymentHistoryItem();
            beItem.setType("BACKEND");
            beItem.setId(be.getId());
            beItem.setName(be.getProjectName());
            beItem.setDescription(be.getDescription());
            beItem.setCreatedAt(be.getCreatedAt());
            beItem.setFrameworkType(be.getFrameworkType());
            beItem.setDeploymentType(be.getDeploymentType());
            historyItems.add(beItem);
        }

        // Thêm frontends
        List<ProjectFrontendEntity> frontends = projectWithFrontends.getFrontends() != null 
                ? projectWithFrontends.getFrontends() 
                : (project.getFrontends() != null ? project.getFrontends() : new java.util.ArrayList<>());
        
        for (ProjectFrontendEntity fe : frontends) {
            ProjectDeploymentHistoryResponse.DeploymentHistoryItem feItem = new ProjectDeploymentHistoryResponse.DeploymentHistoryItem();
            feItem.setType("FRONTEND");
            feItem.setId(fe.getId());
            feItem.setName(fe.getProjectName());
            feItem.setDescription(fe.getDescription());
            feItem.setCreatedAt(fe.getCreatedAt());
            feItem.setFrameworkType(fe.getFrameworkType());
            feItem.setDeploymentType(fe.getDeploymentType());
            historyItems.add(feItem);
        }

        // Sắp xếp theo thời gian tạo (từ mới nhất đến cũ nhất)
        historyItems.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));

        // Tạo response
        ProjectDeploymentHistoryResponse response = new ProjectDeploymentHistoryResponse();
        response.setProjectId(project.getId());
        response.setProjectName(project.getProjectName());
        response.setProjectCreatedAt(project.getCreatedAt());
        response.setHistoryItems(historyItems);

        System.out.println("[getProjectDeploymentHistory] Hoàn tất lấy lịch sử triển khai: " + historyItems.size() + " items");
        return response;
    }
    
    @Override
    public ProjectRequestHistoryResponse getProjectRequestHistory(Long projectId) {
        System.out.println("[getProjectRequestHistory] Bắt đầu lấy lịch sử yêu cầu project với ID: " + projectId);
        
        // Tìm project theo ID
        Optional<ProjectEntity> projectOptional = projectRepository.findById(projectId);
        if (projectOptional.isEmpty()) {
            System.err.println("[getProjectRequestHistory] Lỗi: Project không tồn tại với ID: " + projectId);
            throw new RuntimeException("Project không tồn tại với ID: " + projectId);
        }
        ProjectEntity project = projectOptional.get();
        System.out.println("[getProjectRequestHistory] Tìm thấy project với tên: " + project.getProjectName());
        
        // Lấy tất cả backend requests của project
        List<BackendRequestEntity> backendRequests = backendRequestRepository.findAllByBackend_Project_IdOrderByCreatedAtDesc(projectId);
        System.out.println("[getProjectRequestHistory] Tìm thấy " + backendRequests.size() + " backend requests");
        
        // Lấy tất cả frontend requests của project
        List<FrontendRequestEntity> frontendRequests = frontendRequestRepository.findAllByFrontend_Project_IdOrderByCreatedAtDesc(projectId);
        System.out.println("[getProjectRequestHistory] Tìm thấy " + frontendRequests.size() + " frontend requests");
        
        // Tạo danh sách lịch sử yêu cầu
        List<ProjectRequestHistoryResponse.RequestHistoryItem> requestItems = new java.util.ArrayList<>();
        
        // Thêm backend requests
        for (BackendRequestEntity br : backendRequests) {
            ProjectRequestHistoryResponse.RequestHistoryItem item = new ProjectRequestHistoryResponse.RequestHistoryItem();
            item.setType("BACKEND");
            item.setId(br.getId());
            item.setComponentId(br.getBackend().getId());
            item.setComponentName(br.getBackend().getProjectName());
            item.setOldReplicas(br.getOldReplicas());
            item.setNewReplicas(br.getNewReplicas());
            item.setStatus(br.getStatus());
            item.setReasonReject(br.getReasonReject());
            item.setCreatedAt(br.getCreatedAt());
            requestItems.add(item);
        }
        
        // Thêm frontend requests
        for (FrontendRequestEntity fr : frontendRequests) {
            ProjectRequestHistoryResponse.RequestHistoryItem item = new ProjectRequestHistoryResponse.RequestHistoryItem();
            item.setType("FRONTEND");
            item.setId(fr.getId());
            item.setComponentId(fr.getFrontend().getId());
            item.setComponentName(fr.getFrontend().getProjectName());
            item.setOldReplicas(fr.getOldReplicas());
            item.setNewReplicas(fr.getNewReplicas());
            item.setStatus(fr.getStatus());
            item.setReasonReject(fr.getReasonReject());
            item.setCreatedAt(fr.getCreatedAt());
            requestItems.add(item);
        }
        
        // Sắp xếp theo thời gian tạo (từ mới nhất đến cũ nhất)
        requestItems.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        
        // Tạo response
        ProjectRequestHistoryResponse response = new ProjectRequestHistoryResponse();
        response.setProjectId(project.getId());
        response.setProjectName(project.getProjectName());
        response.setRequestItems(requestItems);
        
        System.out.println("[getProjectRequestHistory] Hoàn tất lấy lịch sử yêu cầu: " + requestItems.size() + " items");
        return response;
    }
}

