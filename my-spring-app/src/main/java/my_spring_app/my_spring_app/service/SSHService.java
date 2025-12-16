package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.CheckConnectionResponse;
import my_spring_app.my_spring_app.dto.reponse.ExecuteCommandResponse;
import my_spring_app.my_spring_app.dto.request.CheckConnectionRequest;
import my_spring_app.my_spring_app.dto.request.ExecuteCommandRequest;

public interface SSHService {

    CheckConnectionResponse checkConnection(CheckConnectionRequest request);

    ExecuteCommandResponse executeCommand(ExecuteCommandRequest request);
}

