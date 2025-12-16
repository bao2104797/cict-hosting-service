package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PVDetailResponse {
    private String id;
    private String name;
    private String capacity;
    private List<String> accessModes;
    private String reclaimPolicy;
    private String status;
    private PVResponse.ClaimInfo claim;
    private String storageClass;
    private String volumeMode;
    private String volumeAttributesClass;
    private List<String> mountOptions;
    private String age;
    private Map<String, String> labels;
    private Map<String, String> annotations;
    private String uid;
    private String resourceVersion;
    private String creationTimestamp;
    private SourceInfo source;
    private List<EventInfo> events;
    private List<ConditionInfo> conditions;
    private List<PodInfo> pods;
    private String yaml;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SourceInfo {
        private String type;
        private Map<String, Object> details;
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
    public static class ConditionInfo {
        private String type;
        private String status;
        private String message;
        private String lastTransitionTime;
        private String lastProbeTime;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PodInfo {
        private String name;
        private String namespace;
        private String status;
        private String node;
        private String age;
    }
}


