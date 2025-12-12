package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserProjectListResponse {
    private Long userId;
    private String fullname;
    private String username;
    private List<ProjectUsageItem> projects;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProjectUsageItem {
        private Long projectId;
        private String projectName;
        private int databaseCount;
        private int backendCount;
        private int frontendCount;
        private double cpuCores;
        private double memoryGb;
    }
}

