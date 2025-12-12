package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.FrontendRequestResponse;
import my_spring_app.my_spring_app.dto.request.CreateFrontendRequest;

import java.util.List;

public interface FrontendRequestService {
    FrontendRequestResponse createRequest(CreateFrontendRequest request);

    FrontendRequestResponse approveRequest(Long requestId);

    FrontendRequestResponse rejectRequest(Long requestId, String reason);

    FrontendRequestResponse cancelRequest(Long requestId);

    List<FrontendRequestResponse> listRequests(String status);
}

