package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminDatabaseDetailResponse {
    // Thông tin database
    private Long databaseId;
    private String databaseType; // MYSQL, MONGODB
    private String databaseIp;
    private Integer databasePort;
    private String databaseName;
    private String databaseUsername;
    private String databasePassword;
    
    // Thông tin Pod
    private String podName;
    private String podNode;
    private String podStatus;
    
    // Thông tin Service
    private String serviceName;
    private String serviceExternalIp;
    private Integer servicePort;
    
    // Thông tin StatefulSet
    private String statefulSetName;
    
    // Thông tin PVC
    private String pvcName;
    private String pvcStatus;
    private String pvcVolume;
    private String pvcCapacity;
    
    // Thông tin PV
    private String pvName;
    private String pvCapacity;
    private String pvNode;
}

