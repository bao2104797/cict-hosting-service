package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatefulsetDetailResponse {
    private String id;
    private String name;
    private String namespace;
    private StatefulsetResponse.ReplicasInfo replicas;
    private String status;
    private String service;
    private List<String> containers;
    private List<String> images;
    private String age;
    private String cpu;
    private String memory;
    private Map<String, String> labels;
    private Map<String, String> annotations;
    private String uid;
    private String resourceVersion;
    private String creationTimestamp;
    private List<PodInfo> pods;
    private List<PVCInfo> pvcs;
    private List<EventInfo> events;
    private List<ConditionInfo> conditions;
    private List<VolumeClaimTemplateInfo> volumeClaimTemplates;
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
        private String ready;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PVCInfo {
        private String name;
        private String namespace;
        private String status;
        private String volume;
        private String capacity;
        private String storageClass;
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
        private String lastUpdateTime;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VolumeClaimTemplateInfo {
        private String name;
        private String storageClass;
        private String accessMode;
        private String size;
    }
}

