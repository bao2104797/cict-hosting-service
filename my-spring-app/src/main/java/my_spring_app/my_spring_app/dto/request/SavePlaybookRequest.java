package my_spring_app.my_spring_app.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SavePlaybookRequest {
    /**
     * IP address của controller server (optional)
     */
    private String controllerHost;
    
    /**
     * Sudo password (optional)
     */
    private String sudoPassword;
    
    /**
     * Tên file playbook (có thể có hoặc không có extension .yml/.yaml)
     */
    private String filename;
    
    /**
     * Nội dung playbook
     */
    private String content;
}

