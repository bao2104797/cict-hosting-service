package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.BackendRequestResponse;
import my_spring_app.my_spring_app.dto.request.CreateBackendRequest;

import java.util.List;

public interface BackendRequestService {
    BackendRequestResponse createRequest(CreateBackendRequest request);

    BackendRequestResponse approveRequest(Long requestId);

    BackendRequestResponse rejectRequest(Long requestId, String reason);

    BackendRequestResponse cancelRequest(Long requestId);

    List<BackendRequestResponse> listRequests(String status);
}

