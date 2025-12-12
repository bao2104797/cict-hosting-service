package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IngressDetailResponse {
    private String id;
    private String name;
    private String namespace;
    private String ingressClass;
    private List<String> hosts;
    private String address;
    private List<Integer> ports;
    private String age;
    private List<RuleInfo> rules;
    private List<TlsInfo> tls;
    private Map<String, String> labels;
    private Map<String, String> annotations;
    private String uid;
    private String resourceVersion;
    private String creationTimestamp;
    private List<EventInfo> events;
    private StatusInfo status;
    private String yaml;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RuleInfo {
        private String host;
        private String path;
        private String pathType;
        private String serviceName;
        private String servicePort;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TlsInfo {
        private String secretName;
        private List<String> hosts;
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
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusInfo {
        private List<String> addresses;
    }
}

