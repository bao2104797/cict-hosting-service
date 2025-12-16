package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeployDatabaseResponse {

    private String status; // RUNNING, ERROR
    private String databaseIp; // IP của database server
    private Integer databasePort; // Port của database server
    private String databaseName; // Tên database (UUID)
    private String databaseUsername; // Username database (UUID)
    private String databasePassword; // Password database (username của user)
}

