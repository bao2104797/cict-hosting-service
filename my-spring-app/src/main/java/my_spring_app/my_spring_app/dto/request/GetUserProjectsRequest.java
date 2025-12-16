package my_spring_app.my_spring_app.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GetUserProjectsRequest {
    
    @NotBlank(message = "Username không được để trống")
    private String username;
}

