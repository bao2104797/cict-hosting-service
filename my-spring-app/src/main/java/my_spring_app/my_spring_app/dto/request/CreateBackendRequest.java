package my_spring_app.my_spring_app.dto.request;

import lombok.Data;

@Data
public class CreateBackendRequest {
    private Long backendId;
    private Integer newReplicas;
}

