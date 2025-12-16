package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectDeploymentHistoryResponse {
    
    private Long projectId;
    private String projectName;
    private LocalDateTime projectCreatedAt;
    
    private List<DeploymentHistoryItem> historyItems;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeploymentHistoryItem {
        private String type; // "PROJECT", "DATABASE", "BACKEND", "FRONTEND"
        private Long id;
        private String name;
        private String description;
        private LocalDateTime createdAt;
        
        // Thông tin bổ sung tùy theo type
        private String databaseType; // Cho DATABASE
        private String frameworkType; // Cho BACKEND, FRONTEND
        private String deploymentType; // Cho BACKEND, FRONTEND
    }
}

