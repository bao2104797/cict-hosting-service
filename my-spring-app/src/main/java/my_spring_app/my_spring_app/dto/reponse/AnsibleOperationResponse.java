package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnsibleOperationResponse {
    /**
     * Task ID để theo dõi quá trình
     */
    private String taskId;
    
    /**
     * Thông báo
     */
    private String message;
    
    /**
     * Thành công hay không
     */
    private Boolean success;
    
    /**
     * Lỗi (nếu có)
     */
    private String error;
}

