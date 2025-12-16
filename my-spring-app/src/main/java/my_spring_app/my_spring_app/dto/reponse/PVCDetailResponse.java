package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PVCDetailResponse {
    private String id;
    private String name;
    private String namespace;
    private String status;
    private String volume;
    private String capacity;
    private List<String> accessModes;
    private String storageClass;
    private String volumeAttributesClass;
    private String volumeMode;
    private String age;
    private Map<String, String> labels;
    private Map<String, String> annotations;
    private String uid;
    private String resourceVersion;
    private String creationTimestamp;
    private List<PodInfo> pods;
    private List<EventInfo> events;
    private List<ConditionInfo> conditions;
    private String yaml;

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
        private String reason;
        private String message;
        private String lastTransitionTime;
    }
}

