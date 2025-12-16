package my_spring_app.my_spring_app.controller;

import jakarta.validation.Valid;
import my_spring_app.my_spring_app.dto.reponse.DeployFrontendResponse;
import my_spring_app.my_spring_app.dto.reponse.FrontendReplicaInfoResponse;
import my_spring_app.my_spring_app.dto.request.DeployFrontendRequest;
import my_spring_app.my_spring_app.service.ProjectFrontendService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/project-frontends")
public class ProjectFrontendController {

    @Autowired
    private ProjectFrontendService projectFrontendService;

    @PostMapping(value = "/deploy", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DeployFrontendResponse> deploy(@ModelAttribute @Valid DeployFrontendRequest request) {
        DeployFrontendResponse response = projectFrontendService.deploy(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{projectId}/{frontendId}/stop")
    public ResponseEntity<String> stopFrontend(@PathVariable Long projectId, @PathVariable Long frontendId) {
        projectFrontendService.stopFrontend(projectId, frontendId);
        return ResponseEntity.ok("Đã dừng frontend thành công");
    }

    @PostMapping("/{projectId}/{frontendId}/start")
    public ResponseEntity<String> startFrontend(@PathVariable Long projectId, @PathVariable Long frontendId) {
        projectFrontendService.startFrontend(projectId, frontendId);
        return ResponseEntity.ok("Đã khởi động frontend thành công");
    }

    @PostMapping("/{projectId}/{frontendId}/delete")
    public ResponseEntity<String> deleteFrontend(@PathVariable Long projectId, @PathVariable Long frontendId) {
        projectFrontendService.deleteFrontend(projectId, frontendId);
        return ResponseEntity.ok("Đã xóa frontend thành công");
    }

    @GetMapping("/{frontendId}/replicas")
    public ResponseEntity<FrontendReplicaInfoResponse> getFrontendReplicaInfo(@PathVariable Long frontendId) {
        FrontendReplicaInfoResponse response = projectFrontendService.getFrontendReplicaInfo(frontendId);
        return ResponseEntity.ok(response);
    }
}

