package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExecuteCommandResponse {

    private boolean success;
    private String output;
    private String error;
    private String command;
    private Integer exitStatus;
}

