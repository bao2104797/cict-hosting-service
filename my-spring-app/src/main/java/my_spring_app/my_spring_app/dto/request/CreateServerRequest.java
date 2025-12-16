package my_spring_app.my_spring_app.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateServerRequest {

    @NotBlank(message = "Name không được để trống")
    private String name;

    @NotBlank(message = "IP không được để trống")
    private String ip;

    @NotNull(message = "Port không được để trống")
    private Integer port;

    @NotBlank(message = "Username không được để trống")
    private String username;

    @NotBlank(message = "Password không được để trống")
    private String password;

    @NotBlank(message = "Role không được để trống")
    private String role; // MASTER, WORKER, DOCKER, DATABASE

    @NotBlank(message = "Server status không được để trống")
    private String serverStatus; // RUNNING, STOPPED, BUILDING, ERROR

    @NotBlank(message = "Cluster status không được để trống")
    private String clusterStatus; // AVAILABLE, UNAVAILABLE
}

