package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectDatabaseListResponse {
    
    private List<DatabaseInfo> databases;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DatabaseInfo {
        private Long id;
        private String projectName;
        private String description;
        private String databaseType; // MYSQL, MONGODB
        private String databaseIp;
        private Integer databasePort;
        private String databaseName;
        private String databaseUsername;
        private String databasePassword;
        private String status; // RUNNING, STOPPED, ERROR
        private LocalDateTime createdAt;
    }
}

