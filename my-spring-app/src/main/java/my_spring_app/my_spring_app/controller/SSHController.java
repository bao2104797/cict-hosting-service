package my_spring_app.my_spring_app.controller;

import jakarta.validation.Valid;
import my_spring_app.my_spring_app.dto.reponse.CheckConnectionResponse;
import my_spring_app.my_spring_app.dto.reponse.ExecuteCommandResponse;
import my_spring_app.my_spring_app.dto.request.CheckConnectionRequest;
import my_spring_app.my_spring_app.dto.request.ExecuteCommandRequest;
import my_spring_app.my_spring_app.service.SSHService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ssh")
public class SSHController {

    @Autowired
    private SSHService sshService;

    @PostMapping("/check-connection")
    public ResponseEntity<CheckConnectionResponse> checkConnection(
            @Valid @RequestBody CheckConnectionRequest request) {
        CheckConnectionResponse response = sshService.checkConnection(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/execute-command")
    public ResponseEntity<ExecuteCommandResponse> executeCommand(
            @Valid @RequestBody ExecuteCommandRequest request) {
        ExecuteCommandResponse response = sshService.executeCommand(request);
        return ResponseEntity.ok(response);
    }
}

