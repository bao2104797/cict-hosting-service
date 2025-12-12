package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NamespaceResponse {
    private String id;
    private String name;
    private String status; // active, terminating
    private Map<String, String> labels;
    private String age;
    private String cpu; // CPU usage (e.g., "400m", "1.5")
    private String memory; // Memory usage (e.g., "1.2Gi", "800Mi")
    private Integer podCount; // Number of pods in this namespace
}

