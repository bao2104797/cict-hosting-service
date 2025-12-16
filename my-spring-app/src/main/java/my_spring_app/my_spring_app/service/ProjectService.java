package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.CreateProjectResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectBackendListResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectBasicInfoResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectDatabaseListResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectFrontendListResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectOverviewResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectSummaryResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectDeploymentHistoryResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectRequestHistoryResponse;
import my_spring_app.my_spring_app.dto.request.CreateProjectRequest;

public interface ProjectService {
    
    CreateProjectResponse createProject(CreateProjectRequest request);
    
    ProjectSummaryResponse getUserProjects(String username);
    
    ProjectDetailResponse getProjectDetail(Long projectId, String username);
    
    ProjectBasicInfoResponse getProjectBasicInfo(Long projectId);
    
    ProjectOverviewResponse getProjectOverview(Long projectId);
    
    ProjectDatabaseListResponse getProjectDatabases(Long projectId);
    
    ProjectBackendListResponse getProjectBackends(Long projectId);
    
    ProjectFrontendListResponse getProjectFrontends(Long projectId);
    
    void deleteProject(Long projectId, String username);
    
    ProjectDeploymentHistoryResponse getProjectDeploymentHistory(Long projectId);
    
    ProjectRequestHistoryResponse getProjectRequestHistory(Long projectId);
}

