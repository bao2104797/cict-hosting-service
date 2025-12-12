package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnsibleConfigResponse {
    /**
     * Thành công hay không
     */
    private Boolean success;
    
    /**
     * Controller host
     */
    private String controllerHost;
    
    /**
     * Nội dung file ansible.cfg
     */
    private String ansibleCfg;
    
    /**
     * Nội dung file inventory (hosts)
     */
    private String ansibleInventory;
    
    /**
     * Nội dung file group_vars/all.yml
     */
    private String ansibleVars;
    
    /**
     * Thông báo lỗi (nếu có)
     */
    private String error;
}

