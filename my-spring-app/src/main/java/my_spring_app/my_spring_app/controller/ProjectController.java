package my_spring_app.my_spring_app.controller;

import jakarta.validation.Valid;
import my_spring_app.my_spring_app.dto.reponse.CreateProjectResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectBackendListResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectBasicInfoResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectDatabaseListResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectFrontendListResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectOverviewResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectSummaryResponse;
import my_spring_app.my_spring_app.dto.reponse.ProjectDeploymentHistoryResponse;
import my_spring_app.my_spring_app.dto.request.CreateProjectRequest;
import my_spring_app.my_spring_app.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Autowired
    private ProjectService projectService;

    @PostMapping
    public ResponseEntity<CreateProjectResponse> createProject(@Valid @RequestBody CreateProjectRequest request) {
        CreateProjectResponse response = projectService.createProject(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<ProjectSummaryResponse> getUserProjects(@RequestParam String username) {
        ProjectSummaryResponse response = projectService.getUserProjects(username);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectDetailResponse> getProjectDetail(
            @PathVariable Long id,
            @RequestParam String username) {
        ProjectDetailResponse response = projectService.getProjectDetail(id, username);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/basic-info")
    public ResponseEntity<ProjectBasicInfoResponse> getProjectBasicInfo(@PathVariable Long id) {
        ProjectBasicInfoResponse response = projectService.getProjectBasicInfo(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/overview")
    public ResponseEntity<ProjectOverviewResponse> getProjectOverview(@PathVariable Long id) {
        ProjectOverviewResponse response = projectService.getProjectOverview(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/databases")
    public ResponseEntity<ProjectDatabaseListResponse> getProjectDatabases(@PathVariable Long id) {
        ProjectDatabaseListResponse response = projectService.getProjectDatabases(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/backends")
    public ResponseEntity<ProjectBackendListResponse> getProjectBackends(@PathVariable Long id) {
        ProjectBackendListResponse response = projectService.getProjectBackends(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/frontends")
    public ResponseEntity<ProjectFrontendListResponse> getProjectFrontends(@PathVariable Long id) {
        ProjectFrontendListResponse response = projectService.getProjectFrontends(id);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProject(
            @PathVariable Long id,
            @RequestParam String username) {
        projectService.deleteProject(id, username);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/deployment-history")
    public ResponseEntity<ProjectDeploymentHistoryResponse> getProjectDeploymentHistory(@PathVariable Long id) {
        ProjectDeploymentHistoryResponse response = projectService.getProjectDeploymentHistory(id);
        return ResponseEntity.ok(response);
    }
}

