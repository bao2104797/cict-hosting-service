package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.CreateServerResponse;
import my_spring_app.my_spring_app.dto.reponse.ServerResponse;
import my_spring_app.my_spring_app.dto.reponse.ServerAuthStatusResponse;
import my_spring_app.my_spring_app.dto.reponse.TestSshResponse;
import my_spring_app.my_spring_app.dto.request.CreateServerRequest;
import my_spring_app.my_spring_app.dto.request.UpdateServerRequest;
import my_spring_app.my_spring_app.dto.request.TestSshRequest;
import my_spring_app.my_spring_app.entity.ServerEntity;

import java.util.List;
import java.util.function.Consumer;

public interface ServerService {
    List<ServerResponse> findAll();
    
    ServerResponse findById(Long id);
    
    CreateServerResponse createServer(CreateServerRequest request);
    
    ServerResponse updateServer(Long id, UpdateServerRequest request);
    
    void deleteServer(Long id);
    
    TestSshResponse testSsh(TestSshRequest request);
    
    List<ServerResponse> checkAllStatuses(int timeoutMs);
    
    List<ServerResponse> checkAllServers();
    
    ServerResponse updateServerStatus(Long id, ServerEntity.ServerStatus status);
    
    ServerResponse reconnectServer(Long id, String password);

    ServerResponse disconnectServer(Long id);

    String execCommand(Long id, String command, int timeoutMs);

    String execCommand(Long id, String command, int timeoutMs, Consumer<String> outputHandler);

    String shutdownServer(Long id);

    String restartServer(Long id);

    String resolveServerPrivateKeyPem(Long serverId);

    boolean pingServer(Long id, int timeoutMs);
    
    ServerAuthStatusResponse checkServerAuthStatus(Long id);
}


