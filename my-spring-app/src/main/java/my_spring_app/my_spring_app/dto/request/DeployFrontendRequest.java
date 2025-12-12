package my_spring_app.my_spring_app.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.multipart.MultipartFile;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeployFrontendRequest {

    @NotBlank(message = "Project name không được để trống")
    private String projectName;

    @NotBlank(message = "Deployment type không được để trống")
    private String deploymentType; // DOCKER, FILE

    @NotBlank(message = "Framework không được để trống")
    private String frameworkType; // REACT, VUE, ANGULAR

    private String dockerImage; // deploymentType = DOCKER

    private MultipartFile file; // deploymentType = FILE

    @NotBlank(message = "Domain name system không được để trống")
    private String domainNameSystem;

    @NotBlank(message = "Username không được để trống")
    private String username;

    @NotNull(message = "Project id không được để trống")
    private Long projectId;
}
