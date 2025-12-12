package my_spring_app.my_spring_app.dto.reponse;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class FrontendRequestResponse {
    private Long id;
    private Long frontendId;
    private String frontendName;
    private String projectName;
    private String username;
    private Integer oldReplicas;
    private Integer newReplicas;
    private String status;
    private String reasonReject;
    private LocalDateTime createdAt;
}

