package my_spring_app.my_spring_app.controller;

import jakarta.validation.Valid;
import my_spring_app.my_spring_app.dto.reponse.CreateServerResponse;
import my_spring_app.my_spring_app.dto.reponse.ServerResponse;
import my_spring_app.my_spring_app.dto.reponse.TestSshResponse;
import my_spring_app.my_spring_app.dto.request.CreateServerRequest;
import my_spring_app.my_spring_app.dto.request.UpdateServerRequest;
import my_spring_app.my_spring_app.dto.request.TestSshRequest;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.service.ServerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/servers")
public class ServerController {

    @Autowired
    private ServerService serverService;

    /**
     * Lấy tất cả servers
     */
    @GetMapping
    public ResponseEntity<List<ServerResponse>> getAllServers() {
        return ResponseEntity.ok(serverService.findAll());
    }

    /**
     * Lấy server theo ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<ServerResponse> getServerById(@PathVariable Long id) {
        try {
            ServerResponse response = serverService.findById(id);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Tạo server mới
     */
    @PostMapping
    public ResponseEntity<?> createServer(@Valid @RequestBody CreateServerRequest request) {
        try {
            CreateServerResponse response = serverService.createServer(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "VALIDATION_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi tạo server: " + e.getMessage()));
        }
    }

    /**
     * Cập nhật server
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateServer(@PathVariable Long id, @RequestBody UpdateServerRequest request) {
        try {
            ServerResponse response = serverService.updateServer(id, request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "UPDATE_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi cập nhật server: " + e.getMessage()));
        }
    }

    /**
     * Xóa server
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteServer(@PathVariable Long id) {
        try {
            serverService.deleteServer(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "DELETE_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi xóa server: " + e.getMessage()));
        }
    }

    /**
     * Test SSH connection
     */
    @PostMapping("/test-ssh")
    public ResponseEntity<TestSshResponse> testSsh(@Valid @RequestBody TestSshRequest request) {
        TestSshResponse response = serverService.testSsh(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Kiểm tra và cập nhật trạng thái (status) cho tất cả servers
     * Ping tất cả servers và tự động cập nhật ONLINE/OFFLINE
     * Không cập nhật metrics
     * 
     * @return Danh sách servers đã được cập nhật status
     */
    @PostMapping("/check-status")
    public ResponseEntity<?> checkAllStatuses() {
        try {
            List<ServerResponse> servers = serverService.checkAllStatuses(2000);

            long onlineCount = servers.stream()
                    .filter(s -> "ONLINE".equals(s.getStatus()))
                    .count();
            long offlineCount = servers.stream()
                    .filter(s -> "OFFLINE".equals(s.getStatus()))
                    .count();
            long disabledCount = servers.stream()
                    .filter(s -> "DISABLED".equals(s.getStatus()))
                    .count();

            String message = String.format(
                    "Đã kiểm tra và cập nhật trạng thái %d servers (%d ONLINE, %d OFFLINE, %d DISABLED)",
                    servers.size(), onlineCount, offlineCount, disabledCount
            );
            return ResponseEntity.ok(Map.of(
                    "servers", servers,
                    "message", message
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi kiểm tra status: " + e.getMessage()));
        }
    }

    /**
     * Kiểm tra và cập nhật trạng thái (status) và metrics cho tất cả servers
     * - Ping tất cả servers và cập nhật status ONLINE/OFFLINE
     * - Lấy và cập nhật metrics (CPU cores, RAM total, Disk total) từ SSH output cho servers ONLINE
     * - Metrics được lấy trực tiếp từ SSH commands qua JSCH
     * 
     * @return Danh sách servers đã được cập nhật status và metrics
     */
    @PostMapping("/check-all")
    public ResponseEntity<?> checkAllServers() {
        try {
            List<ServerResponse> servers = serverService.checkAllServers();

            // Tách server theo trạng thái metrics để trả về thống kê (BE chỉ trả data, FE tự format message)
            List<ServerResponse> successServers = servers.stream()
                    .filter(s -> s.getCpuCores() != null
                            || s.getRamTotal() != null
                            || s.getDiskTotal() != null)
                    .toList();
            List<ServerResponse> failServers = servers.stream()
                    .filter(s -> s.getCpuCores() == null
                            && s.getRamTotal() == null
                            && s.getDiskTotal() == null)
                    .toList();

            int successCount = successServers.size();
            int failCount = failServers.size();

            return ResponseEntity.ok(Map.of(
                    "servers", servers,
                    "stats", Map.of(
                            "total", servers.size(),
                            "success", successCount,
                            "fail", failCount
                    )
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi kiểm tra servers: " + e.getMessage()));
        }
    }

    /**
     * Cập nhật trạng thái server (ONLINE/OFFLINE/DISABLED)
     */
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateServerStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            String statusStr = body.get("status");
            if (statusStr == null || statusStr.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "VALIDATION_ERROR", "message", "Status không được để trống"));
            }
            
            ServerEntity.ServerStatus status;
            try {
                status = ServerEntity.ServerStatus.valueOf(statusStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "VALIDATION_ERROR", "message", "Status không hợp lệ. Chỉ hỗ trợ ONLINE, OFFLINE, DISABLED"));
            }
            
            ServerResponse response = serverService.updateServerStatus(id, status);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "UPDATE_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi cập nhật status: " + e.getMessage()));
        }
    }

    /**
     * Ping một server cụ thể để kiểm tra kết nối
     */
    @PostMapping("/{id}/ping")
    public ResponseEntity<?> pingServer(@PathVariable Long id, @RequestBody(required = false) Map<String, Integer> body) {
        try {
            int timeoutMs = body != null && body.get("timeoutMs") != null ? body.get("timeoutMs") : 2000;
            boolean isReachable = serverService.pingServer(id, timeoutMs);
            return ResponseEntity.ok(Map.of(
                    "success", isReachable,
                    "message", isReachable ? "Server có thể ping được" : "Không thể ping đến server"
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "PING_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi ping server: " + e.getMessage()));
        }
    }

    /**
     * Reconnect đến server
     * Ưu tiên dùng SSH key nếu có, nếu không thì yêu cầu password
     */
    @PostMapping("/{id}/reconnect")
    public ResponseEntity<?> reconnectServer(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            String password = body.get("password"); // Optional nếu đã có SSH key
            ServerResponse response = serverService.reconnectServer(id, password);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "CONNECTION_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi reconnect server: " + e.getMessage()));
        }
    }

    /**
     * Disconnect server (set status = DISABLED)
     */
    @PostMapping("/{id}/disconnect")
    public ResponseEntity<?> disconnectServer(@PathVariable Long id) {
        try {
            ServerResponse response = serverService.disconnectServer(id);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "DISCONNECT_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi disconnect server: " + e.getMessage()));
        }
    }

    /**
     * Thực thi command trên server qua SSH (CLI)
     */
    @PostMapping("/{id}/exec")
    public ResponseEntity<?> execCommand(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            String command = (String) body.get("command");
            if (command == null || command.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "VALIDATION_ERROR", "message", "Command không được để trống"));
            }
            
            Integer timeoutMs = body.get("timeoutMs") != null 
                ? ((Number) body.get("timeoutMs")).intValue() 
                : 10000; // Default 10 seconds
            
            String output = serverService.execCommand(id, command, timeoutMs);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "output", output != null ? output : "",
                    "message", "Command đã được thực thi thành công"
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "EXEC_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi thực thi command: " + e.getMessage()));
        }
    }

    /**
     * Shutdown server qua SSH
     */
    @PostMapping("/{id}/shutdown")
    public ResponseEntity<?> shutdownServer(@PathVariable Long id) {
        try {
            String output = serverService.shutdownServer(id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã gửi lệnh shutdown đến server. Server sẽ tắt sau vài giây.",
                    "output", output != null ? output : ""
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "SHUTDOWN_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi shutdown server: " + e.getMessage()));
        }
    }

    /**
     * Restart server qua SSH
     */
    @PostMapping("/{id}/restart")
    public ResponseEntity<?> restartServer(@PathVariable Long id) {
        try {
            String output = serverService.restartServer(id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã gửi lệnh restart đến server. Server sẽ khởi động lại sau vài giây.",
                    "output", output != null ? output : ""
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "RESTART_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi restart server: " + e.getMessage()));
        }
    }
}


