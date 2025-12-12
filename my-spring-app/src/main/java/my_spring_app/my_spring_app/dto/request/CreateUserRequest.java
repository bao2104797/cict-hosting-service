package my_spring_app.my_spring_app.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateUserRequest {

    @NotBlank(message = "Fullname không được để trống")
    @Size(min = 2, max = 100, message = "Fullname phải có từ 2 đến 100 ký tự")
    private String fullname;

    @NotBlank(message = "Username không được để trống")
    @Size(min = 1, max = 50, message = "Username phải có từ 1 đến 50 ký tự")
    private String username;

    @NotBlank(message = "Password không được để trống")
    @Size(min = 1, message = "Password phải có ít nhất 1 ký tự")
    private String password;

    @NotBlank(message = "Confirm Password không được để trống")
    @Size(min = 1, message = "Confirm Password phải có ít nhất 1 ký tự")
    private String confirmPassword;

    // Tier: STANDARD, PREMIUM (mặc định là STANDARD nếu không cung cấp)
    private String tier; // STANDARD, PREMIUM
}

