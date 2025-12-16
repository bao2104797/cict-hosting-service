package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.DeploymentListResponse;
import my_spring_app.my_spring_app.dto.reponse.DeploymentResponse;
import my_spring_app.my_spring_app.dto.reponse.PodListResponse;
import my_spring_app.my_spring_app.dto.reponse.PodResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetListResponse;
import my_spring_app.my_spring_app.dto.reponse.StatefulsetResponse;
import my_spring_app.my_spring_app.dto.request.DeploymentRequest;
import my_spring_app.my_spring_app.dto.request.PodRequest;
import my_spring_app.my_spring_app.dto.request.StatefulsetRequest;

public interface AdminWorkloadService {

    DeploymentListResponse getDeployments();

    DeploymentResponse getDeployment(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.DeploymentDetailResponse getDeploymentDetail(String namespace, String name);

    DeploymentResponse createDeployment(DeploymentRequest request);

    DeploymentResponse createDeploymentFromYaml(String yaml);

    DeploymentResponse scaleDeployment(String namespace, String name, int replicas);

    DeploymentResponse updateDeploymentFromYaml(String namespace, String name, String yaml);

    void deleteDeployment(String namespace, String name);

    PodListResponse getPods();

    PodResponse getPod(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.PodDetailResponse getPodDetail(String namespace, String name);

    PodResponse createPod(PodRequest request);

    PodResponse createPodFromYaml(String yaml);

    String getPodLogs(String namespace, String name, String container);

    String execPodCommand(String namespace, String name, String container, String command);

    PodResponse updatePodFromYaml(String namespace, String name, String yaml);

    void deletePod(String namespace, String name);

    StatefulsetListResponse getStatefulsets();

    StatefulsetResponse getStatefulset(String namespace, String name);

    my_spring_app.my_spring_app.dto.reponse.StatefulsetDetailResponse getStatefulsetDetail(String namespace, String name);

    StatefulsetResponse createStatefulset(StatefulsetRequest request);

    StatefulsetResponse createStatefulsetFromYaml(String yaml);

    StatefulsetResponse scaleStatefulset(String namespace, String name, int replicas);

    StatefulsetResponse updateStatefulsetFromYaml(String namespace, String name, String yaml);

    void deleteStatefulset(String namespace, String name);
}

