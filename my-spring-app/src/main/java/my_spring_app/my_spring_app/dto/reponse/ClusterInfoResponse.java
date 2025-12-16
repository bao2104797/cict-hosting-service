package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClusterInfoResponse {
    private Integer nodeCount;        // Số lượng nodes (MASTER + WORKER với cluster_status=AVAILABLE)
    private String status;             // "healthy" hoặc "unhealthy" (dựa trên status ONLINE/OFFLINE)
    private String version;            // Kubernetes version từ kubectl get nodes
}

