package my_spring_app.my_spring_app.controller;

import my_spring_app.my_spring_app.dto.reponse.BackendRequestResponse;
import my_spring_app.my_spring_app.dto.request.CreateBackendRequest;
import my_spring_app.my_spring_app.dto.request.RejectBackendRequest;
import my_spring_app.my_spring_app.service.BackendRequestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/backend-requests")
public class BackendRequestController {

    private final BackendRequestService backendRequestService;

    @Autowired
    public BackendRequestController(BackendRequestService backendRequestService) {
        this.backendRequestService = backendRequestService;
    }

    @PostMapping
    public ResponseEntity<BackendRequestResponse> createRequest(@RequestBody CreateBackendRequest request) {
        BackendRequestResponse response = backendRequestService.createRequest(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<BackendRequestResponse>> listRequests(
            @RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(backendRequestService.listRequests(status));
    }

    @PostMapping("/{requestId}/approve")
    public ResponseEntity<BackendRequestResponse> approveRequest(@PathVariable Long requestId) {
        BackendRequestResponse response = backendRequestService.approveRequest(requestId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{requestId}/reject")
    public ResponseEntity<BackendRequestResponse> rejectRequest(
            @PathVariable Long requestId,
            @RequestBody RejectBackendRequest request) {
        BackendRequestResponse response = backendRequestService.rejectRequest(requestId, request.getReason());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{requestId}/cancel")
    public ResponseEntity<BackendRequestResponse> cancelRequest(@PathVariable Long requestId) {
        BackendRequestResponse response = backendRequestService.cancelRequest(requestId);
        return ResponseEntity.ok(response);
    }
}

