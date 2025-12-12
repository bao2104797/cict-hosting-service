package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ListProjectDatabaseResponse {

    private List<ProjectDatabaseItem> projectDatabases;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProjectDatabaseItem {
        private Long id;
        private String projectName;
        private String databaseType;
        private String databaseIp;
        private Integer databasePort;
        private String databaseUsername;
        private String databasePassword;
        private String databaseName;
        private String databaseFile;
        private String status;
        private LocalDateTime createdAt;
    }
}

