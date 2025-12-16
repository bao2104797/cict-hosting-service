package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectOverviewResponse {
    
    private Long id;
    private String projectName;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String uuid_k8s;
    private String namespace;
    
    private ComponentStats databases;
    private ComponentStats backends;
    private ComponentStats frontends;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComponentStats {
        private Integer total;
        private Integer running;
        private Integer paused;
        private Integer stopped;
        private Integer error;
    }
}

