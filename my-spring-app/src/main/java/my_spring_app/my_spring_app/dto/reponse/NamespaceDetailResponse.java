package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NamespaceDetailResponse {
    private String name;
    private String status; // active, terminating
    private String age;
    private String creationTimestamp;
    private String uid;
    private String resourceVersion;
    private String phase;
    
    // Summary
    private Integer podCount;
    private String cpu;
    private String memory;
    
    // Metadata
    private Map<String, String> labels;
    private Map<String, String> annotations;
    private List<String> finalizers;
    
    // Status
    private List<NamespaceCondition> conditions;
    
    // YAML
    private String yaml;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NamespaceCondition {
        private String type;
        private String status;
        private String reason;
        private String message;
        private String lastTransitionTime;
    }
}

