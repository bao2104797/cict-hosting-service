package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateServerResponse {

    private Long id;
    private String name;
    private String ip;
    private Integer port;
    private String username;
    private String role;
    private String status; // ONLINE, OFFLINE, DISABLED
    private String serverStatus; // RUNNING, STOPPED, BUILDING, ERROR
    private String clusterStatus; // AVAILABLE, UNAVAILABLE
    private LocalDateTime createdAt;
    
    // Metrics (optional - có thể null nếu chưa lấy được) - chỉ trả về total, không trả về used
    private String cpuCores;
    private String ramTotal;
    private String diskTotal;
}

