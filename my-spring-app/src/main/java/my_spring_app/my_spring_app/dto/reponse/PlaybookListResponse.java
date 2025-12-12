package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlaybookListResponse {
    /**
     * Danh sách playbooks
     */
    private List<PlaybookResponse> playbooks;
    
    /**
     * Tổng số playbooks
     */
    private Integer total;
}

