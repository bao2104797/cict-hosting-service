package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GetUserProjectsResponse {
    
    private List<ProjectItem> projects;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProjectItem {
        private Long id;
        private String projectName;
        private String projectType; // FRONTEND, BACKEND, DATABASE
        private String frameworkType; // REACT, VUE, ANGULAR, SPRING, NODEJS, MYSQL, MONGODB
        private String deploymentType; // DOCKER, FILE (chỉ có cho FRONTEND, BACKEND)
        private String domainNameSystem; // URL của project (chỉ có cho FRONTEND, BACKEND)
        private String status; // RUNNING, STOPPED, ERROR, BUILDING
        private LocalDateTime createdAt;
        // Thông tin database (chỉ có cho BACKEND, DATABASE)
        private String databaseIp;
        private Integer databasePort;
        private String databaseName;
        private String databaseUsername;
        private String databasePassword;
        // Thông tin deployment (chỉ có cho FRONTEND, BACKEND)
        private String dockerImage;
        private String sourcePath;
        private String deploymentPath;
        // Thông tin database file (chỉ có cho DATABASE)
        private String databaseFile;
    }
}

