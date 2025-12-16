package my_spring_app.my_spring_app.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateProjectRequest {

    @NotBlank(message = "Project name không được để trống")
    @Size(min = 1, max = 100, message = "Project name phải có từ 1 đến 100 ký tự")
    private String projectName;

    private String description;

    @NotBlank(message = "Username không được để trống")
    private String username;
}

