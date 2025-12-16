package my_spring_app.my_spring_app.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ServiceRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Namespace is required")
    private String namespace;

    private String type; // ClusterIP, NodePort, LoadBalancer

    private String clusterIP;

    private List<String> externalIPs;

    private List<PortRequest> ports;

    private Map<String, String> selector;

    private Map<String, String> labels;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PortRequest {
        private String name;
        private Integer port;
        private Integer targetPort;
        private String protocol;
    }
}

