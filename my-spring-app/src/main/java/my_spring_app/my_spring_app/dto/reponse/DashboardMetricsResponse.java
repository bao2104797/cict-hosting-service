package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO cho Dashboard Metrics - Tổng quan về cluster resources
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardMetricsResponse {
    
    /**
     * Thông tin về Nodes trong cluster
     */
    private NodeMetrics nodes;
    
    /**
     * Thông tin về Pods trong cluster
     */
    private PodMetrics pods;
    
    /**
     * Thông tin về Deployments trong cluster
     */
    private DeploymentMetrics deployments;
    
    /**
     * Thông tin sử dụng CPU
     */
    private ResourceUsage cpuUsage;
    
    /**
     * Thông tin sử dụng Memory
     */
    private ResourceUsage memoryUsage;
    
    /**
     * Inner class cho Node metrics
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NodeMetrics {
        private Integer total;
        private Integer healthy;
        private Integer unhealthy;
    }
    
    /**
     * Inner class cho Pod metrics
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PodMetrics {
        private Integer total;
        private Integer running;
        private Integer pending;
        private Integer failed;
    }
    
    /**
     * Inner class cho Deployment metrics
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeploymentMetrics {
        private Integer total;
        private Integer active;
        private Integer error;
    }
    
    /**
     * Inner class cho Resource usage (CPU/Memory)
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResourceUsage {
        private Double used;
        private Double total;
    }
}

