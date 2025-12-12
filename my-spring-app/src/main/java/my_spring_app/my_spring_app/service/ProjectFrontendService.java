package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.DeployFrontendResponse;
import my_spring_app.my_spring_app.dto.reponse.FrontendReplicaInfoResponse;
import my_spring_app.my_spring_app.dto.request.DeployFrontendRequest;

public interface ProjectFrontendService {
    
    DeployFrontendResponse deploy(DeployFrontendRequest request);
    
    void stopFrontend(Long projectId, Long frontendId);
    
    void startFrontend(Long projectId, Long frontendId);
    
    void deleteFrontend(Long projectId, Long frontendId);

    FrontendReplicaInfoResponse getFrontendReplicaInfo(Long frontendId);
}

