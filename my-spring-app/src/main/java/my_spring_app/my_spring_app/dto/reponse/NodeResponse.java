package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NodeResponse {
    private String id;
    private String name;
    private String ip; // IP address của node (InternalIP)
    private String status; // ready, notready
    private String role; // master, worker
    private NodeResource cpu;
    private NodeResource memory;
    private NodeResource disk;
    private Integer podCount;
    private String os;
    private String kernel;
    private String kubeletVersion;
    private String containerRuntime;
    private String updatedAt;
    private Map<String, String> labels;
    private List<NodePod> pods;
    private String yaml;
    private String notAssignAction; // "ASSIGN" hoặc "JOIN_K8S" - chỉ có khi status = "NOT_ASSIGN"

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NodeResource {
        private Double requested;
        private Double limit;
        private Double capacity;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NodePod {
        private String name;
        private String namespace;
        private String status;
        private String ip;
        private String age;
    }
}

