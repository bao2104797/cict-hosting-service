package my_spring_app.my_spring_app.controller;

import jakarta.validation.Valid;
import my_spring_app.my_spring_app.dto.reponse.BackendReplicaInfoResponse;
import my_spring_app.my_spring_app.dto.reponse.DeployBackendResponse;
import my_spring_app.my_spring_app.dto.request.DeployBackendRequest;
import my_spring_app.my_spring_app.service.ProjectBackendService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/project-backends")
public class ProjectBackendController {

    @Autowired
    private ProjectBackendService projectBackendService;

    @PostMapping(value = "/deploy", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DeployBackendResponse> deploy(@ModelAttribute @Valid DeployBackendRequest request) {
        DeployBackendResponse response = projectBackendService.deploy(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{projectId}/{backendId}/stop")
    public ResponseEntity<String> stopBackend(@PathVariable Long projectId, @PathVariable Long backendId) {
        projectBackendService.stopBackend(projectId, backendId);
        return ResponseEntity.ok("Đã dừng backend thành công");
    }

    @PostMapping("/{projectId}/{backendId}/start")
    public ResponseEntity<String> startBackend(@PathVariable Long projectId, @PathVariable Long backendId) {
        projectBackendService.startBackend(projectId, backendId);
        return ResponseEntity.ok("Đã khởi động backend thành công");
    }

    @PostMapping("/{projectId}/{backendId}/delete")
    public ResponseEntity<String> deleteBackend(@PathVariable Long projectId, @PathVariable Long backendId) {
        projectBackendService.deleteBackend(projectId, backendId);
        return ResponseEntity.ok("Đã xóa backend thành công");
    }

    @GetMapping("/{backendId}/replicas")
    public ResponseEntity<BackendReplicaInfoResponse> getBackendReplicaInfo(@PathVariable Long backendId) {
        BackendReplicaInfoResponse response = projectBackendService.getBackendReplicaInfo(backendId);
        return ResponseEntity.ok(response);
    }
}

