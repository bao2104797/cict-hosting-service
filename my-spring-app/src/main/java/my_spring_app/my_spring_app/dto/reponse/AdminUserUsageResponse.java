package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserUsageResponse {
    private List<UserUsageItem> users;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserUsageItem {
        private Long id;
        private String fullname;
        private String username;
        private int projectCount;
        private String tier;
        private double cpuCores;
        private double memoryGb;
    }
}

