package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateProjectResponse {

    private Long id;
    private String projectName;
    private String description;
    private String uuid_k8s;
    private String namespace;
    private LocalDateTime createdAt;
}

