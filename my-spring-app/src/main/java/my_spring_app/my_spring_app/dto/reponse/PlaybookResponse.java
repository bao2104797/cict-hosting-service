package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlaybookResponse {
    /**
     * Tên file playbook
     */
    private String name;
    
    /**
     * Nội dung playbook
     */
    private String content;
    
    /**
     * Kích thước file (bytes)
     */
    private Long size;
}

