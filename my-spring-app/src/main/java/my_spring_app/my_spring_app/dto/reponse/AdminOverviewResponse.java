package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminOverviewResponse {
    private Long totalUsers;
    private Long totalProjects;
    private Double totalCpuCores;
    private Double totalMemoryGb;
}

