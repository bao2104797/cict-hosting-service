package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.kubernetes.client.openapi.models.V1DeploymentCondition;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeploymentDetailResponse {
    private String id;
    private String name;
    private String namespace;
    private DeploymentResponse.ReplicasInfo replicas;
    private String status; // running, error, pending
    private List<String> containers;
    private List<String> images;
    private String selector;
    private String age;
    private String cpu; // CPU usage (e.g., "400m", "1.5")
    private String memory; // Memory usage (e.g., "1.2Gi", "800Mi")
    private Map<String, String> labels;
    private Map<String, String> annotations;
    private String uid;
    private String resourceVersion;
    private String creationTimestamp;
    private List<PodInfo> pods;
    private List<ReplicaSetInfo> replicaSets;
    private List<EventInfo> events;
    private List<V1DeploymentCondition> conditions;
    private String yaml;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PodInfo {
        private String name;
        private String namespace;
        private String status;
        private String node;
        private String ip;
        private Integer restarts;
        private String age;
        private String ready; // "1/1" format
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReplicaSetInfo {
        private String name;
        private String namespace;
        private Integer replicas;
        private Integer readyReplicas;
        private String age;
        private String image;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EventInfo {
        private String type; // Normal, Warning
        private String reason;
        private String message;
        private String firstTimestamp;
        private String lastTimestamp;
        private Integer count;
        private String involvedObjectKind;
        private String involvedObjectName;
    }
}

