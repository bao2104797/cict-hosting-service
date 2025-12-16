package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response trả về khi bắt đầu một install/uninstall task
 * Chứa taskId để frontend có thể poll status
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstallTaskResponse {
    /**
     * Task ID để theo dõi quá trình
     */
    private String taskId;
    
    /**
     * Trạng thái ban đầu (luôn là "running")
     */
    private String status;
    
    /**
     * Thông báo
     */
    private String message;
}

