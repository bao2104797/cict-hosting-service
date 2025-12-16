package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ListProjectFrontendResponse {

    private List<ProjectFrontendItem> projectFrontends;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProjectFrontendItem {
        private Long id;
        private String projectName;
        private String frameworkType;
        private String deploymentType;
        private String domainNameSystem;
        private String dockerImage;
        private String sourcePath;
        private String deploymentPath;  
        private String status;
        private LocalDateTime createdAt;
    }
}

