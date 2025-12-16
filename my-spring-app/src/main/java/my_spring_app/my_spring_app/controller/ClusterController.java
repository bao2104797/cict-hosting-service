package my_spring_app.my_spring_app.controller;

import my_spring_app.my_spring_app.service.ServerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cluster")
public class ClusterController {

    @Autowired
    private ServerService serverService;

    /**
     * Assign servers vào cluster (set clusterStatus = "AVAILABLE")
     * Body: { "updates": [{"serverId": "1", "role": "MASTER"}, ...] }
     */
    @PostMapping("/assign")
    public ResponseEntity<?> assignServersToCluster(@RequestBody Map<String, Object> body) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> updates = (List<Map<String, Object>>) body.get("updates");
            
            if (updates == null || updates.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "VALIDATION_ERROR", "message", "Danh sách updates không được để trống"));
            }

            // Validate và assign từng server
            for (Map<String, Object> update : updates) {
                Object serverIdObj = update.get("serverId");
                Object roleObj = update.get("role");
                
                if (serverIdObj == null) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "VALIDATION_ERROR", "message", "serverId không được để trống"));
                }
                
                Long serverId;
                try {
                    serverId = Long.parseLong(serverIdObj.toString());
                } catch (NumberFormatException e) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "VALIDATION_ERROR", "message", "serverId không hợp lệ: " + serverIdObj));
                }
                
                String role = roleObj != null ? roleObj.toString().toUpperCase() : "WORKER";
                
                // Validate role
                if (!isValidRole(role)) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "VALIDATION_ERROR", "message", "Role không hợp lệ: " + role));
                }
                
                // Lấy thông tin server để log
                my_spring_app.my_spring_app.dto.reponse.ServerResponse serverInfo = serverService.findById(serverId);
                String username = serverInfo.getUsername() != null ? serverInfo.getUsername() : (serverInfo.getName() != null ? serverInfo.getName() : "server-" + serverId);
                String ip = serverInfo.getIp() != null ? serverInfo.getIp() : "unknown";
                
                // Update server với clusterStatus = "AVAILABLE" và role
                System.out.println("[ClusterController] assignServersToCluster() - Cap nhat server: " + username + " (IP: " + ip + ") - role=" + role + ", clusterStatus=AVAILABLE");
                my_spring_app.my_spring_app.dto.request.UpdateServerRequest updateRequest = 
                        new my_spring_app.my_spring_app.dto.request.UpdateServerRequest();
                updateRequest.setClusterStatus("AVAILABLE");
                updateRequest.setRole(role);
                
                serverService.updateServer(serverId, updateRequest);
                System.out.println("[ClusterController] assignServersToCluster() - Da cap nhat thanh cong server: " + username + " (IP: " + ip + ")");
            }
            
            return ResponseEntity.ok(Map.of("message", "Đã gán " + updates.size() + " server vào cluster"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "ASSIGN_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi gán servers: " + e.getMessage()));
        }
    }

    /**
     * Cập nhật role cho servers đã trong cluster (giữ nguyên clusterStatus = "AVAILABLE")
     * Body: { "updates": [{"serverId": "1", "role": "WORKER"}, ...] }
     */
    @PostMapping("/update-roles")
    public ResponseEntity<?> updateServerRoles(@RequestBody Map<String, Object> body) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> updates = (List<Map<String, Object>>) body.get("updates");
            
            if (updates == null || updates.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "VALIDATION_ERROR", "message", "Danh sách updates không được để trống"));
            }

            // Validate và update role cho từng server
            for (Map<String, Object> update : updates) {
                Object serverIdObj = update.get("serverId");
                Object roleObj = update.get("role");
                
                if (serverIdObj == null || roleObj == null) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "VALIDATION_ERROR", "message", "serverId và role không được để trống"));
                }
                
                Long serverId;
                try {
                    serverId = Long.parseLong(serverIdObj.toString());
                } catch (NumberFormatException e) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "VALIDATION_ERROR", "message", "serverId không hợp lệ: " + serverIdObj));
                }
                
                String role = roleObj.toString().toUpperCase();
                
                // Validate role
                if (!isValidRole(role)) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "VALIDATION_ERROR", "message", "Role không hợp lệ: " + role));
                }
                
                // Kiểm tra server có trong cluster không (clusterStatus = "AVAILABLE")
                my_spring_app.my_spring_app.dto.reponse.ServerResponse server = serverService.findById(serverId);
                if (!"AVAILABLE".equals(server.getClusterStatus())) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "VALIDATION_ERROR", 
                                    "message", "Server " + serverId + " chưa trong cluster. Vui lòng assign trước."));
                }
                
                // Update chỉ role, giữ nguyên clusterStatus
                my_spring_app.my_spring_app.dto.request.UpdateServerRequest updateRequest = 
                        new my_spring_app.my_spring_app.dto.request.UpdateServerRequest();
                updateRequest.setRole(role);
                // Không set clusterStatus để giữ nguyên giá trị hiện tại
                
                serverService.updateServer(serverId, updateRequest);
            }
            
            return ResponseEntity.ok(Map.of("message", "Đã cập nhật role cho " + updates.size() + " server"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "UPDATE_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi cập nhật roles: " + e.getMessage()));
        }
    }

    /**
     * Unassign servers khỏi cluster (set clusterStatus = "UNAVAILABLE")
     * Body: { "serverIds": ["1", "2", ...] }
     */
    @PostMapping("/unassign")
    public ResponseEntity<?> unassignServersFromCluster(@RequestBody Map<String, Object> body) {
        try {
            @SuppressWarnings("unchecked")
            List<Object> serverIdsObj = (List<Object>) body.get("serverIds");
            
            if (serverIdsObj == null || serverIdsObj.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "VALIDATION_ERROR", "message", "Danh sách serverIds không được để trống"));
            }

            // Validate và unassign từng server
            for (Object serverIdObj : serverIdsObj) {
                if (serverIdObj == null) {
                    continue;
                }
                
                Long serverId;
                try {
                    serverId = Long.parseLong(serverIdObj.toString());
                } catch (NumberFormatException e) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "VALIDATION_ERROR", "message", "serverId không hợp lệ: " + serverIdObj));
                }
                
                // Kiểm tra server có trong cluster không
                my_spring_app.my_spring_app.dto.reponse.ServerResponse server = serverService.findById(serverId);
                
                // Kiểm tra nếu đang xóa tất cả MASTER
                if ("MASTER".equals(server.getRole()) && "AVAILABLE".equals(server.getClusterStatus())) {
                    // Đếm số MASTER còn lại sau khi unassign server này
                    List<my_spring_app.my_spring_app.dto.reponse.ServerResponse> allServers = serverService.findAll();
                    long remainingMasterCount = allServers.stream()
                            .filter(s -> "MASTER".equals(s.getRole()) && "AVAILABLE".equals(s.getClusterStatus()))
                            .count();
                    
                    if (remainingMasterCount <= 1) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "VALIDATION_ERROR", 
                                        "message", "Không thể bỏ server MASTER này. Phải có ít nhất 1 MASTER trong cluster."));
                    }
                }
                
                // Update server với clusterStatus = "UNAVAILABLE"
                my_spring_app.my_spring_app.dto.request.UpdateServerRequest updateRequest = 
                        new my_spring_app.my_spring_app.dto.request.UpdateServerRequest();
                updateRequest.setClusterStatus("UNAVAILABLE");
                // Giữ nguyên role
                
                serverService.updateServer(serverId, updateRequest);
            }
            
            return ResponseEntity.ok(Map.of("message", "Đã bỏ " + serverIdsObj.size() + " server khỏi cluster"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "UNASSIGN_ERROR", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Lỗi khi bỏ servers khỏi cluster: " + e.getMessage()));
        }
    }

    /**
     * Validate role
     */
    private boolean isValidRole(String role) {
        if (role == null) {
            return false;
        }
        String upperRole = role.toUpperCase();
        return "MASTER".equals(upperRole) || 
               "WORKER".equals(upperRole) || 
               "DOCKER".equals(upperRole) || 
               "ANSIBLE".equals(upperRole) ||
               "DATABASE".equals(upperRole);
    }
}

