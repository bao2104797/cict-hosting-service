package my_spring_app.my_spring_app.controller;

import my_spring_app.my_spring_app.dto.reponse.FrontendRequestResponse;
import my_spring_app.my_spring_app.dto.request.CreateFrontendRequest;
import my_spring_app.my_spring_app.dto.request.RejectFrontendRequest;
import my_spring_app.my_spring_app.service.FrontendRequestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/frontend-requests")
public class FrontendRequestController {

    private final FrontendRequestService frontendRequestService;

    @Autowired
    public FrontendRequestController(FrontendRequestService frontendRequestService) {
        this.frontendRequestService = frontendRequestService;
    }

    @PostMapping
    public ResponseEntity<FrontendRequestResponse> createRequest(
            @RequestBody CreateFrontendRequest request) {
        FrontendRequestResponse response = frontendRequestService.createRequest(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<FrontendRequestResponse>> listRequests(
            @RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(frontendRequestService.listRequests(status));
    }

    @PostMapping("/{requestId}/approve")
    public ResponseEntity<FrontendRequestResponse> approveRequest(@PathVariable Long requestId) {
        FrontendRequestResponse response = frontendRequestService.approveRequest(requestId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{requestId}/reject")
    public ResponseEntity<FrontendRequestResponse> rejectRequest(
            @PathVariable Long requestId,
            @RequestBody RejectFrontendRequest request) {
        FrontendRequestResponse response = frontendRequestService.rejectRequest(requestId, request.getReason());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{requestId}/cancel")
    public ResponseEntity<FrontendRequestResponse> cancelRequest(@PathVariable Long requestId) {
        FrontendRequestResponse response = frontendRequestService.cancelRequest(requestId);
        return ResponseEntity.ok(response);
    }
}

