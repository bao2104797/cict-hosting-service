package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ListProjectBackendResponse {

    private List<ProjectBackendItem> projectBackends;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProjectBackendItem {
        private Long id;
        private String projectName;
        private String frameworkType;
        private String deploymentType;
        private String domainNameSystem;
        private String dockerImage;
        private String sourcePath;
        private String deploymentPath;
        private String databaseIp;
        private Integer databasePort;
        private String databaseName;
        private String databaseUsername;
        private String databasePassword;
        private String status;
        private LocalDateTime createdAt;
    }
}

