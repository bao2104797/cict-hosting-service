package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeployBackendResponse {

    private String url; // url of the project
    private String status; // RUNNING, STOPPED, ERROR
    private String domainNameSystem; // domain name system
}
