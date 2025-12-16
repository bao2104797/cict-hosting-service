package my_spring_app.my_spring_app.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstallK8sRequest {
    /**
     * IP address của controller server (optional)
     */
    private String controllerHost;
    
    /**
     * Sudo password (optional)
     */
    private String sudoPassword;
    
    /**
     * Kubernetes version (e.g., "1.28.0")
     */
    private String k8sVersion;
    
    /**
     * Pod network CIDR (e.g., "10.244.0.0/16")
     */
    private String podNetworkCidr;
    
    /**
     * Service CIDR (e.g., "10.96.0.0/12")
     */
    private String serviceCidr;
    
    /**
     * Container runtime (e.g., "containerd")
     */
    private String containerRuntime;
    
    /**
     * Master node IP (cho tab 3 - join worker nodes)
     */
    private String masterNodeIp;
    
    /**
     * Worker node IPs (cho tab 3 - join worker nodes)
     */
    private java.util.List<String> workerNodeIps;
}

