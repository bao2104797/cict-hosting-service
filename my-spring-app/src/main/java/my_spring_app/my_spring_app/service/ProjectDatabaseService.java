package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.DeployDatabaseResponse;
import my_spring_app.my_spring_app.dto.request.DeployDatabaseRequest;

public interface ProjectDatabaseService {

    DeployDatabaseResponse deploy(DeployDatabaseRequest request);

    void stopDatabase(Long projectId, Long databaseId);

    void startDatabase(Long projectId, Long databaseId);

    void deleteDatabase(Long projectId, Long databaseId);
}

