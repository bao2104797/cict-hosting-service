package my_spring_app.my_spring_app.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateServerRequest {

    private String name;

    private String ip;

    private Integer port;

    private String username;

    private String password; // Optional - chỉ cần khi thay đổi password

    private String role; // MASTER, WORKER, DOCKER, ANSIBLE

    private String status; // ONLINE, OFFLINE, DISABLED

    private String serverStatus; // RUNNING, STOPPED, BUILDING, ERROR

    private String clusterStatus; // AVAILABLE, UNAVAILABLE

    // Metrics (optional)
    private String cpuCores;
    private String ramTotal;
    private String diskTotal;
}

