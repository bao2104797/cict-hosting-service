package my_spring_app.my_spring_app.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerifyAnsibleConfigRequest {
    /**
     * IP address của controller server (optional)
     */
    private String controllerHost;
    
    /**
     * Ansible config content
     */
    private String ansibleCfg;
    
    /**
     * Ansible inventory content
     */
    private String ansibleInventory;
    
    /**
     * Ansible vars content
     */
    private String ansibleVars;
}

