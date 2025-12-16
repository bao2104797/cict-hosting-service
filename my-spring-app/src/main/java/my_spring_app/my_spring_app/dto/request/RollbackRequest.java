package my_spring_app.my_spring_app.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RollbackRequest {
    private Integer toRevision; // null hoặc 0 = rollback về revision trước, > 0 = rollback về revision cụ thể
}

