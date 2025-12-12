package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.KeyPair;
import com.jcraft.jsch.Session;
import my_spring_app.my_spring_app.dto.reponse.CreateServerResponse;
import my_spring_app.my_spring_app.dto.reponse.ServerResponse;
import my_spring_app.my_spring_app.dto.reponse.ServerAuthStatusResponse;
import my_spring_app.my_spring_app.dto.reponse.TestSshResponse;
import my_spring_app.my_spring_app.dto.request.CreateServerRequest;
import my_spring_app.my_spring_app.dto.request.UpdateServerRequest;
import my_spring_app.my_spring_app.dto.request.TestSshRequest;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.entity.SshKeyEntity;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.repository.SshKeyRepository;
import my_spring_app.my_spring_app.service.ServerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.Properties;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Service implementation cho Server
 * Xử lý các nghiệp vụ liên quan đến quản lý server
 */
@Service
@Transactional
public class ServerServiceImpl implements ServerService {

    // Repository để truy vấn Server entities
    @Autowired
    private ServerRepository serverRepository;
    
    @Autowired
    private SshKeyRepository sshKeyRepository;

    /**
     * Lấy tất cả server từ database
     * @return Danh sách tất cả server dưới dạng ServerResponse
     */
    @Override
    public List<ServerResponse> findAll() {
        System.out.println("[findAll] Lay tat ca server tu database");
        List<ServerEntity> servers = serverRepository.findAll();
        System.out.println("[findAll] Da lay duoc " + servers.size() + " server");
        return servers.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Lấy server theo ID
     * @param id ID của server
     * @return ServerResponse
     * @throws RuntimeException Nếu không tìm thấy server
     */
    @Override
    public ServerResponse findById(Long id) {
        System.out.println("[findById] Tim server voi ID: " + id);
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        return convertToResponse(server);
    }

    /**
     * Tạo server mới
     * Khi thêm server, hệ thống sẽ:
     * 1. Test SSH connection trước
     * 2. Kiểm tra duplicate
     * 3. Lưu server vào database
     * 4. Tự động generate SSH key và install vào server
     * 5. Configure sudo NOPASSWD cho user
     * 
     * @param request Thông tin request để tạo server
     * @return Response chứa thông tin server đã tạo
     * @throws RuntimeException Nếu có lỗi trong quá trình tạo server
     */
    @Override
    public CreateServerResponse createServer(CreateServerRequest request) {
        System.out.println("[createServer] Bat dau tao server moi voi name: " + request.getName());
        
        // Bước 1: Test SSH connection trước
        System.out.println("[createServer] Buoc 1: Test SSH connection...");
        boolean canSsh = testSshConnection(request.getIp(), request.getPort(), 
                                           request.getUsername(), request.getPassword());
        if (!canSsh) {
            throw new RuntimeException("Khong the ket noi SSH toi server. Vui long kiem tra IP/Port/Username/Password");
        }
        System.out.println("[createServer] SSH connection thanh cong");
        
        // Set status = ONLINE nếu SSH connection thành công
        ServerEntity.ServerStatus status = ServerEntity.ServerStatus.ONLINE;
        
        // Bước 2: Kiểm tra duplicate
        System.out.println("[createServer] Buoc 2: Kiem tra duplicate server...");
        if (serverRepository.existsByIpAndPortAndUsername(request.getIp(), request.getPort(), request.getUsername())) {
            throw new RuntimeException("Server da ton tai voi IP/Port/Username nay. Vui long su dung thong tin khac.");
        }
        System.out.println("[createServer] Khong co duplicate");
        
        // Validate role (MASTER, WORKER, DOCKER, ANSIBLE)
        System.out.println("[createServer] Kiem tra role: " + request.getRole());
        String role = request.getRole().toUpperCase();
        if (!"MASTER".equals(role) && !"WORKER".equals(role) && 
            !"DOCKER".equals(role) && !"ANSIBLE".equals(role)) {
            System.err.println("[createServer] Loi: Role khong hop le: " + role);
            throw new RuntimeException("Role khong hop le. Chi ho tro MASTER, WORKER, DOCKER, ANSIBLE");
        }
        System.out.println("[createServer] Role hop le: " + role);

        // Validate server status (RUNNING, STOPPED, BUILDING, ERROR)
        System.out.println("[createServer] Kiem tra server status: " + request.getServerStatus());
        String serverStatus = request.getServerStatus().toUpperCase();
        if (!"RUNNING".equals(serverStatus) && !"STOPPED".equals(serverStatus) && 
            !"BUILDING".equals(serverStatus) && !"ERROR".equals(serverStatus)) {
            System.err.println("[createServer] Loi: Server status khong hop le: " + serverStatus);
            throw new RuntimeException("Server status khong hop le. Chi ho tro RUNNING, STOPPED, BUILDING, ERROR");
        }
        System.out.println("[createServer] Server status hop le: " + serverStatus);

        // Validate cluster status (AVAILABLE, UNAVAILABLE)
        System.out.println("[createServer] Kiem tra cluster status: " + request.getClusterStatus());
        String clusterStatus = request.getClusterStatus().toUpperCase();
        if (!"AVAILABLE".equals(clusterStatus) && !"UNAVAILABLE".equals(clusterStatus)) {
            System.err.println("[createServer] Loi: Cluster status khong hop le: " + clusterStatus);
            throw new RuntimeException("Cluster status khong hop le. Chi ho tro AVAILABLE, UNAVAILABLE");
        }
        System.out.println("[createServer] Cluster status hop le: " + clusterStatus);

        // Bước 3: Tạo ServerEntity mới và lưu vào database
        System.out.println("[createServer] Buoc 3: Tao ServerEntity moi...");
        ServerEntity serverEntity = new ServerEntity();
        serverEntity.setName(request.getName());
        serverEntity.setIp(request.getIp());
        serverEntity.setPort(request.getPort());
        serverEntity.setUsername(request.getUsername());
        serverEntity.setPassword(request.getPassword());
        serverEntity.setRole(role);
        serverEntity.setStatus(status); // ONLINE vì đã test SSH thành công
        serverEntity.setServerStatus(serverStatus);
        serverEntity.setClusterStatus(clusterStatus);
        System.out.println("[createServer] Da thiet lap thong tin server: name=" + request.getName() + 
                          ", ip=" + request.getIp() + ", port=" + request.getPort() + 
                          ", role=" + role + ", serverStatus=" + serverStatus + ", clusterStatus=" + clusterStatus);

        // Lưu vào database để có ID
        System.out.println("[createServer] Luu server vao database...");
        ServerEntity savedServer = serverRepository.saveAndFlush(serverEntity);
        System.out.println("[createServer] Da luu server thanh cong voi ID: " + savedServer.getId());

        // Bước 4: Tự động generate SSH key và install vào server
        System.out.println("[createServer] Buoc 4: Generate va install SSH key...");
        SshKeyEntity sshKey = null;
        try {
            sshKey = generateAndInstallSshKey(
                request.getIp(), 
                request.getPort(), 
                request.getUsername(), 
                request.getPassword()
            );
            if (sshKey != null) {
                sshKey.setServer(savedServer);
                sshKey = sshKeyRepository.saveAndFlush(sshKey);
                savedServer.setSshKey(sshKey);
                savedServer = serverRepository.saveAndFlush(savedServer);
                System.out.println("[createServer] Da generate va install SSH key thanh cong");
            }
        } catch (Exception e) {
            System.err.println("[createServer] Loi khi generate SSH key: " + e.getMessage());
            // Không throw exception, vì server đã được lưu, chỉ log lỗi
        }

        // Bước 5: Lấy metrics từ server (CPU, RAM, Disk)
        System.out.println("[createServer] Buoc 5: Lay metrics tu server...");
        try {
            Map<String, String> metrics = getServerMetrics(
                request.getIp(), 
                request.getPort(), 
                request.getUsername(), 
                sshKey != null ? sshKey.getEncryptedPrivateKey() : null,
                request.getPassword()
            );
            if (metrics != null) {
                savedServer.setCpuCores(metrics.get("cpuCores"));
                savedServer.setRamTotal(metrics.get("ramTotal"));
                savedServer.setDiskTotal(metrics.get("diskTotal"));
                savedServer = serverRepository.saveAndFlush(savedServer);
                System.out.println("[createServer] Da lay metrics thanh cong: CPU=" + metrics.get("cpuCores") + 
                                  " cores, RAM=" + metrics.get("ramTotal") + 
                                  ", Disk=" + metrics.get("diskTotal"));
            }
        } catch (Exception e) {
            System.err.println("[createServer] Loi khi lay metrics: " + e.getMessage());
            // Không throw exception, chỉ log lỗi
        }

        // Tạo response
        System.out.println("[createServer] Tao CreateServerResponse");
        CreateServerResponse response = new CreateServerResponse();
        response.setId(savedServer.getId());
        response.setName(savedServer.getName());
        response.setIp(savedServer.getIp());
        response.setPort(savedServer.getPort());
        response.setUsername(savedServer.getUsername());
        response.setRole(savedServer.getRole());
        response.setStatus(savedServer.getStatus() != null ? savedServer.getStatus().name() : "OFFLINE");
        response.setServerStatus(savedServer.getServerStatus());
        response.setClusterStatus(savedServer.getClusterStatus());
        response.setCreatedAt(savedServer.getCreatedAt());
        // Thêm metrics vào response nếu có (chỉ total, không trả về used)
        response.setCpuCores(savedServer.getCpuCores());
        response.setRamTotal(savedServer.getRamTotal());
        response.setDiskTotal(savedServer.getDiskTotal());
        // Không set used - các giá trị này sẽ lấy trực tiếp từ SSH khi cần

        System.out.println("[createServer] Hoan tat tao server thanh cong: name=" + savedServer.getName() + 
                          ", id=" + savedServer.getId() + ", role=" + savedServer.getRole());
        return response;
    }
    
    /**
     * Helper method: Test SSH connection
     */
    private boolean testSshConnection(String ip, Integer port, String username, String password) {
        Session session = null;
        try {
            JSch jsch = new JSch();
            session = jsch.getSession(username, ip, port);
            session.setPassword(password);
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            session.setConfig(config);
            session.setTimeout(5000);
            session.connect(5000);
            return session.isConnected();
        } catch (Exception e) {
            System.err.println("[testSshConnection] Loi: " + e.getMessage());
            return false;
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    /**
     * Cập nhật thông tin server
     * @param id ID của server cần cập nhật
     * @param request Thông tin request để cập nhật server
     * @return ServerResponse chứa thông tin server đã cập nhật
     * @throws RuntimeException Nếu không tìm thấy server hoặc có lỗi validation
     */
    @Override
    public ServerResponse updateServer(Long id, UpdateServerRequest request) {
        System.out.println("[updateServer] Bat dau cap nhat server voi ID: " + id);
        
        // Tìm server trong database
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        
        // Kiểm tra xem có thay đổi thông tin kết nối không
        boolean connectionFieldChanged = request.getIp() != null || request.getPort() != null || request.getUsername() != null;
        boolean suppliedNewPassword = request.getPassword() != null && !request.getPassword().isBlank();
        
        // Kiểm tra xem chỉ cập nhật cấu hình (role, serverStatus, clusterStatus) hay không
        boolean onlyConfigUpdate = !connectionFieldChanged && !suppliedNewPassword && 
                                  (request.getRole() != null || request.getServerStatus() != null || 
                                   request.getClusterStatus() != null || request.getName() != null);
        
        if (onlyConfigUpdate) {
            System.out.println("[updateServer] Chi cap nhat cau hinh (role/serverStatus/clusterStatus/name) - KHONG can test SSH");
        }
        
        if (connectionFieldChanged) {
            String newIp = request.getIp() != null ? request.getIp() : server.getIp();
            Integer newPort = request.getPort() != null ? request.getPort() : server.getPort();
            String newUsername = request.getUsername() != null ? request.getUsername() : server.getUsername();
            
            // Kiểm tra xem có server khác (ID khác) đang dùng cùng ip/port/username không
            if (serverRepository.existsByIpAndPortAndUsername(newIp, newPort, newUsername)) {
                Optional<ServerEntity> existingServer = serverRepository.findByIpAndPortAndUsername(newIp, newPort, newUsername);
                if (existingServer.isPresent() && !existingServer.get().getId().equals(id)) {
                    throw new RuntimeException("Server da ton tai voi IP/Port/Username nay. Vui long su dung thong tin khac.");
                }
            }
        }
        
        // CHỈ test SSH nếu có thay đổi thông tin kết nối (IP/Port/Username) hoặc password
        // Nếu chỉ cập nhật cấu hình (role, serverStatus, clusterStatus) thì KHÔNG test SSH
        boolean sshTested = false;
        if (connectionFieldChanged || suppliedNewPassword) {
            String testIp = request.getIp() != null ? request.getIp() : server.getIp();
            Integer testPort = request.getPort() != null ? request.getPort() : server.getPort();
            String testUsername = request.getUsername() != null ? request.getUsername() : server.getUsername();
            String testPassword = request.getPassword() != null ? request.getPassword() : server.getPassword();
            
            System.out.println("[updateServer] Co thay doi connection info hoac password, bat buoc test SSH truoc khi update");
            System.out.println("[updateServer] Test SSH voi: " + testIp + ":" + testPort + " user: " + testUsername);
            
            boolean canSsh = testSshConnection(testIp, testPort, testUsername, testPassword);
            if (!canSsh) {
                System.err.println("[updateServer] SSH test THAT BAI - KHONG cho phep update");
                throw new RuntimeException("Khong the ket noi SSH toi server voi thong tin moi. " +
                        "Vui long kiem tra lai IP/Port/Username/Password. Update bi huy bo.");
            }
            
            // SSH thành công → cho phép update và set status = ONLINE
            server.setStatus(ServerEntity.ServerStatus.ONLINE);
            sshTested = true;
            System.out.println("[updateServer] SSH test thanh cong, cho phep update va set status = ONLINE");
        } else {
            System.out.println("[updateServer] Khong co thay doi connection info, KHONG can test SSH");
        }
        
        // Cập nhật các trường nếu có trong request
        if (request.getName() != null && !request.getName().isBlank()) {
            server.setName(request.getName());
        }
        if (request.getIp() != null && !request.getIp().isBlank()) {
            server.setIp(request.getIp());
        }
        if (request.getPort() != null) {
            server.setPort(request.getPort());
        }
        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            server.setUsername(request.getUsername());
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            server.setPassword(request.getPassword());
        }
        if (request.getRole() != null && !request.getRole().isBlank()) {
            String role = request.getRole().toUpperCase();
            if (!"MASTER".equals(role) && !"WORKER".equals(role) && 
                !"DOCKER".equals(role) && !"ANSIBLE".equals(role)) {
                throw new RuntimeException("Role khong hop le. Chi ho tro MASTER, WORKER, DOCKER, ANSIBLE");
            }
            server.setRole(role);
        }
        // Chỉ cập nhật status nếu được cung cấp và chưa test SSH
        if (request.getStatus() != null && !request.getStatus().isBlank() && !sshTested) {
            String statusStr = request.getStatus().toUpperCase();
            if (!"ONLINE".equals(statusStr) && !"OFFLINE".equals(statusStr) && 
                !"DISABLED".equals(statusStr)) {
                throw new RuntimeException("Status khong hop le. Chi ho tro ONLINE, OFFLINE, DISABLED");
            }
            server.setStatus(ServerEntity.ServerStatus.valueOf(statusStr));
        }
        if (request.getServerStatus() != null && !request.getServerStatus().isBlank()) {
            String serverStatus = request.getServerStatus().toUpperCase();
            if (!"RUNNING".equals(serverStatus) && !"STOPPED".equals(serverStatus) && 
                !"BUILDING".equals(serverStatus) && !"ERROR".equals(serverStatus)) {
                throw new RuntimeException("Server status khong hop le. Chi ho tro RUNNING, STOPPED, BUILDING, ERROR");
            }
            server.setServerStatus(serverStatus);
        }
        if (request.getClusterStatus() != null && !request.getClusterStatus().isBlank()) {
            String clusterStatus = request.getClusterStatus().toUpperCase();
            if (!"AVAILABLE".equals(clusterStatus) && !"UNAVAILABLE".equals(clusterStatus)) {
                throw new RuntimeException("Cluster status khong hop le. Chi ho tro AVAILABLE, UNAVAILABLE");
            }
            // Format log với username và IP
            String username = server.getUsername() != null ? server.getUsername() : (server.getName() != null ? server.getName() : "server-" + server.getId());
            String ip = server.getIp() != null ? server.getIp() : "unknown";
            System.out.println("[ServerService] updateServer() - Cap nhat clusterStatus: " + username + " (IP: " + ip + ") - tu " + server.getClusterStatus() + " -> " + clusterStatus);
            server.setClusterStatus(clusterStatus);
        }
        
        // Cập nhật metrics nếu có
        if (request.getCpuCores() != null) {
            server.setCpuCores(request.getCpuCores().isBlank() ? null : request.getCpuCores());
        }
        if (request.getRamTotal() != null) {
            server.setRamTotal(request.getRamTotal().isBlank() ? null : request.getRamTotal());
        }
        if (request.getDiskTotal() != null) {
            server.setDiskTotal(request.getDiskTotal().isBlank() ? null : request.getDiskTotal());
        }
        
        // Lưu vào database
        System.out.println("[updateServer] Luu thay doi vao database");
        ServerEntity updatedServer = serverRepository.save(server);
        System.out.println("[updateServer] Da cap nhat server thanh cong voi ID: " + updatedServer.getId());
        
        return convertToResponse(updatedServer);
    }

    /**
     * Xóa server
     * Quy trình:
     * 1. Xóa tất cả SSH keys liên quan đến server
     * 2. Xóa SSH key được tham chiếu bởi server (nếu có)
     * 3. Xóa server
     * 
     * @param id ID của server cần xóa
     * @throws RuntimeException Nếu không tìm thấy server
     */
    @Override
    @Transactional
    public void deleteServer(Long id) {
        System.out.println("[deleteServer] Bat dau xoa server voi ID: " + id);
        
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        
        // 1) Xóa tất cả SSH keys gắn với server qua ssh_keys.server_id
        try {
            List<SshKeyEntity> keys = sshKeyRepository.findByServer_Id(id);
            if (keys != null && !keys.isEmpty()) {
                System.out.println("[deleteServer] Xoa " + keys.size() + " SSH keys lien quan");
                sshKeyRepository.deleteAll(keys);
            }
        } catch (Exception e) {
            System.err.println("[deleteServer] Loi khi xoa SSH keys: " + e.getMessage());
            // Tiếp tục xóa server dù có lỗi
        }
        
        // 2) Xóa SSH key được tham chiếu bởi server.ssh_key_id (nếu có)
        if (server.getSshKey() != null && server.getSshKey().getId() != null) {
            try {
                Long keyId = server.getSshKey().getId();
                server.setSshKey(null);
                server.setClusterStatus("UNAVAILABLE");
                serverRepository.saveAndFlush(server);
                System.out.println("[deleteServer] Xoa SSH key voi ID: " + keyId);
                sshKeyRepository.deleteById(keyId);
            } catch (Exception e) {
                System.err.println("[deleteServer] Loi khi xoa SSH key: " + e.getMessage());
                // Tiếp tục xóa server dù có lỗi
            }
        }
        
        // 3) Xóa server
        serverRepository.delete(server);
        System.out.println("[deleteServer] Da xoa server thanh cong voi ID: " + id);
    }

    /**
     * Test SSH connection đến server
     * @param request Thông tin request để test SSH (ip, port, username, password)
     * @return TestSshResponse chứa kết quả test
     */
    @Override
    public TestSshResponse testSsh(TestSshRequest request) {
        System.out.println("[testSsh] Bat dau test SSH connection den: " + request.getIp() + ":" + request.getPort());
        
        TestSshResponse response = new TestSshResponse();
        Session session = null;
        
        try {
            // Tạo JSch instance
            JSch jsch = new JSch();
            
            // Tạo SSH session
            session = jsch.getSession(request.getUsername(), request.getIp(), request.getPort());
            session.setPassword(request.getPassword());
            
            // Cấu hình session
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            session.setConfig(config);
            session.setTimeout(5000);
            
            // Kết nối
            session.connect(5000);
            
            System.out.println("[testSsh] Ket noi SSH thanh cong");
            response.setSuccess(true);
            response.setMessage("Ket noi SSH thanh cong");
            
        } catch (Exception e) {
            System.err.println("[testSsh] Loi khi ket noi SSH: " + e.getMessage());
            response.setSuccess(false);
            response.setMessage("Ket noi SSH that bai: " + e.getMessage());
        } finally {
            // Đóng session
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
        
        return response;
    }

    /**
     * Helper method: Convert ServerEntity sang ServerResponse
     * Chỉ trả về total metrics, không trả về used (used sẽ lấy trực tiếp từ SSH khi cần)
     */
    private ServerResponse convertToResponse(ServerEntity server) {
        ServerResponse response = new ServerResponse();
        response.setId(server.getId());
        response.setName(server.getName());
        response.setIp(server.getIp());
        response.setPort(server.getPort());
        response.setUsername(server.getUsername());
        response.setRole(server.getRole());
        response.setStatus(server.getStatus() != null ? server.getStatus().name() : "OFFLINE");
        response.setServerStatus(server.getServerStatus());
        response.setClusterStatus(server.getClusterStatus());
        response.setCreatedAt(server.getCreatedAt());
        response.setCpuCores(server.getCpuCores());
        response.setRamTotal(server.getRamTotal());
        response.setDiskTotal(server.getDiskTotal());
        // Không set used - các giá trị này sẽ lấy trực tiếp từ SSH khi cần
        return response;
    }
    
    /**
     * Generate SSH key và install vào server
     * Quy trình:
     * 1. Sinh cặp khóa RSA 2048
     * 2. Cài public key vào ~/.ssh/authorized_keys
     * 3. Cấu hình sudo NOPASSWD cho user
     * 4. Trả về SshKeyEntity để lưu vào database
     */
    private SshKeyEntity generateAndInstallSshKey(String ip, Integer port, String username, String password) 
            throws Exception {
        System.out.println("[generateAndInstallSshKey] Bat dau generate SSH key cho " + username + "@" + ip);
        
        JSch jsch = new JSch();
        
        // 1) Sinh cap khoa RSA 2048
        System.out.println("[generateAndInstallSshKey] Sinh cap khoa RSA 2048...");
        KeyPair kpair = KeyPair.genKeyPair(jsch, KeyPair.RSA, 2048);
        String comment = username + "@" + ip;
        ByteArrayOutputStream pubOut = new ByteArrayOutputStream();
        kpair.writePublicKey(pubOut, comment);
        String publicKey = pubOut.toString(StandardCharsets.UTF_8);
        ByteArrayOutputStream prvOut = new ByteArrayOutputStream();
        kpair.writePrivateKey(prvOut);
        String privateKeyPem = prvOut.toString(StandardCharsets.UTF_8);
        kpair.dispose();
        System.out.println("[generateAndInstallSshKey] Da sinh cap khoa thanh cong");

        // 2) Cai public key vao ~/.ssh/authorized_keys
        System.out.println("[generateAndInstallSshKey] Cai public key vao server...");
        Session session = jsch.getSession(username, ip, port);
        session.setConfig("StrictHostKeyChecking", "no");
        session.setPassword(password);
        session.connect(5000);
        
        try {
            String escaped = publicKey.replace("'", "'\"'\"'");
            String cmd = "sh -lc \"mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && printf '%s\\n' '"
                    + escaped + "' >> ~/.ssh/authorized_keys\"";
            ChannelExec ch = null;
            try {
                ch = (ChannelExec) session.openChannel("exec");
                ch.setCommand(cmd);
                ch.connect(5000);
                while (!ch.isClosed()) {
                    try {
                        Thread.sleep(50);
                    } catch (InterruptedException ignored) {
                    }
                }
                System.out.println("[generateAndInstallSshKey] Da cai public key thanh cong");
            } finally {
                // Dam bao channel luon duoc dong
                if (ch != null && ch.isConnected()) {
                    ch.disconnect();
                }
            }

            // 3) Cau hinh sudo NOPASSWD cho user
            System.out.println("[generateAndInstallSshKey] Cau hinh sudo NOPASSWD...");
            configureSudoNopasswd(session, username, password);
            System.out.println("[generateAndInstallSshKey] Da cau hinh sudo NOPASSWD");

        } finally {
            session.disconnect();
        }

        // 4) Tạo SshKeyEntity để lưu vào database
        SshKeyEntity sshKey = new SshKeyEntity();
        sshKey.setKeyType(SshKeyEntity.KeyType.RSA);
        sshKey.setKeyLength(2048);
        sshKey.setPublicKey(publicKey);
        sshKey.setEncryptedPrivateKey(privateKeyPem);
        sshKey.setStatus(SshKeyEntity.KeyStatus.ACTIVE);
        
        System.out.println("[generateAndInstallSshKey] Hoan tat generate va install SSH key");
        return sshKey;
    }
    
    /**
     * Cấu hình sudo NOPASSWD cho user
     * Cho phép user chạy sudo mà không cần nhập password
     */
    private void configureSudoNopasswd(Session session, String username, String sudoPassword) {
        try {
            System.out.println("[configureSudoNopasswd] Cau hinh sudo NOPASSWD cho user: " + username);

            // 1. Ghi file sudoers
            String sudoersEntry = username + " ALL=(ALL) NOPASSWD:ALL";
            String writeCmd = String.join(" && ",
                    "echo '" + sudoPassword + "' | sudo -S sh -c 'echo \"" + sudoersEntry + "\" > /etc/sudoers.d/"
                            + username + "'",
                    "echo '" + sudoPassword + "' | sudo -S chmod 440 /etc/sudoers.d/" + username,
                    "echo '" + sudoPassword + "' | sudo -S chown root:root /etc/sudoers.d/" + username);
            execSimple(session, writeCmd, 5000);
            System.out.println("[configureSudoNopasswd] Da ghi file sudoers");

            // 2. Dam bao #includedir ton tai
            String ensureIncludeDir = String.join(" && ",
                    "grep -q '^#includedir /etc/sudoers.d' /etc/sudoers || " +
                            "echo '" + sudoPassword
                            + "' | sudo -S sed -i 's/^@includedir/#includedir/' /etc/sudoers || " +
                            "echo '" + sudoPassword
                            + "' | sudo -S sh -c 'echo \"#includedir /etc/sudoers.d\" >> /etc/sudoers'");
            execSimple(session, ensureIncludeDir, 3000);
            System.out.println("[configureSudoNopasswd] Da dam bao #includedir ton tai");

            // 3. Kiem tra cu phap
            String syntaxCmd = "echo '" + sudoPassword + "' | sudo -S visudo -cf /etc/sudoers.d/" + username
                    + " >/dev/null 2>&1 && echo SYNTAX_OK || echo SYNTAX_ERROR";
            String syntaxResult = execSimple(session, syntaxCmd, 3000).trim();
            System.out.println("[configureSudoNopasswd] Ket qua kiem tra cu phap: " + syntaxResult);

            // 4. Kiem tra thuc te
            String verifyCmd = "sudo -n true && echo 'NOPASSWD_ACTIVE' || echo 'FAIL'";
            String verifyResult = execSimple(session, verifyCmd, 3000).trim();
            System.out.println("[configureSudoNopasswd] Ket qua verify: " + verifyResult);

            if (verifyResult.contains("NOPASSWD_ACTIVE")) {
                System.out.println("[configureSudoNopasswd] Cau hinh sudo NOPASSWD thanh cong cho " + username);
            } else {
                System.err.println("[configureSudoNopasswd] Cau hinh sudo NOPASSWD that bai cho " + username);
            }
        } catch (Exception e) {
            System.err.println("[configureSudoNopasswd] Loi khi cau hinh sudo NOPASSWD: " + e.getMessage());
            // Không throw exception, chỉ log lỗi
        }
    }
    
    /**
     * Helper method: Thực thi lệnh đơn giản qua SSH và trả về output
     * Đảm bảo channel luôn được đóng sau khi thực thi xong
     */
    private String execSimple(Session session, String cmd, int timeoutMs) throws Exception {
        ChannelExec ch = null;
        try {
            ch = (ChannelExec) session.openChannel("exec");
            ch.setCommand(cmd);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ch.setOutputStream(out);
            ch.connect(timeoutMs);
            while (!ch.isClosed()) {
                try {
                    Thread.sleep(50);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            return out.toString(StandardCharsets.UTF_8);
        } finally {
            // Đảm bảo channel luôn được đóng
            if (ch != null && ch.isConnected()) {
                ch.disconnect();
            }
        }
    }
    
    /**
     * Lấy metrics từ server (CPU cores, RAM total, Disk total)
     * Sử dụng SSH key nếu có, nếu không thì dùng password
     * Lấy giá trị chính xác (không làm tròn) từ các lệnh Linux
     */
    private Map<String, String> getServerMetrics(String ip, Integer port, String username, 
                                                   String privateKeyPem, String password) {
        // System.out.println("[getServerMetrics] Bat dau lay metrics tu server: " + ip);

        String metricsCommand = "echo \"CPU_CORES:$(nproc || echo '0')\"; " +
                "echo \"CPU_LOAD:$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',' || echo '0')\"; " +
                "echo \"RAM_TOTAL_BYTES:$(free -b 2>/dev/null | awk '/^Mem:/{print $2}' || echo '0')\"; " +
                "echo \"RAM_USED_BYTES:$(free -b 2>/dev/null | awk '/^Mem:/{print $3}' || echo '0')\"; " +
                "echo \"DISK_TOTAL_KB:$(df / 2>/dev/null | awk 'NR==2{print $2}' || echo '0')\"; " +
                "echo \"DISK_USED_KB:$(df / 2>/dev/null | awk 'NR==2{print $3}' || echo '0')\"";
        
        Session session = null;
        ChannelExec channel = null;

        try {
            JSch jsch = new JSch();

            // Uu tien dung SSH key neu co
            if (privateKeyPem != null && !privateKeyPem.isBlank()) {
                // System.out.println("[getServerMetrics] Su dung SSH key de ket noi");
                byte[] prv = privateKeyPem.getBytes(StandardCharsets.UTF_8);
                jsch.addIdentity("inmem-key", prv, null, null);
                session = jsch.getSession(username, ip, port);
            } else {
                // System.out.println("[getServerMetrics] Su dung password de ket noi");
                session = jsch.getSession(username, ip, port);
                session.setPassword(password);
            }

            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            session.setConfig(config);
            session.setTimeout(10000);
            session.connect(10000);

            if (!session.isConnected()) {
                throw new RuntimeException("Session khong the ket noi");
            }

            channel = (ChannelExec) session.openChannel("exec");
            if (channel == null) {
                throw new RuntimeException("Khong the mo channel exec");
            }
            channel.setCommand(metricsCommand);

            InputStream in = channel.getInputStream();
            InputStream err = channel.getErrStream();
            channel.connect(10000);

            int retryCount = 0;
            while (!channel.isConnected() && retryCount < 20) {
                try {
                    Thread.sleep(100);
                    retryCount++;
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Channel connect bi interrupt");
                }
            }

            if (!channel.isConnected()) {
                throw new RuntimeException("Channel khong the ket noi sau " + (retryCount * 100) + "ms");
            }

            ByteArrayOutputStream outBuf = new ByteArrayOutputStream();
            ByteArrayOutputStream errBuf = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            long deadline = System.currentTimeMillis() + 15000;

            while (true) {
                boolean hasData = false;

                while (in.available() > 0) {
                    int read = in.read(buffer, 0, buffer.length);
                    if (read < 0) break;
                    outBuf.write(buffer, 0, read);
                    hasData = true;
                }

                while (err.available() > 0) {
                    int read = err.read(buffer, 0, buffer.length);
                    if (read < 0) break;
                    errBuf.write(buffer, 0, read);
                    hasData = true;
                }

                if (channel.isClosed() && !hasData) {
                    try {
                        Thread.sleep(200);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    while (in.available() > 0) {
                        int read = in.read(buffer, 0, buffer.length);
                        if (read < 0) break;
                        outBuf.write(buffer, 0, read);
                    }
                    while (err.available() > 0) {
                        int read = err.read(buffer, 0, buffer.length);
                        if (read < 0) break;
                        errBuf.write(buffer, 0, read);
                    }
                    break;
                }

                if (System.currentTimeMillis() > deadline) {
                    // System.err.println("[getServerMetrics] Timeout khi doc output tu server: " + ip);
                    break;
                }

                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }

            String output = outBuf.toString(StandardCharsets.UTF_8).trim();
            String errorOutput = errBuf.toString(StandardCharsets.UTF_8).trim();

            // System.out.println("[getServerMetrics] Output (stdout): " + output);
            // if (!errorOutput.isEmpty()) {
            //     System.err.println("[getServerMetrics] Output (stderr): " + errorOutput);
            // }

            int exitStatus = channel.getExitStatus();
            if (exitStatus != 0 && exitStatus != -1) {
                // System.err.println("[getServerMetrics] Command exit status: " + exitStatus + " cho server: " + ip);
            }

            return parseMetricsOutput(output);

        } catch (Exception e) {
            // System.err.println("[getServerMetrics] Loi khi lay metrics tu server " + ip + ": " + e.getMessage());
            // if (e.getCause() != null) {
            //     System.err.println("[getServerMetrics] Nguyen nhan: " + e.getCause().getMessage());
            // }
            return null;
        } finally {
            if (channel != null) {
                try {
                    if (channel.isConnected()) {
                        channel.disconnect();
                    }
                } catch (Exception e) {
                    // System.err.println("[getServerMetrics] Loi khi dong channel: " + e.getMessage());
                }
            }
            if (session != null) {
                try {
                    if (session.isConnected()) {
                        session.disconnect();
                    }
                } catch (Exception e) {
                    // System.err.println("[getServerMetrics] Loi khi dong session: " + e.getMessage());
                }
            }
        }
    }
    
    /**
     * Parse output từ metrics command và convert sang đơn vị phù hợp
     * Format: CPU_CORES:4\nCPU_LOAD:1.2\nRAM_TOTAL_BYTES:8589934592\nRAM_USED_BYTES:3435973836\nDISK_TOTAL_KB:52428800\nDISK_USED_KB:26214400
     * Convert: RAM từ bytes sang Gi/GiB, Disk từ KB sang G/GB
     */
    private Map<String, String> parseMetricsOutput(String output) {
        Map<String, String> metrics = new HashMap<>();
        String cpuCores = null;
        String cpuUsed = null;
        String ramTotal = null;
        String ramUsed = null;
        String diskTotal = null;
        String diskUsed = null;
        
        try {
            String[] lines = output.split("\n");
            // System.out.println("[parseMetricsOutput] Total lines in output: " + lines.length);
            // for (int i = 0; i < lines.length; i++) {
            //     System.out.println("[parseMetricsOutput] Line " + i + ": " + lines[i]);
            // }
            
            long ramTotalBytes = 0;
            long ramUsedBytes = 0;
            long diskTotalKB = 0;
            long diskUsedKB = 0;
            
            for (String line : lines) {
                line = line.trim();
                if (line.isEmpty()) continue; // Bỏ qua dòng trống
                if (line.startsWith("CPU_CORES:")) {
                    cpuCores = line.substring(10).trim();
                } else if (line.startsWith("CPU_LOAD:")) {
                    cpuUsed = line.substring(9).trim();
                    // Validate và format CPU load (loại bỏ khoảng trắng)
                    if (cpuUsed != null && !cpuUsed.isEmpty()) {
                        cpuUsed = cpuUsed.trim();
                    }
                } else if (line.startsWith("RAM_TOTAL_BYTES:")) {
                    try {
                        String value = line.substring(16).trim();
                        if (!value.isEmpty() && !value.equals("0")) {
                            ramTotalBytes = Long.parseLong(value);
                            ramTotal = formatBytes(ramTotalBytes);
                            // System.out.println("[parseMetricsOutput] Parsed RAM_TOTAL_BYTES: " + ramTotalBytes + " -> " + ramTotal);
                        } else {
                            // System.err.println("[parseMetricsOutput] RAM_TOTAL_BYTES is empty or 0");
                        }
                    } catch (NumberFormatException e) {
                        // System.err.println("[parseMetricsOutput] Loi parse RAM total bytes: " + line + " - " + e.getMessage());
                    }
                } else if (line.startsWith("RAM_USED_BYTES:")) {
                    try {
                        String value = line.substring(15).trim();
                        if (!value.isEmpty() && !value.equals("0")) {
                            ramUsedBytes = Long.parseLong(value);
                            ramUsed = formatBytes(ramUsedBytes);
                        }
                    } catch (NumberFormatException e) {
                        // System.err.println("[parseMetricsOutput] Loi parse RAM used bytes: " + e.getMessage());
                    }
                } else if (line.startsWith("DISK_TOTAL_KB:")) {
                    try {
                        String value = line.substring(14).trim();
                        if (!value.isEmpty() && !value.equals("0")) {
                            diskTotalKB = Long.parseLong(value);
                            diskTotal = formatKB(diskTotalKB);
                            // System.out.println("[parseMetricsOutput] Parsed DISK_TOTAL_KB: " + diskTotalKB + " -> " + diskTotal);
                        } else {
                            // System.err.println("[parseMetricsOutput] DISK_TOTAL_KB is empty or 0");
                        }
                    } catch (NumberFormatException e) {
                        // System.err.println("[parseMetricsOutput] Loi parse Disk total KB: " + line + " - " + e.getMessage());
                    }
                } else if (line.startsWith("DISK_USED_KB:")) {
                    try {
                        String value = line.substring(13).trim();
                        if (!value.isEmpty() && !value.equals("0")) {
                            diskUsedKB = Long.parseLong(value);
                            diskUsed = formatKB(diskUsedKB);
                        }
                    } catch (NumberFormatException e) {
                        // System.err.println("[parseMetricsOutput] Loi parse Disk used KB: " + e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            // System.err.println("[parseMetricsOutput] Loi khi parse: " + e.getMessage());
        }
        
        metrics.put("cpuCores", cpuCores != null ? cpuCores : null);
        metrics.put("cpuUsed", cpuUsed != null ? cpuUsed : null);
        metrics.put("ramTotal", ramTotal != null ? ramTotal : null);
        metrics.put("ramUsed", ramUsed != null ? ramUsed : null);
        metrics.put("diskTotal", diskTotal != null ? diskTotal : null);
        metrics.put("diskUsed", diskUsed != null ? diskUsed : null);
        
        return metrics;
    }
    /**
     * Convert bytes sang GiB (Gibibyte = 1024^3 bytes)
     * Format: "0.59Gi", "8.5Gi" hoặc "16.2Gi"
     * Luôn hiển thị GiB, kể cả khi < 1 GiB
     */
    private String formatBytes(long bytes) {
        if (bytes <= 0) return "0";
        
        // Convert sang GiB (Gibibyte = 1024^3 bytes)
        double gib = bytes / (1024.0 * 1024.0 * 1024.0);
        
        // Luôn hiển thị GiB với 2 chữ số thập phân
        return String.format("%.2fGi", gib);
    }
    
    /**
     * Convert KB (1KB blocks từ df) sang GiB (Gibibyte)
     * Format: "0.05Gi", "50Gi" hoặc "100.5Gi"
     * Note: df sử dụng 1KB = 1024 bytes (binary), nên convert: kb / (1024^2) = GiB
     * Luôn hiển thị GiB, kể cả khi < 1 GiB
     */
    private String formatKB(long kb) {
        if (kb <= 0) return "0";
        
        // Convert KB (binary, 1KB = 1024 bytes) sang GiB (binary, 1GiB = 1024^3 bytes)
        // Công thức: kb / (1024^2) vì 1KB = 1024 bytes, 1GiB = 1024^3 bytes
        double gib = kb / (1024.0 * 1024.0);
        
        // Luôn hiển thị GiB với 2 chữ số thập phân
        return String.format("%.2fGi", gib);
    }
    
    /**
     * Kiểm tra và cập nhật trạng thái tất cả servers
     * Ping tất cả servers và cập nhật status ONLINE/OFFLINE
     * DISABLED servers sẽ giữ nguyên status
     * 
     * @param timeoutMs Timeout cho mỗi ping (milliseconds)
     * @return Danh sách servers đã được cập nhật
     */
    @Override
    @Transactional
    public List<ServerResponse> checkAllStatuses(int timeoutMs) {
        return checkAllStatusesInternal(timeoutMs);
    }
    
    /**
     * Kiểm tra và cập nhật trạng thái (status) và metrics cho tất cả servers
     * - Ping tất cả servers và cập nhật status ONLINE/OFFLINE
     * - Lấy và cập nhật metrics (CPU, RAM, Disk) cho servers ONLINE
     * - DISABLED servers sẽ giữ nguyên status và không cập nhật metrics
     * 
     * @return Danh sách servers đã được cập nhật status và metrics
     */
    @Override
    @Transactional
    public List<ServerResponse> checkAllServers() {
        return checkAllServersInternal(2000);
    }
    
    /**
     * Kiểm tra và cập nhật trạng thái (status) cho tất cả servers
     * - Ping tất cả servers và cập nhật status ONLINE/OFFLINE
     * - DISABLED servers sẽ giữ nguyên status
     * 
     * @param timeoutMs Timeout cho mỗi ping (milliseconds)
     * @return Danh sách servers đã được cập nhật status
     */
    @Transactional
    private List<ServerResponse> checkAllStatusesInternal(int timeoutMs) {
        List<ServerEntity> servers = serverRepository.findAll();
        final int POOL_SIZE = Math.min(servers.size(), 16);
        
        ExecutorService executor = Executors.newFixedThreadPool(POOL_SIZE);
        long start = System.currentTimeMillis();
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        
        for (ServerEntity s : servers) {
            futures.add(CompletableFuture.runAsync(() -> {
                // DISABLED servers: chỉ check status (ping) nhưng giữ nguyên DISABLED
                if (s.getStatus() == ServerEntity.ServerStatus.DISABLED) {
                    // Vẫn ping để check nhưng không thay đổi status
                    try (Socket socket = new Socket()) {
                        InetSocketAddress addr = new InetSocketAddress(s.getIp(), s.getPort() != null ? s.getPort() : 22);
                        socket.connect(addr, timeoutMs);
                        // Giữ nguyên DISABLED, không đổi thành ONLINE
                    } catch (Exception ignored) {
                        // Giữ nguyên DISABLED, không đổi thành OFFLINE
                    }
                    return; // Skip update status
                }
                
                // ONLINE/OFFLINE servers: ping và cập nhật status
                boolean online = false;
                try (Socket socket = new Socket()) {
                    InetSocketAddress addr = new InetSocketAddress(s.getIp(), s.getPort() != null ? s.getPort() : 22);
                    socket.connect(addr, timeoutMs);
                    online = true;
                } catch (Exception ignored) {
                } finally {
                    s.setStatus(online ? ServerEntity.ServerStatus.ONLINE : ServerEntity.ServerStatus.OFFLINE);
                }
            }, executor));
        }
        
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        executor.shutdown();
        try {
            executor.awaitTermination(2, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {
        }
        
        serverRepository.saveAll(servers);
        
        long elapsed = System.currentTimeMillis() - start;
        System.out.println("[checkAllStatuses] Da kiem tra va cap nhat status cho " + servers.size() + " servers trong " + elapsed + " ms");
        return servers.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * Kiểm tra và cập nhật trạng thái (status) và metrics cho tất cả servers
     * - Ping tất cả servers và cập nhật status ONLINE/OFFLINE
     * - Lấy và cập nhật metrics (CPU, RAM, Disk) cho servers ONLINE
     * - DISABLED servers sẽ giữ nguyên status và không cập nhật metrics
     * 
     * @param timeoutMs Timeout cho mỗi ping (milliseconds)
     * @return Danh sách servers đã được cập nhật status và metrics
     */
    private List<ServerResponse> checkAllServersInternal(int timeoutMs) {
        System.out.println("[checkAllServers] Bat dau lam moi status va metrics cho tat ca servers (timeout: " + timeoutMs + "ms)");
        // Su dung findAllWithSshKeys de eager load SSH keys
        List<ServerEntity> servers = serverRepository.findAllWithSshKeys();
        final int POOL_SIZE = Math.min(servers.size(), 16);
        
        // Load SSH keys trước khi các thread chạy (trong transaction)
        Map<Long, String> sshKeyMap = loadSshKeysForServers(servers);
        
        // Map để lưu kết quả update từ các thread
        Map<Long, ServerUpdateInfo> updateMap = new ConcurrentHashMap<>();
        
        ExecutorService executor = Executors.newFixedThreadPool(POOL_SIZE);
        long start = System.currentTimeMillis();
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        
        for (ServerEntity s : servers) {
            final Long serverId = s.getId();
            final String ip = s.getIp();
            final Integer port = s.getPort();
            final String username = s.getUsername();
            final String password = s.getPassword();
            final ServerEntity.ServerStatus currentStatus = s.getStatus();
            final String privateKeyPem = sshKeyMap.get(serverId); // Lấy SSH key đã load sẵn
            
            futures.add(CompletableFuture.runAsync(() -> {
                // DISABLED servers: chỉ check status (ping) nhưng giữ nguyên DISABLED
                if (currentStatus == ServerEntity.ServerStatus.DISABLED) {
                    // Vẫn ping để check nhưng không thay đổi status
                    try (Socket socket = new Socket()) {
                        InetSocketAddress addr = new InetSocketAddress(ip, port != null ? port : 22);
                        socket.connect(addr, timeoutMs);
                        // Giữ nguyên DISABLED, không đổi thành ONLINE
                    } catch (Exception ignored) {
                        // Giữ nguyên DISABLED, không đổi thành OFFLINE
                    }
                    // Không cần update gì
                    return;
                }
                
                // ONLINE/OFFLINE servers: ping và cập nhật status
                boolean online = false;
                try (Socket socket = new Socket()) {
                    InetSocketAddress addr = new InetSocketAddress(ip, port != null ? port : 22);
                    socket.connect(addr, timeoutMs);
                    online = true;
                } catch (Exception ignored) {
                }
                
                ServerUpdateInfo updateInfo = new ServerUpdateInfo();
                updateInfo.status = online ? ServerEntity.ServerStatus.ONLINE : ServerEntity.ServerStatus.OFFLINE;
                
                // Nếu online, lấy và cập nhật metrics
                if (online) {
                    try {
                        // Lấy metrics từ server (sử dụng SSH key đã load sẵn)
                        Map<String, String> metrics = getServerMetrics(
                            ip,
                            port,
                            username,
                            privateKeyPem,
                            password
                        );
                        
                        // Lưu metrics vào updateInfo (chỉ total, không lưu used)
                        if (metrics != null) {
                            updateInfo.cpuCores = metrics.get("cpuCores");
                            updateInfo.ramTotal = metrics.get("ramTotal");
                            updateInfo.diskTotal = metrics.get("diskTotal");
                            System.out.println("[checkAllServers] Da lay metrics thanh cong cho server ID " + serverId + " (" + ip + ")");
                        } else {
                            // Bao loi khi khong lay duoc metrics
                            System.err.println("[checkAllServers] KHONG THE LAY METRICS cho server ID " + serverId + " (" + ip + ":" + port + ") - Server online nhung khong the ket noi SSH hoac timeout");
                        }
                    } catch (Exception e) {
                        System.err.println("[checkAllServers] LOI KHI LAY METRICS cho server ID " + serverId + " (" + ip + ":" + port + "): " + e.getMessage());
                        if (e.getCause() != null) {
                            System.err.println("[checkAllServers] Nguyen nhan: " + e.getCause().getMessage());
                        }
                    }
                }
                
                updateMap.put(serverId, updateInfo);
            }, executor));
        }
        
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        executor.shutdown();
        try {
            executor.awaitTermination(2, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {
        }
        
        // Dem so server co metrics va khong co metrics
        int serversWithMetrics = 0;
        int serversWithoutMetrics = 0;
        int serversOnline = 0;
        int serversOffline = 0;
        for (ServerUpdateInfo info : updateMap.values()) {
            if (info.status == ServerEntity.ServerStatus.ONLINE) {
                serversOnline++;
                if (info.cpuCores != null || info.ramTotal != null || info.diskTotal != null) {
                    serversWithMetrics++;
                } else {
                    serversWithoutMetrics++;
                }
            } else {
                serversOffline++;
            }
        }
        
        // Cập nhật tất cả servers trong transaction
        updateServersInTransaction(updateMap);
        
        // Reload để trả về dữ liệu mới nhất
        List<ServerEntity> updatedServers = serverRepository.findAll();
        
        long elapsed = System.currentTimeMillis() - start;
        System.out.println("[checkAllServers] Da lam moi status va metrics cho " + updatedServers.size() + " servers trong " + elapsed + " ms");
        System.out.println("[checkAllServers] Ket qua: " + serversOnline + " server ONLINE, " + serversOffline + " server OFFLINE");
        System.out.println("[checkAllServers] Metrics: " + serversWithMetrics + " server co metrics, " + serversWithoutMetrics + " server ONLINE nhung khong lay duoc metrics");
        if (serversWithoutMetrics > 0) {
            System.err.println("[checkAllServers] CANH BAO: Co " + serversWithoutMetrics + " server(s) ONLINE nhung KHONG THE LAY METRICS (kiem tra SSH key hoac ket noi)");
        }
        
        return updatedServers.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * Load SSH keys cho tất cả servers trong transaction
     * Tránh LazyInitializationException khi các thread truy cập SSH keys
     */
    @Transactional(readOnly = true)
    private Map<Long, String> loadSshKeysForServers(List<ServerEntity> servers) {
        Map<Long, String> sshKeyMap = new HashMap<>();
        for (ServerEntity server : servers) {
            try {
                // Reload server với SSH key trong transaction
                ServerEntity serverWithKey = serverRepository.findById(server.getId()).orElse(null);
                if (serverWithKey != null && serverWithKey.getSshKey() != null) {
                    // Force load SSH key bằng cách truy cập vào nó
                    SshKeyEntity sshKey = serverWithKey.getSshKey();
                    if (sshKey.getEncryptedPrivateKey() != null) {
                        sshKeyMap.put(server.getId(), sshKey.getEncryptedPrivateKey());
                    }
                }
            } catch (Exception e) {
                System.err.println("[loadSshKeysForServers] Loi khi load SSH key cho server ID " + server.getId() + ": " + e.getMessage());
            }
        }
        return sshKeyMap;
    }
    
    /**
     * Helper class để lưu thông tin update từ các thread
     * Chỉ lưu total metrics, không lưu used (used sẽ lấy trực tiếp từ SSH khi cần)
     */
    private static class ServerUpdateInfo {
        ServerEntity.ServerStatus status;
        String cpuCores;
        String ramTotal;
        String diskTotal;
    }
    
    /**
     * Cập nhật servers trong transaction
     */
    @Transactional
    private void updateServersInTransaction(Map<Long, ServerUpdateInfo> updateMap) {
        for (Map.Entry<Long, ServerUpdateInfo> entry : updateMap.entrySet()) {
            Long serverId = entry.getKey();
            ServerUpdateInfo updateInfo = entry.getValue();
            
            ServerEntity server = serverRepository.findById(serverId).orElse(null);
            if (server == null) {
                continue;
            }
            
            // Chỉ update status nếu không phải DISABLED
            if (server.getStatus() != ServerEntity.ServerStatus.DISABLED) {
                server.setStatus(updateInfo.status);
            }
            
            // Cập nhật metrics nếu có (chỉ total, không lưu used)
            boolean metricsUpdated = false;
            if (updateInfo.cpuCores != null) {
                server.setCpuCores(updateInfo.cpuCores);
                metricsUpdated = true;
            }
            if (updateInfo.ramTotal != null) {
                server.setRamTotal(updateInfo.ramTotal);
                metricsUpdated = true;
            }
            if (updateInfo.diskTotal != null) {
                server.setDiskTotal(updateInfo.diskTotal);
                metricsUpdated = true;
            }
            
            // Lưu vào database
            serverRepository.save(server);
            if (metricsUpdated) {
                System.out.println("[updateServersInTransaction] Da luu metrics vao database cho server ID " + serverId + 
                                  " (CPU: " + updateInfo.cpuCores + 
                                  ", RAM: " + updateInfo.ramTotal + 
                                  ", Disk: " + updateInfo.diskTotal + ")");
            }
        }
    }
    
    /**
     * Cập nhật trạng thái server (ONLINE/OFFLINE/DISABLED)
     * 
     * @param id ID của server
     * @param status Trạng thái mới
     * @return ServerResponse
     */
    @Override
    @Transactional
    public ServerResponse updateServerStatus(Long id, ServerEntity.ServerStatus status) {
        System.out.println("[updateServerStatus] Cap nhat status server ID: " + id + " thanh: " + status);
        
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        
        server.setStatus(status);
        ServerEntity updatedServer = serverRepository.save(server);
        
        System.out.println("[updateServerStatus] Da cap nhat status thanh cong");
        return convertToResponse(updatedServer);
    }
    
    /**
     * Lấy private key PEM của server (dùng cho WebSocket và các operations khác)
     */
    @Override
    public String resolveServerPrivateKeyPem(Long serverId) {
        ServerEntity server = serverRepository.findById(serverId).orElse(null);
        if (server != null && server.getSshKey() != null) {
            return server.getSshKey().getEncryptedPrivateKey();
        }
        return null;
    }
    
    /**
     * Helper: Test SSH connection với SSH key
     */
    private boolean testSshWithKey(String ip, Integer port, String username, String privateKeyPem, int timeoutMs) {
        Session session = null;
        try {
            JSch jsch = new JSch();
            byte[] prv = privateKeyPem.getBytes(StandardCharsets.UTF_8);
            jsch.addIdentity("inmem-key", prv, null, null);
            session = jsch.getSession(username, ip, port);
            session.setConfig("StrictHostKeyChecking", "no");
            session.setTimeout(timeoutMs);
            session.connect(timeoutMs);
            return session.isConnected();
        } catch (Exception e) {
            return false;
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }
    
    /**
     * Helper: Thực thi command qua SSH key
     */
    private String execCommandWithKey(String ip, Integer port, String username, String privateKeyPem, String command, int timeoutMs) {
        Session session = null;
        ChannelExec channel = null;
        try {
            JSch jsch = new JSch();
            byte[] prv = privateKeyPem.getBytes(StandardCharsets.UTF_8);
            jsch.addIdentity("inmem-key", prv, null, null);
            session = jsch.getSession(username, ip, port);
            session.setConfig("StrictHostKeyChecking", "no");
            session.setTimeout(timeoutMs);
            session.connect(timeoutMs);
            
            channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);
            
            InputStream in = channel.getInputStream();
            InputStream err = channel.getErrStream();
            channel.connect(timeoutMs);
            
            ByteArrayOutputStream outBuf = new ByteArrayOutputStream();
            ByteArrayOutputStream errBuf = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            long deadline = System.currentTimeMillis() + timeoutMs;
            
            while (true) {
                // Read stdout
                while (in.available() > 0) {
                    int read = in.read(buffer, 0, buffer.length);
                    if (read < 0) break;
                    outBuf.write(buffer, 0, read);
                }
                // Read stderr
                while (err.available() > 0) {
                    int read = err.read(buffer, 0, buffer.length);
                    if (read < 0) break;
                    errBuf.write(buffer, 0, read);
                }
                if (channel.isClosed()) break;
                if (System.currentTimeMillis() > deadline) break;
                try {
                    Thread.sleep(50);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            
            // Log stderr if present
            String errOutput = errBuf.toString(StandardCharsets.UTF_8).trim();
            if (!errOutput.isEmpty()) {
                System.out.println("[execCommandWithKey] Stderr output length: " + errOutput.length() + " characters");
                if (errOutput.length() > 1000) {
                    System.out.println("[execCommandWithKey] Stderr (first 500 chars):\n" + errOutput.substring(0, Math.min(500, errOutput.length())));
                    System.out.println("[execCommandWithKey] ... (truncated " + (errOutput.length() - 500) + " chars) ...");
                } else {
                    System.out.println("[execCommandWithKey] Stderr:\n" + errOutput);
                }
            }
            
            // Log exit status
            if (channel.isClosed()) {
                int exitStatus = channel.getExitStatus();
                if (exitStatus == 0) {
                    System.out.println("[execCommandWithKey] Exit status: 0 (success)");
                } else {
                    System.out.println("[execCommandWithKey] Exit status: " + exitStatus + " (non-zero, may indicate error)");
                }
            }
            
            return outBuf.toString(StandardCharsets.UTF_8).trim();
        } catch (Exception e) {
            System.err.println("[execCommandWithKey] Loi: " + e.getMessage());
            e.printStackTrace();
            return null;
        } finally {
            if (channel != null && channel.isConnected()) {
                channel.disconnect();
            }
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }
    
    /**
     * Helper: Thực thi command qua SSH key với streaming output
     */
    private String execCommandWithKey(String ip, Integer port, String username, String privateKeyPem, String command, int timeoutMs, Consumer<String> outputHandler) {
        Session session = null;
        ChannelExec channel = null;
        try {
            JSch jsch = new JSch();
            byte[] prv = privateKeyPem.getBytes(StandardCharsets.UTF_8);
            jsch.addIdentity("inmem-key", prv, null, null);
            session = jsch.getSession(username, ip, port);
            session.setConfig("StrictHostKeyChecking", "no");
            session.setTimeout(timeoutMs);
            session.connect(timeoutMs);
            
            channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);
            
            InputStream in = channel.getInputStream();
            InputStream err = channel.getErrStream();
            channel.connect(timeoutMs);
            
            StringBuilder aggregated = new StringBuilder();
            byte[] buffer = new byte[2048];
            long deadline = System.currentTimeMillis() + timeoutMs;
            
            while (true) {
                // Read stdout
                while (in.available() > 0) {
                    int read = in.read(buffer, 0, buffer.length);
                    if (read < 0) break;
                    String chunk = new String(buffer, 0, read, StandardCharsets.UTF_8);
                    aggregated.append(chunk);
                    if (outputHandler != null) {
                        outputHandler.accept(chunk);
                    }
                }
                // Read stderr
                while (err.available() > 0) {
                    int read = err.read(buffer, 0, buffer.length);
                    if (read < 0) break;
                    String chunk = new String(buffer, 0, read, StandardCharsets.UTF_8);
                    aggregated.append(chunk);
                    if (outputHandler != null) {
                        outputHandler.accept(chunk);
                    }
                }
                if (channel.isClosed()) {
                    if (in.available() == 0 && err.available() == 0) {
                        break;
                    }
                }
                if (System.currentTimeMillis() > deadline) break;
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            
            return aggregated.toString();
        } catch (Exception e) {
            System.err.println("[execCommandWithKey with outputHandler] Loi: " + e.getMessage());
            e.printStackTrace();
            return null;
        } finally {
            if (channel != null && channel.isConnected()) {
                channel.disconnect();
            }
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }
    
    /**
     * Helper: Thực thi command qua password với streaming output
     */
    private String execCommandWithPassword(String ip, Integer port, String username, String password, String command, int timeoutMs, Consumer<String> outputHandler) {
        Session session = null;
        ChannelExec channel = null;
        try {
            JSch jsch = new JSch();
            session = jsch.getSession(username, ip, port);
            session.setPassword(password);
            session.setConfig("StrictHostKeyChecking", "no");
            session.setTimeout(timeoutMs);
            session.connect(timeoutMs);
            
            channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);
            
            InputStream in = channel.getInputStream();
            InputStream err = channel.getErrStream();
            channel.connect(timeoutMs);
            
            StringBuilder aggregated = new StringBuilder();
            byte[] buffer = new byte[2048];
            long deadline = System.currentTimeMillis() + timeoutMs;
            
            while (true) {
                // Read stdout
                while (in.available() > 0) {
                    int read = in.read(buffer, 0, buffer.length);
                    if (read < 0) break;
                    String chunk = new String(buffer, 0, read, StandardCharsets.UTF_8);
                    aggregated.append(chunk);
                    if (outputHandler != null) {
                        outputHandler.accept(chunk);
                    }
                }
                // Read stderr
                while (err.available() > 0) {
                    int read = err.read(buffer, 0, buffer.length);
                    if (read < 0) break;
                    String chunk = new String(buffer, 0, read, StandardCharsets.UTF_8);
                    aggregated.append(chunk);
                    if (outputHandler != null) {
                        outputHandler.accept(chunk);
                    }
                }
                if (channel.isClosed()) {
                    if (in.available() == 0 && err.available() == 0) {
                        break;
                    }
                }
                if (System.currentTimeMillis() > deadline) break;
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            
            return aggregated.toString();
        } catch (Exception e) {
            System.err.println("[execCommandWithPassword with outputHandler] Loi: " + e.getMessage());
            e.printStackTrace();
            return null;
        } finally {
            if (channel != null && channel.isConnected()) {
                channel.disconnect();
            }
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }
    
    /**
     * Helper: Thực thi command qua password
     */
    private String execCommandWithPassword(String ip, Integer port, String username, String password, String command, int timeoutMs) {
        Session session = null;
        ChannelExec channel = null;
        try {
            JSch jsch = new JSch();
            session = jsch.getSession(username, ip, port);
            session.setPassword(password);
            session.setConfig("StrictHostKeyChecking", "no");
            session.setTimeout(timeoutMs);
            session.connect(timeoutMs);
            
            channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);
            
            InputStream in = channel.getInputStream();
            InputStream err = channel.getErrStream();
            channel.connect(timeoutMs);
            
            ByteArrayOutputStream outBuf = new ByteArrayOutputStream();
            ByteArrayOutputStream errBuf = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            long deadline = System.currentTimeMillis() + timeoutMs;
            
            while (true) {
                // Read stdout
                while (in.available() > 0) {
                    int read = in.read(buffer, 0, buffer.length);
                    if (read < 0) break;
                    outBuf.write(buffer, 0, read);
                }
                // Read stderr
                while (err.available() > 0) {
                    int read = err.read(buffer, 0, buffer.length);
                    if (read < 0) break;
                    errBuf.write(buffer, 0, read);
                }
                if (channel.isClosed()) break;
                if (System.currentTimeMillis() > deadline) break;
                try {
                    Thread.sleep(50);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            
            // Log stderr if present
            String errOutput = errBuf.toString(StandardCharsets.UTF_8).trim();
            if (!errOutput.isEmpty()) {
                System.out.println("[execCommandWithPassword] Stderr output length: " + errOutput.length() + " characters");
                if (errOutput.length() > 1000) {
                    System.out.println("[execCommandWithPassword] Stderr (first 500 chars):\n" + errOutput.substring(0, Math.min(500, errOutput.length())));
                    System.out.println("[execCommandWithPassword] ... (truncated " + (errOutput.length() - 500) + " chars) ...");
                } else {
                    System.out.println("[execCommandWithPassword] Stderr:\n" + errOutput);
                }
            }
            
            // Log exit status
            if (channel.isClosed()) {
                int exitStatus = channel.getExitStatus();
                if (exitStatus == 0) {
                    System.out.println("[execCommandWithPassword] Exit status: 0 (success)");
                } else {
                    System.out.println("[execCommandWithPassword] Exit status: " + exitStatus + " (non-zero, may indicate error)");
                }
            }
            
            return outBuf.toString(StandardCharsets.UTF_8).trim();
        } catch (Exception e) {
            System.err.println("[execCommandWithPassword] Loi: " + e.getMessage());
            e.printStackTrace();
            return null;
        } finally {
            if (channel != null && channel.isConnected()) {
                channel.disconnect();
            }
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }
    
    @Override
    @Transactional
    public ServerResponse reconnectServer(Long id, String password) {
        System.out.println("[reconnectServer] Bat dau reconnect server ID: " + id);
        
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        
        boolean hadSshKeyBefore = server.getSshKey() != null;
        
        // Uu tien thu SSH key truoc neu co
        if (hadSshKeyBefore) {
            String pem = resolveServerPrivateKeyPem(id);
            if (pem != null && !pem.isBlank()) {
                boolean canConnect = testSshWithKey(server.getIp(), server.getPort() != null ? server.getPort() : 22,
                        server.getUsername(), pem, 5000);
                if (canConnect) {
                    // Ket noi thanh cong bang SSH key
                    server.setStatus(ServerEntity.ServerStatus.ONLINE);
                    server = serverRepository.saveAndFlush(server);
                    System.out.println("[reconnectServer] Reconnect thanh cong bang SSH key");
                    return convertToResponse(server);
                }
            }
        }
        
        // Neu khong co SSH key hoac SSH key khong hoat dong, yeu cau password
        if (password == null || password.isBlank()) {
            throw new RuntimeException(hadSshKeyBefore 
                ? "SSH key khong hoat dong. Vui long nhap password de reconnect."
                : "Password khong duoc de trong (server chua co SSH key)");
        }
        
        // Test SSH connection voi password
        boolean canSsh = testSshConnection(server.getIp(), server.getPort() != null ? server.getPort() : 22,
                server.getUsername(), password);
        if (!canSsh) {
            throw new RuntimeException("Khong the ket noi SSH toi server, vui long kiem tra mat khau");
        }
        
        // Cap nhat password va status
        server.setPassword(password); // Luu password plaintext (co the encode sau neu can)
        server.setStatus(ServerEntity.ServerStatus.ONLINE);
        server = serverRepository.saveAndFlush(server);
        
        // Generate SSH key neu chua co
        if (server.getSshKey() == null) {
            try {
                SshKeyEntity created = generateAndInstallSshKey(server.getIp(), 
                        server.getPort() != null ? server.getPort() : 22,
                        server.getUsername(), password);
                if (created != null) {
                    created.setServer(server);
                    created = sshKeyRepository.saveAndFlush(created);
                    server.setSshKey(created);
                    server = serverRepository.saveAndFlush(server);
                    System.out.println("[reconnectServer] Da tu dong generate SSH key");
                }
            } catch (Exception e) {
                System.err.println("[reconnectServer] Loi khi generate SSH key: " + e.getMessage());
                // Khong throw exception, chi log loi
            }
        }
        
        System.out.println("[reconnectServer] Reconnect thanh cong");
        return convertToResponse(server);
    }
    
    @Override
    @Transactional
    public ServerResponse disconnectServer(Long id) {
        System.out.println("[disconnectServer] Bat dau disconnect server ID: " + id);
        
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        
        // Set status = DISABLED
        server.setStatus(ServerEntity.ServerStatus.DISABLED);
        server = serverRepository.saveAndFlush(server);
        
        System.out.println("[disconnectServer] Da disconnect server thanh cong");
        return convertToResponse(server);
    }
    
    @Override
    public String execCommand(Long id, String command, int timeoutMs) {
        System.out.println("[execCommand] Thuc thi command tren server ID: " + id);
        System.out.println("[execCommand] Command: " + command);
        
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        
        // Kiem tra server status
        if (server.getStatus() == ServerEntity.ServerStatus.DISABLED) {
            throw new RuntimeException("Server da bi ngat ket noi (DISABLED). Vui long ket noi lai truoc khi thuc thi command.");
        }
        if (server.getStatus() != ServerEntity.ServerStatus.ONLINE) {
            throw new RuntimeException("Server khong online. Khong the thuc thi command.");
        }
        
        String ip = server.getIp();
        Integer port = server.getPort() != null ? server.getPort() : 22;
        String username = server.getUsername();
        
        // Uu tien dung SSH key
        String privateKeyPem = resolveServerPrivateKeyPem(id);
        if (privateKeyPem != null && !privateKeyPem.isBlank()) {
            String output = execCommandWithKey(ip, port, username, privateKeyPem, command, timeoutMs);
            if (output != null) {
                System.out.println("[execCommand] Thuc thi thanh cong bang SSH key");
                // Log output chi tiet
                if (!output.trim().isEmpty()) {
                    System.out.println("[execCommand] Output length: " + output.length() + " characters");
                    // Neu output qua dai (> 2000 ky tu), chi log 1000 ky tu dau va cuoi
                    if (output.length() > 2000) {
                        String preview = output.substring(0, Math.min(1000, output.length()));
                        String suffix = output.length() > 1000 ? output.substring(Math.max(0, output.length() - 1000)) : "";
                        System.out.println("[execCommand] Output (first 1000 chars):\n" + preview);
                        System.out.println("[execCommand] ... (truncated " + (output.length() - 2000) + " chars) ...");
                        System.out.println("[execCommand] Output (last 1000 chars):\n" + suffix);
                    } else {
                        System.out.println("[execCommand] Output:\n" + output);
                    }
                } else {
                    System.out.println("[execCommand] Output: (empty)");
                }
                return output;
            }
        }
        
        // Fallback: dung password neu co
        String password = server.getPassword();
        if (password != null && !password.isBlank()) {
            String output = execCommandWithPassword(ip, port, username, password, command, timeoutMs);
            if (output != null) {
                System.out.println("[execCommand] Thuc thi thanh cong bang password");
                // Log output chi tiet
                if (!output.trim().isEmpty()) {
                    System.out.println("[execCommand] Output length: " + output.length() + " characters");
                    // Neu output qua dai (> 2000 ky tu), chi log 1000 ky tu dau va cuoi
                    if (output.length() > 2000) {
                        String preview = output.substring(0, Math.min(1000, output.length()));
                        String suffix = output.length() > 1000 ? output.substring(Math.max(0, output.length() - 1000)) : "";
                        System.out.println("[execCommand] Output (first 1000 chars):\n" + preview);
                        System.out.println("[execCommand] ... (truncated " + (output.length() - 2000) + " chars) ...");
                        System.out.println("[execCommand] Output (last 1000 chars):\n" + suffix);
                    } else {
                        System.out.println("[execCommand] Output:\n" + output);
                    }
                } else {
                    System.out.println("[execCommand] Output: (empty)");
                }
                return output;
            }
        }
        
        throw new RuntimeException("Khong the thuc thi command. Server khong co SSH key hoac password hop le.");
    }
    
    @Override
    public String execCommand(Long id, String command, int timeoutMs, Consumer<String> outputHandler) {
        System.out.println("[execCommand with outputHandler] Thuc thi command tren server ID: " + id);
        System.out.println("[execCommand with outputHandler] Command: " + command);
        
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        
        // Kiem tra server status
        if (server.getStatus() == ServerEntity.ServerStatus.DISABLED) {
            throw new RuntimeException("Server da bi ngat ket noi (DISABLED). Vui long ket noi lai truoc khi thuc thi command.");
        }
        if (server.getStatus() != ServerEntity.ServerStatus.ONLINE) {
            throw new RuntimeException("Server khong online. Khong the thuc thi command.");
        }
        
        String ip = server.getIp();
        Integer port = server.getPort() != null ? server.getPort() : 22;
        String username = server.getUsername();
        
        // Uu tien dung SSH key
        String privateKeyPem = resolveServerPrivateKeyPem(id);
        if (privateKeyPem != null && !privateKeyPem.isBlank()) {
            String output = execCommandWithKey(ip, port, username, privateKeyPem, command, timeoutMs, outputHandler);
            if (output != null) {
                System.out.println("[execCommand with outputHandler] Thuc thi thanh cong bang SSH key");
                System.out.println("[execCommand with outputHandler] Output: " + output);
                return output;
            }
        }
        
        // Fallback: dung password neu co
        String password = server.getPassword();
        if (password != null && !password.isBlank()) {
            String output = execCommandWithPassword(ip, port, username, password, command, timeoutMs, outputHandler);
            if (output != null) {
                System.out.println("[execCommand with outputHandler] Thuc thi thanh cong bang password");
                return output;
            }
        }
        
        throw new RuntimeException("Khong the thuc thi command. Server khong co SSH key hoac password hop le.");
    }
    
    @Override
    @Transactional
    public String shutdownServer(Long id) {
        System.out.println("[shutdownServer] Bat dau shutdown server ID: " + id);
        
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        
        // Kiem tra server status
        if (server.getStatus() == ServerEntity.ServerStatus.DISABLED) {
            throw new RuntimeException("Server da bi ngat ket noi (DISABLED). Vui long ket noi lai truoc khi shutdown.");
        }
        if (server.getStatus() != ServerEntity.ServerStatus.ONLINE) {
            throw new RuntimeException("Server khong online. Khong the shutdown.");
        }
        
        // Shutdown command (thu nhieu cach)
        String shutdownCommand = "sudo shutdown -h now || sudo poweroff || sudo systemctl poweroff || sudo halt";
        
        String output = execCommand(id, shutdownCommand, 10000);
        
        // Sau khi shutdown thanh cong, set status = OFFLINE
        server.setStatus(ServerEntity.ServerStatus.OFFLINE);
        serverRepository.saveAndFlush(server);
        
        System.out.println("[shutdownServer] Da gui lenh shutdown thanh cong");
        return output != null ? output : "Da gui lenh shutdown den server";
    }
    
    @Override
    @Transactional
    public String restartServer(Long id) {
        System.out.println("[restartServer] Bat dau restart server ID: " + id);
        
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        
        // Kiem tra server status
        if (server.getStatus() == ServerEntity.ServerStatus.DISABLED) {
            throw new RuntimeException("Server da bi ngat ket noi (DISABLED). Vui long ket noi lai truoc khi restart.");
        }
        if (server.getStatus() != ServerEntity.ServerStatus.ONLINE) {
            throw new RuntimeException("Server khong online. Khong the restart.");
        }
        
        // Restart command (thu nhieu cach)
        String restartCommand = "sudo reboot || sudo shutdown -r now || sudo systemctl reboot";
        
        String output = execCommand(id, restartCommand, 10000);
        
        // Sau khi restart, set status = OFFLINE (se tu dong chuyen thanh ONLINE sau khi server khoi dong lai)
        server.setStatus(ServerEntity.ServerStatus.OFFLINE);
        serverRepository.saveAndFlush(server);
        
        System.out.println("[restartServer] Da gui lenh restart thanh cong");
        return output != null ? output : "Da gui lenh restart den server";
    }
    
    @Override
    public boolean pingServer(Long id, int timeoutMs) {
        ServerEntity server = serverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
        
        String ip = server.getIp();
        Integer port = server.getPort() != null ? server.getPort() : 22;
        
        try (java.net.Socket socket = new java.net.Socket()) {
            java.net.InetSocketAddress addr = new java.net.InetSocketAddress(ip, port);
            socket.connect(addr, timeoutMs);
            System.out.println("[pingServer] Ping thanh cong den server " + ip + ":" + port);
            return true;
        } catch (Exception e) {
            System.out.println("[pingServer] Ping that bai den server " + ip + ":" + port + " - " + e.getMessage());
            return false;
        }
    }
    
    @Override
    public my_spring_app.my_spring_app.dto.reponse.ServerAuthStatusResponse checkServerAuthStatus(Long id) {
        ServerAuthStatusResponse response = new ServerAuthStatusResponse();
        
        try {
            ServerEntity server = serverRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Khong tim thay server voi ID: " + id));
            
            String ip = server.getIp();
            Integer port = server.getPort() != null ? server.getPort() : 22;
            String username = server.getUsername();
            
            // Bước 1: Kiểm tra SSH key
            String privateKeyPem = resolveServerPrivateKeyPem(id);
            boolean hasSshKey = (privateKeyPem != null && !privateKeyPem.trim().isEmpty());
            response.setHasSshKey(hasSshKey);
            
            boolean hasSudoNopasswd = false;
            boolean needsPassword = true;
            String authMethod = "password";
            
            if (hasSshKey) {
                // Có SSH key, kiểm tra kết nối và sudo NOPASSWD
                try {
                    // Kiểm tra kết nối SSH với key
                    boolean canConnect = testSshWithKey(ip, port, username, privateKeyPem, 5000);
                    
                    if (canConnect) {
                        // Kiểm tra sudo NOPASSWD
                        String checkSudoCmd = "sudo -l 2>/dev/null | grep -q 'NOPASSWD' && echo 'HAS_NOPASSWD' || echo 'NO_NOPASSWD'";
                        String sudoCheckResult = execCommandWithKey(ip, port, username, privateKeyPem, checkSudoCmd, 5000);
                        
                        if (sudoCheckResult != null && sudoCheckResult.contains("HAS_NOPASSWD")) {
                            hasSudoNopasswd = true;
                            needsPassword = false;
                            authMethod = "SSH key + sudo NOPASSWD";
                        } else {
                            hasSudoNopasswd = false;
                            needsPassword = true;
                            authMethod = "SSH key (cần sudo password)";
                        }
                    } else {
                        // SSH key không hoạt động
                        hasSudoNopasswd = false;
                        needsPassword = true;
                        authMethod = "SSH key (không kết nối được)";
                    }
                } catch (Exception e) {
                    // Không kiểm tra được với SSH key
                    hasSudoNopasswd = false;
                    needsPassword = true;
                    authMethod = "SSH key (lỗi kiểm tra)";
                    System.err.println("[checkServerAuthStatus] Loi khi kiem tra SSH key: " + e.getMessage());
                }
            } else {
                // Không có SSH key, cần password
                hasSudoNopasswd = false;
                needsPassword = true;
                authMethod = "password";
            }
            
            response.setHasSudoNopasswd(hasSudoNopasswd);
            response.setNeedsPassword(needsPassword);
            response.setAuthMethod(authMethod);
            
        } catch (Exception e) {
            response.setHasSshKey(false);
            response.setHasSudoNopasswd(false);
            response.setNeedsPassword(true);
            response.setAuthMethod("error");
            response.setError("Lỗi khi kiểm tra trạng thái xác thực: " + e.getMessage());
        }
        
        return response;
    }
    
}


