package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserProjectSummaryResponse {
    private Long userId;
    private String fullname;
    private String username;
    private int projectCount;
    private double cpuCores;
    private double memoryGb;
}

