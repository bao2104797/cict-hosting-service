package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PVCResponse {
    private String id;
    private String name;
    private String namespace;
    private String status; // bound, pending
    private String volume;
    private String capacity;
    private List<String> accessModes;
    private String storageClass;
    private String volumeAttributesClass;
    private String volumeMode;
    private String age;
}

