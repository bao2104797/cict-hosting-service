package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnsibleTaskStatusResponse {
    private boolean success;
    private String taskId;
    /**
     * running | completed | failed | not_found
     */
    private String status;
    /**
     * Current progress percentage (0-100)
     */
    private Integer progress;
    private String logs;
    private Long startTime;
    private Long endTime;
    private String error;
}

