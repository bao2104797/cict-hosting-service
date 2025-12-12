package my_spring_app.my_spring_app.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeletePlaybookRequest {
    /**
     * IP address của controller server (optional)
     */
    private String controllerHost;
    
    /**
     * Sudo password (optional)
     */
    private String sudoPassword;
    
    /**
     * Tên file playbook cần xóa
     */
    private String filename;
}

