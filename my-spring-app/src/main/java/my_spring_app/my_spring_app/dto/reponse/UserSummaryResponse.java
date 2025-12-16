package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserSummaryResponse {

    private Long id;
    private String name;
    private String username;
    private String email;
    private String role;
    private String tier;
    private String status;
    private Long projectCount;
    private Long services;
    private LocalDateTime createdAt;
    private LocalDateTime lastLogin;
}


