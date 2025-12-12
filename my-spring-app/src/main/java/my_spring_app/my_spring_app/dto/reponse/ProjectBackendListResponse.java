package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectBackendListResponse {
    
    private List<BackendInfo> backends;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BackendInfo {
        private Long id;
        private String projectName;
        private String description;
        private String deploymentType; // DOCKER, FILE
        private String frameworkType; // SPRING, NODEJS
        private String databaseIp;
        private Integer databasePort;
        private String databaseName;
        private String databaseUsername;
        private String databasePassword;
        private String uuid_k8s;
        private String sourcePath;
        private String yamlPath;
        private String dockerImage;
        private String domainNameSystem;
        private String status; // RUNNING, STOPPED, ERROR
        private LocalDateTime createdAt;
    }
}

