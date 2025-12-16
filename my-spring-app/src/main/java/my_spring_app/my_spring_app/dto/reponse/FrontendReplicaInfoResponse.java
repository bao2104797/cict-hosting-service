package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FrontendReplicaInfoResponse {
    private Long frontendId;
    private Integer replicas;
    private Integer maxReplicas;
    private boolean hasPendingRequest;
    private Long pendingRequestId;
    private Integer pendingNewReplicas;
    private String pendingStatus;
    private String message;
}

