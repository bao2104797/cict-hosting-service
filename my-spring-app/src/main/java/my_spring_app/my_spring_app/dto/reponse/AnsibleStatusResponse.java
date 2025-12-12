package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnsibleStatusResponse {
    private Boolean installed;
    private String version;
    private String controllerHost;
    private String controllerRole; // "ANSIBLE" or "MASTER"
    private String error;
}

