package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminProjectResourceDetailResponse {
    private Long projectId;
    private String projectName;
    private double totalCpuCores;
    private double totalMemoryGb;
    private List<ComponentUsage> databases = new ArrayList<>();
    private List<ComponentUsage> backends = new ArrayList<>();
    private List<ComponentUsage> frontends = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComponentUsage {
        private Long id;
        private String projectName;
        private String status;
        private double cpuCores;
        private double memoryGb;
    }
}

