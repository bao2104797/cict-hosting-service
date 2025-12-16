package my_spring_app.my_spring_app.service.impl;

import my_spring_app.my_spring_app.dto.reponse.CreateUserResponse;
import my_spring_app.my_spring_app.dto.reponse.LoginResponse;
import my_spring_app.my_spring_app.dto.reponse.UserSummaryResponse;
import my_spring_app.my_spring_app.dto.request.CreateUserRequest;
import my_spring_app.my_spring_app.dto.request.LoginRequest;
import my_spring_app.my_spring_app.dto.request.ResetPasswordRequest;
import my_spring_app.my_spring_app.dto.request.UpdateUserRequest;
import my_spring_app.my_spring_app.entity.UserEntity;
import com.jcraft.jsch.Session;
import my_spring_app.my_spring_app.entity.ProjectEntity;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.repository.ProjectBackendRepository;
import my_spring_app.my_spring_app.repository.ProjectDatabaseRepository;
import my_spring_app.my_spring_app.repository.ProjectFrontendRepository;
import my_spring_app.my_spring_app.repository.ProjectRepository;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.repository.UserRepository;
import my_spring_app.my_spring_app.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class UserServiceImpl extends BaseKubernetesService implements UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectBackendRepository projectBackendRepository;

    @Autowired
    private ProjectFrontendRepository projectFrontendRepository;

    @Autowired
    private ProjectDatabaseRepository projectDatabaseRepository;

    @Autowired
    private ServerRepository serverRepository;

    @Override
    public CreateUserResponse createUser(CreateUserRequest request) {
        System.out.println("[createUser] Bắt đầu tạo user mới với username: " + request.getUsername());
        
        // Kiểm tra password và confirmPassword có khớp nhau không
        System.out.println("[createUser] Kiểm tra password và confirmPassword có khớp nhau không");
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            System.err.println("[createUser] Lỗi: Mật khẩu xác nhận không khớp");
            throw new RuntimeException("Mật khẩu xác nhận không khớp");
        }
        System.out.println("[createUser] Password và confirmPassword khớp nhau");

        // Kiểm tra username đã tồn tại chưa
        System.out.println("[createUser] Kiểm tra username đã tồn tại chưa: " + request.getUsername());
        if (userRepository.existsByUsername(request.getUsername())) {
            System.err.println("[createUser] Lỗi: Username đã tồn tại: " + request.getUsername());
            throw new RuntimeException("Username đã tồn tại");
        }
        System.out.println("[createUser] Username chưa tồn tại, có thể tạo user mới");

        // Validate tier nếu có
        String tier = request.getTier();
        if (tier != null && !tier.trim().isEmpty()) {
            tier = tier.toUpperCase();
            if (!"STANDARD".equals(tier) && !"PREMIUM".equals(tier)) {
                System.err.println("[createUser] Lỗi: Tier không hợp lệ: " + tier);
                throw new RuntimeException("Tier không hợp lệ. Chỉ hỗ trợ STANDARD hoặc PREMIUM");
            }
        } else {
            // Mặc định là STANDARD nếu không cung cấp
            tier = "STANDARD";
        }

        // Validate role nếu có
        String role = request.getRole();
        if (role != null && !role.trim().isEmpty()) {
            role = role.toUpperCase();
            if (!"ADMIN".equals(role) && !"USER".equals(role)) {
                System.err.println("[createUser] Lỗi: Role không hợp lệ: " + role);
                throw new RuntimeException("Role không hợp lệ. Chỉ hỗ trợ ADMIN hoặc USER");
            }
        } else {
            // Mặc định là USER nếu không cung cấp
            role = "USER";
        }

        // Tạo user mới
        System.out.println("[createUser] Tạo UserEntity mới");
        UserEntity userEntity = new UserEntity();
        userEntity.setFullname(request.getFullname());
        userEntity.setUsername(request.getUsername());
        userEntity.setPassword(passwordEncoder.encode(request.getPassword()));
        userEntity.setStatus("ACTIVE");
        userEntity.setRole(role);
        userEntity.setTier(tier);
        System.out.println("[createUser] Đã thiết lập thông tin user: fullname=" + request.getFullname() + ", username=" + request.getUsername() + ", role=" + role + ", status=ACTIVE, tier=" + tier);

        // Lưu vào database
        System.out.println("[createUser] Lưu user vào database");
        UserEntity savedUserEntity = userRepository.save(userEntity);
        System.out.println("[createUser] Đã lưu user thành công với ID: " + savedUserEntity.getId());

        // Chuyển đổi sang UserResponse
        System.out.println("[createUser] Chuyển đổi sang CreateUserResponse");
        CreateUserResponse response = new CreateUserResponse();
        response.setId(savedUserEntity.getId());
        response.setFullname(savedUserEntity.getFullname());
        response.setUsername(savedUserEntity.getUsername());
        response.setStatus(savedUserEntity.getStatus());
        response.setRole(savedUserEntity.getRole());
        response.setTier(savedUserEntity.getTier());

        System.out.println("[createUser] Hoàn tất tạo user thành công: username=" + savedUserEntity.getUsername() + ", id=" + savedUserEntity.getId());
        return response;
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        System.out.println("[login] Bắt đầu đăng nhập với username: " + request.getUsername());
        
        // Tìm user theo username
        System.out.println("[login] Tìm user theo username: " + request.getUsername());
        Optional<UserEntity> userOptional = userRepository.findByUsername(request.getUsername());
        
        if (userOptional.isEmpty()) {
            System.err.println("[login] Lỗi: Không tìm thấy user với username: " + request.getUsername());
            throw new RuntimeException("Username hoặc password không đúng");
        }

        UserEntity userEntity = userOptional.get();
        System.out.println("[login] Tìm thấy user với ID: " + userEntity.getId());

        // Kiểm tra password
        System.out.println("[login] Kiểm tra password");
        if (!passwordEncoder.matches(request.getPassword(), userEntity.getPassword())) {
            System.err.println("[login] Lỗi: Password không đúng cho username: " + request.getUsername());
            throw new RuntimeException("Username hoặc password không đúng");
        }
        System.out.println("[login] Password đúng");

        // Kiểm tra status
        System.out.println("[login] Kiểm tra status của user: " + userEntity.getStatus());
        if (!"ACTIVE".equalsIgnoreCase(userEntity.getStatus())) {
            System.err.println("[login] Lỗi: Tài khoản đã bị vô hiệu hóa với status: " + userEntity.getStatus());
            throw new RuntimeException("Tài khoản đã bị vô hiệu hóa");
        }
        System.out.println("[login] User có status ACTIVE, cho phép đăng nhập");

        // Tạo response
        System.out.println("[login] Tạo LoginResponse");
        LoginResponse response = new LoginResponse();
        response.setFullname(userEntity.getFullname());
        response.setUsername(userEntity.getUsername());
        response.setRole(userEntity.getRole());
        response.setTier(userEntity.getTier());

        System.out.println("[login] Hoàn tất đăng nhập thành công: username=" + userEntity.getUsername() + ", role=" + userEntity.getRole());
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserSummaryResponse> getAllUsers() {
        List<UserEntity> users = userRepository.findAll();
        return users.stream()
                .map(this::mapToUserSummary)
                .collect(Collectors.toList());
    }

    private UserSummaryResponse mapToUserSummary(UserEntity userEntity) {
        long projectCount = projectRepository.countByUser(userEntity);
        long backendCount = projectBackendRepository.countByProject_User(userEntity);
        long frontendCount = projectFrontendRepository.countByProject_User(userEntity);
        long databaseCount = projectDatabaseRepository.countByProject_User(userEntity);
        long serviceCount = backendCount + frontendCount + databaseCount;

        String normalizedTier = normalizeToLowercase(userEntity.getTier(), "standard");
        String normalizedStatus = normalizeToLowercase(userEntity.getStatus(), "inactive");

        UserSummaryResponse response = new UserSummaryResponse();
        response.setId(userEntity.getId());
        response.setName(userEntity.getFullname());
        response.setUsername(userEntity.getUsername());
        response.setEmail(null);
        response.setRole(userEntity.getRole());
        response.setTier(normalizedTier);
        response.setStatus(normalizedStatus);
        response.setProjectCount(projectCount);
        response.setServices(serviceCount);
        response.setCreatedAt(userEntity.getCreatedAt());
        response.setLastLogin(null);
        return response;
    }

    private String normalizeToLowercase(String value, String fallback) {
        if (value == null || value.trim().isEmpty()) {
            return fallback;
        }
        return value.trim().toLowerCase();
    }

    @Override
    public void deleteUser(Long userId, String currentUsername) {
        System.out.println("[deleteUser] Bắt đầu xóa user với ID: " + userId + ", username đang đăng nhập: " + currentUsername);

        // Tìm user đang đăng nhập bằng username
        System.out.println("[deleteUser] Tìm user đang đăng nhập với username: " + currentUsername);
        Optional<UserEntity> currentUserOptional = userRepository.findByUsername(currentUsername);
        
        if (currentUserOptional.isEmpty()) {
            System.err.println("[deleteUser] Lỗi: Không tìm thấy user đang đăng nhập với username: " + currentUsername);
            throw new RuntimeException("Không tìm thấy tài khoản đang đăng nhập");
        }

        UserEntity currentUser = currentUserOptional.get();
        System.out.println("[deleteUser] Tìm thấy user đang đăng nhập với ID: " + currentUser.getId());

        // Kiểm tra xem id tài khoản đang đăng nhập có trùng với id tài khoản bị xóa không
        if (currentUser.getId().equals(userId)) {
            System.err.println("[deleteUser] Lỗi: Không thể xóa tài khoản đang đăng nhập. ID: " + userId);
            throw new RuntimeException("Không thể xóa tài khoản đang đăng nhập");
        }

        System.out.println("[deleteUser] ID tài khoản đang đăng nhập (" + currentUser.getId() + ") khác với ID tài khoản bị xóa (" + userId + "), cho phép xóa");

        // Kiểm tra tài khoản cần xóa có tồn tại không
        System.out.println("[deleteUser] Kiểm tra tài khoản cần xóa có tồn tại không với ID: " + userId);
        Optional<UserEntity> userToDeleteOptional = userRepository.findById(userId);
        
        if (userToDeleteOptional.isEmpty()) {
            System.err.println("[deleteUser] Lỗi: Không tìm thấy tài khoản cần xóa với ID: " + userId);
            throw new RuntimeException("Không tìm thấy tài khoản cần xóa");
        }

        UserEntity userToDelete = userToDeleteOptional.get();
        System.out.println("[deleteUser] Tìm thấy tài khoản cần xóa: username=" + userToDelete.getUsername() + ", ID=" + userToDelete.getId());

        // Lấy tất cả projects của user
        System.out.println("[deleteUser] Lấy tất cả projects của user với ID: " + userId);
        List<ProjectEntity> userProjects = projectRepository.findByUser(userToDelete);
        System.out.println("[deleteUser] Tìm thấy " + userProjects.size() + " projects của user");

        // Xóa namespace trong Kubernetes cho mỗi project
        for (ProjectEntity project : userProjects) {
            String namespace = project.getNamespace();
            if (namespace != null && !namespace.trim().isEmpty()) {
                try {
                    System.out.println("[deleteUser] Xóa namespace trong Kubernetes: " + namespace);
                    deleteProjectNamespace(namespace);
                    System.out.println("[deleteUser] Đã xóa namespace thành công: " + namespace);
                } catch (Exception e) {
                    System.err.println("[deleteUser] Lỗi khi xóa namespace " + namespace + ": " + e.getMessage());
                    // Tiếp tục xóa các namespace khác và project trong database ngay cả khi xóa namespace thất bại
                    System.err.println("[deleteUser] Tiếp tục xóa các project khác...");
                }
            }
        }

        // Xóa tất cả projects (cascade sẽ tự động xóa databases, backends, frontends)
        System.out.println("[deleteUser] Xóa tất cả projects của user");
        for (ProjectEntity project : userProjects) {
            projectRepository.delete(project);
            System.out.println("[deleteUser] Đã xóa project: " + project.getProjectName());
        }

        // Xóa tài khoản
        System.out.println("[deleteUser] Xóa tài khoản với ID: " + userId);
        userRepository.deleteById(userId);
        System.out.println("[deleteUser] Đã xóa tài khoản thành công với ID: " + userId);
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
            clusterSession = createSession(masterServer);
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

    @Override
    public UserSummaryResponse updateUser(Long userId, UpdateUserRequest request) {
        System.out.println("[updateUser] Bắt đầu cập nhật user với ID: " + userId);

        // Tìm user cần cập nhật
        System.out.println("[updateUser] Tìm user với ID: " + userId);
        Optional<UserEntity> userOptional = userRepository.findById(userId);

        if (userOptional.isEmpty()) {
            System.err.println("[updateUser] Lỗi: Không tìm thấy user với ID: " + userId);
            throw new RuntimeException("Không tìm thấy tài khoản cần cập nhật");
        }

        UserEntity userEntity = userOptional.get();
        System.out.println("[updateUser] Tìm thấy user: username=" + userEntity.getUsername());

        // Cập nhật fullname nếu có
        if (request.getFullname() != null && !request.getFullname().trim().isEmpty()) {
            String newFullname = request.getFullname().trim();
            if (newFullname.length() < 2 || newFullname.length() > 100) {
                System.err.println("[updateUser] Lỗi: Fullname không hợp lệ: " + newFullname);
                throw new RuntimeException("Fullname phải có từ 2 đến 100 ký tự");
            }
            System.out.println("[updateUser] Cập nhật fullname từ '" + userEntity.getFullname() + "' thành '" + newFullname + "'");
            userEntity.setFullname(newFullname);
        }

        // Cập nhật tier nếu có
        if (request.getTier() != null && !request.getTier().trim().isEmpty()) {
            String tier = request.getTier().toUpperCase();
            if (!"STANDARD".equals(tier) && !"PREMIUM".equals(tier)) {
                System.err.println("[updateUser] Lỗi: Tier không hợp lệ: " + tier);
                throw new RuntimeException("Tier không hợp lệ. Chỉ hỗ trợ STANDARD hoặc PREMIUM");
            }
            System.out.println("[updateUser] Cập nhật tier từ '" + userEntity.getTier() + "' thành '" + tier + "'");
            userEntity.setTier(tier);
        }

        // Cập nhật role nếu có
        if (request.getRole() != null && !request.getRole().trim().isEmpty()) {
            String role = request.getRole().toUpperCase();
            if (!"ADMIN".equals(role) && !"USER".equals(role)) {
                System.err.println("[updateUser] Lỗi: Role không hợp lệ: " + role);
                throw new RuntimeException("Role không hợp lệ. Chỉ hỗ trợ ADMIN hoặc USER");
            }
            System.out.println("[updateUser] Cập nhật role từ '" + userEntity.getRole() + "' thành '" + role + "'");
            userEntity.setRole(role);
        }

        // Lưu thay đổi
        System.out.println("[updateUser] Lưu thay đổi vào database");
        UserEntity updatedUser = userRepository.save(userEntity);
        System.out.println("[updateUser] Đã cập nhật user thành công với ID: " + updatedUser.getId());

        // Chuyển đổi sang UserSummaryResponse
        return mapToUserSummary(updatedUser);
    }

    @Override
    public void resetPassword(Long userId, ResetPasswordRequest request) {
        System.out.println("[resetPassword] Bắt đầu reset password cho user với ID: " + userId);

        // Kiểm tra password và confirmPassword có khớp nhau không
        System.out.println("[resetPassword] Kiểm tra password và confirmPassword có khớp nhau không");
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            System.err.println("[resetPassword] Lỗi: Mật khẩu xác nhận không khớp");
            throw new RuntimeException("Mật khẩu xác nhận không khớp");
        }
        System.out.println("[resetPassword] Password và confirmPassword khớp nhau");

        // Tìm user cần reset password
        System.out.println("[resetPassword] Tìm user với ID: " + userId);
        Optional<UserEntity> userOptional = userRepository.findById(userId);

        if (userOptional.isEmpty()) {
            System.err.println("[resetPassword] Lỗi: Không tìm thấy user với ID: " + userId);
            throw new RuntimeException("Không tìm thấy tài khoản");
        }

        UserEntity userEntity = userOptional.get();
        System.out.println("[resetPassword] Tìm thấy user: username=" + userEntity.getUsername());

        // Cập nhật password
        System.out.println("[resetPassword] Cập nhật password mới");
        userEntity.setPassword(passwordEncoder.encode(request.getPassword()));

        // Lưu thay đổi
        System.out.println("[resetPassword] Lưu thay đổi vào database");
        userRepository.save(userEntity);
        System.out.println("[resetPassword] Đã reset password thành công cho user với ID: " + userId);
    }
}

