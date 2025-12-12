package my_spring_app.my_spring_app.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExecutePlaybookRequest {
    /**
     * IP address của controller server (optional)
     */
    private String controllerHost;
    
    /**
     * Sudo password (optional)
     */
    private String sudoPassword;
    
    /**
     * Tên file playbook cần thực thi
     */
    private String filename;
    
    /**
     * Extra variables (optional, format: key1=value1 key2=value2)
     */
    private String extraVars;
}

