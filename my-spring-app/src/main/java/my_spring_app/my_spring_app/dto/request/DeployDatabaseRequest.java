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
public class DeployDatabaseRequest {

    @NotBlank(message = "Project name không được để trống")
    private String projectName;

    @NotBlank(message = "Framework type không được để trống")
    private String databaseType; // MYSQL, MONGODB

    @NotBlank(message = "Database name không được để trống")
    private String databaseName;

    @NotBlank(message = "Database username không được để trống")
    private String databaseUsername;

    @NotBlank(message = "Database password không được để trống")
    private String databasePassword;

    private MultipartFile file;

    @NotBlank(message = "username không được để trống")
    private String username;

    @NotNull(message = "Project id không được để trống")
    private Long projectId;

}

