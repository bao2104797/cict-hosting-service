package my_spring_app.my_spring_app.service.impl;

import my_spring_app.my_spring_app.dto.reponse.CreateUserResponse;
import my_spring_app.my_spring_app.dto.reponse.LoginResponse;
import my_spring_app.my_spring_app.dto.reponse.UserSummaryResponse;
import my_spring_app.my_spring_app.dto.request.CreateUserRequest;
import my_spring_app.my_spring_app.dto.request.LoginRequest;
import my_spring_app.my_spring_app.entity.UserEntity;
import my_spring_app.my_spring_app.repository.ProjectBackendRepository;
import my_spring_app.my_spring_app.repository.ProjectDatabaseRepository;
import my_spring_app.my_spring_app.repository.ProjectFrontendRepository;
import my_spring_app.my_spring_app.repository.ProjectRepository;
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
public class UserServiceImpl implements UserService {

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

        // Tạo user mới
        System.out.println("[createUser] Tạo UserEntity mới");
        UserEntity userEntity = new UserEntity();
        userEntity.setFullname(request.getFullname());
        userEntity.setUsername(request.getUsername());
        userEntity.setPassword(passwordEncoder.encode(request.getPassword()));
        userEntity.setStatus("ACTIVE");
        userEntity.setRole("USER");
        userEntity.setTier(tier);
        System.out.println("[createUser] Đã thiết lập thông tin user: fullname=" + request.getFullname() + ", username=" + request.getUsername() + ", role=USER, status=ACTIVE, tier=" + tier);

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
}

