package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO cho việc kiểm tra trạng thái xác thực của server
 * (SSH key và sudo NOPASSWD)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ServerAuthStatusResponse {
    /**
     * Có SSH key hay không
     */
    private boolean hasSshKey;
    
    /**
     * Có sudo NOPASSWD hay không (chỉ có giá trị nếu hasSshKey = true)
     */
    private Boolean hasSudoNopasswd;
    
    /**
     * Có cần password hay không
     */
    private boolean needsPassword;
    
    /**
     * Phương thức xác thực được sử dụng
     */
    private String authMethod;
    
    /**
     * Thông báo lỗi (nếu có)
     */
    private String error;
}

