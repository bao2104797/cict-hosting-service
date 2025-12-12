package my_spring_app.my_spring_app.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InitAnsibleRequest {
    /**
     * IP address của controller server (optional, nếu không có sẽ tự động tìm)
     */
    private String controllerHost;
    
    /**
     * Sudo password (optional nếu đã có SSH key + sudo NOPASSWD)
     */
    private String sudoPassword;
    
    /**
     * Danh sách server IDs để khởi tạo (optional, nếu không có sẽ lấy tất cả servers trong cluster)
     */
    private List<Long> serverIds;
    
    /**
     * Ansible config content (cho step 2)
     */
    private String ansibleCfg;
    
    /**
     * Ansible inventory content (cho step 2)
     */
    private String ansibleInventory;
    
    /**
     * Ansible vars content (cho step 2)
     */
    private String ansibleVars;
}

