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
public class DeployBackendRequest {

    @NotBlank(message = "Project name không được để trống")
    private String projectName;

    @NotBlank(message = "Deployment type không được để trống")
    private String deploymentType; // DOCKER, FILE

    @NotBlank(message = "Framework type không được để trống")
    private String frameworkType; // SPRINGBOOT, NODEJS

    private String dockerImage; // deploymentType = DOCKER

    private MultipartFile file; // deploymentType = FILE

    @NotBlank(message = "Database ip không được để trống")
    private String databaseIp; // database ip

    private int databasePort; // database port

    @NotBlank(message = "Database name không được để trống")
    private String databaseName; // database name

    @NotBlank(message = "Database username không được để trống")
    private String databaseUsername; // database username

    @NotBlank(message = "Database password không được để trống")
    private String databasePassword; // database password

    @NotBlank(message = "Domain name system không được để trống")
    private String domainNameSystem;

    @NotBlank(message = "Username không được để trống")
    private String username; // username

    @NotNull(message = "Project id không được để trống")
    private Long projectId;
}

