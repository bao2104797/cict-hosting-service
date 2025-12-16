package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PVResponse {
    private String id;
    private String name;
    private String capacity;
    private List<String> accessModes;
    private String reclaimPolicy; // Retain, Delete, Recycle
    private String status; // available, bound, released
    private String storageClass;
    private ClaimInfo claim;
    private String volumeAttributesClass;
    private String reason;
    private String volumeMode;
    private String age;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClaimInfo {
        private String namespace;
        private String name;
    }
}

