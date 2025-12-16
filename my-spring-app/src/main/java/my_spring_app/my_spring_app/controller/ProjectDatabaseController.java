package my_spring_app.my_spring_app.controller;

import jakarta.validation.Valid;
import my_spring_app.my_spring_app.dto.reponse.DeployDatabaseResponse;
import my_spring_app.my_spring_app.dto.request.DeployDatabaseRequest;
import my_spring_app.my_spring_app.service.ProjectDatabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/project-databases")
public class ProjectDatabaseController {

    @Autowired
    private ProjectDatabaseService projectDatabaseService;

    @PostMapping(value = "/deploy", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DeployDatabaseResponse> deploy(@ModelAttribute @Valid DeployDatabaseRequest request) {
        DeployDatabaseResponse response = projectDatabaseService.deploy(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{projectId}/{databaseId}/stop")
    public ResponseEntity<String> stopDatabase(@PathVariable Long projectId, @PathVariable Long databaseId) {
        projectDatabaseService.stopDatabase(projectId, databaseId);
        return ResponseEntity.ok("Đã dừng database thành công");
    }

    @PostMapping("/{projectId}/{databaseId}/start")
    public ResponseEntity<String> startDatabase(@PathVariable Long projectId, @PathVariable Long databaseId) {
        projectDatabaseService.startDatabase(projectId, databaseId);
        return ResponseEntity.ok("Đã khởi động database thành công");
    }

    @PostMapping("/{projectId}/{databaseId}/delete")
    public ResponseEntity<String> deleteDatabase(@PathVariable Long projectId, @PathVariable Long databaseId) {
        projectDatabaseService.deleteDatabase(projectId, databaseId);
        return ResponseEntity.ok("Đã xóa database thành công");
    }
}

