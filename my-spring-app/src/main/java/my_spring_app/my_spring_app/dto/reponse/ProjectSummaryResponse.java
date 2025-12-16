package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectSummaryResponse {
    
    private List<ProjectSummaryItem> projects;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProjectSummaryItem {
        private Long id;
        private String projectName;
        private String description;
        private Integer databaseCount;
        private Integer backendCount;
        private Integer frontendCount;
        private LocalDateTime updatedAt;
    }
}

