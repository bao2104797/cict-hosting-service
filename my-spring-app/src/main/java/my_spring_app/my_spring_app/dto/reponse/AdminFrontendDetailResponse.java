package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminFrontendDetailResponse {
    // Thông tin Frontend
    private Long frontendId;
    private String projectName;
    private String deploymentType; // DOCKER, FILE
    private String frameworkType; // REACT, VUE, ANGULAR
    private String domainNameSystem;
    private String dockerImage;
    
    // Thông tin Deployment
    private String deploymentName;
    private Integer replicas;
    
    // Thông tin Pod
    private String podName;
    private String podNode;
    private String podStatus;
    
    // Thông tin Service
    private String serviceName;
    private String serviceType;
    private String servicePort;
    
    // Thông tin Ingress
    private String ingressName;
    private String ingressHosts;
    private String ingressAddress;
    private String ingressPort;
    private String ingressClass;
}

