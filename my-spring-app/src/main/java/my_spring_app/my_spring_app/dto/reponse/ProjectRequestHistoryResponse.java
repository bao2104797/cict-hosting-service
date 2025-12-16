package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectRequestHistoryResponse {
    
    private Long projectId;
    private String projectName;
    
    private List<RequestHistoryItem> requestItems;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RequestHistoryItem {
        private String type; // "BACKEND", "FRONTEND"
        private Long id;
        private Long componentId; // ID của backend hoặc frontend
        private String componentName; // Tên của backend hoặc frontend
        private Integer oldReplicas;
        private Integer newReplicas;
        private String status; // "PENDING", "APPROVED", "REJECTED"
        private String reasonReject; // Lý do từ chối (nếu có)
        private LocalDateTime createdAt;
    }
}

