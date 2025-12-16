package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response trả về khi poll status của install/uninstall task
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstallStatusResponse {
    /**
     * Task ID
     */
    private String taskId;
    
    /**
     * running | completed | failed | not_found
     */
    private String status;
    
    /**
     * Logs tích lũy (tất cả logs từ đầu đến hiện tại)
     */
    private String logs;
    
    /**
     * Thời gian bắt đầu (milliseconds)
     */
    private Long startTime;
    
    /**
     * Thời gian kết thúc (milliseconds, null nếu chưa kết thúc)
     */
    private Long endTime;
    
    /**
     * Lỗi (nếu có)
     */
    private String error;
}

