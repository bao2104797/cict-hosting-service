package my_spring_app.my_spring_app.dto.request;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserRequest {

    @Size(min = 2, max = 100, message = "Fullname phải có từ 2 đến 100 ký tự")
    private String fullname;

    // Tier: STANDARD, PREMIUM
    private String tier; // STANDARD, PREMIUM

    // Role: ADMIN, USER
    private String role; // ADMIN, USER
}

