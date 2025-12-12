package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.NamespaceDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceListResponse;
import my_spring_app.my_spring_app.dto.reponse.NamespaceResponse;
import my_spring_app.my_spring_app.dto.request.NamespaceRequest;

public interface AdminNamespaceService {

    NamespaceListResponse getNamespaces();

    NamespaceDetailResponse getNamespace(String name);

    NamespaceResponse createNamespace(NamespaceRequest request);

    NamespaceResponse createNamespaceFromYaml(String yaml);

    NamespaceResponse updateNamespaceFromYaml(String name, String yaml);

    void deleteNamespace(String name);
}

