package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ServiceDetailResponse {
    private String id;
    private String name;
    private String namespace;
    private String type;
    private String clusterIP;
    private String externalIP;
    private List<ServiceResponse.PortInfo> ports;
    private Map<String, String> selector;
    private String age;
    private Map<String, String> labels;
    private Map<String, String> annotations;
    private String uid;
    private String resourceVersion;
    private String creationTimestamp;
    private List<EndpointInfo> endpoints;
    private List<EventInfo> events;
    private StatusInfo status;
    private String yaml;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EndpointInfo {
        private String ip;
        private List<Integer> ports;
        private String targetRefKind;
        private String targetRefName;
        private String targetRefNamespace;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EventInfo {
        private String type;
        private String reason;
        private String message;
        private String firstTimestamp;
        private String lastTimestamp;
        private Integer count;
        private String involvedObjectKind;
        private String involvedObjectName;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusInfo {
        private Integer endpointCount;
        private String loadBalancerStatus;
    }
}

