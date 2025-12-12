package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PodDetailResponse {
    private String id;
    private String name;
    private String namespace;
    private String status;
    private String node;
    private String ip;
    private String age;
    private String cpu;
    private String memory;
    private PodResponse.ReadyInfo ready;
    private Integer restarts;
    private String nominatedNode;
    private List<String> readinessGates;
    private Map<String, String> labels;
    private Map<String, String> annotations;
    private String uid;
    private String resourceVersion;
    private String creationTimestamp;
    private List<ContainerInfo> containers;
    private List<EventInfo> events;
    private List<ConditionInfo> conditions;
    private String yaml;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ContainerInfo {
        private String name;
        private String image;
        private String imagePullPolicy;
        private List<PortInfo> ports;
        private ResourceInfo resources;
        private String status;
        private Boolean ready;
        private Integer restartCount;
        private String startedAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PortInfo {
        private String name;
        private Integer containerPort;
        private String protocol;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResourceInfo {
        private String cpuRequest;
        private String cpuLimit;
        private String memoryRequest;
        private String memoryLimit;
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
    public static class ConditionInfo {
        private String type;
        private String status;
        private String reason;
        private String message;
        private String lastTransitionTime;
        private String lastProbeTime;
    }
}

