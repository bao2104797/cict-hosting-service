package my_spring_app.my_spring_app.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstallAnsibleRequest {
    /**
     * IP address của controller server (optional, nếu không có sẽ tự động tìm)
     */
    private String controllerHost;
    
    /**
     * Sudo password (optional nếu đã có SSH key + sudo NOPASSWD)
     */
    private String sudoPassword;
}

