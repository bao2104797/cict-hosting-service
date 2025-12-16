package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ServiceResponse {
    private String id;
    private String name;
    private String namespace;
    private String type; // ClusterIP, NodePort, LoadBalancer
    private String clusterIP;
    private String externalIP;
    private List<PortInfo> ports;
    private Map<String, String> selector;
    private String age;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PortInfo {
        private Integer port;
        private Integer targetPort;
        private String protocol; // TCP, UDP
    }
}

