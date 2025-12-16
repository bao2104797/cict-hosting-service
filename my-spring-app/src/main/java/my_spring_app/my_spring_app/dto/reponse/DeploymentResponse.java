package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeploymentResponse {
    private String id;
    private String name;
    private String namespace;
    private ReplicasInfo replicas;
    private String status; // running, error, pending
    private String image; // Chỉ lấy image đầu tiên cho danh sách
    private String age;
    private String cpu;
    private String memory;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReplicasInfo {
        private Integer desired;
        private Integer ready;
        private Integer updated;
        private Integer available;
    }
}

