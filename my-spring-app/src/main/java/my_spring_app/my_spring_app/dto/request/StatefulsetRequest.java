package my_spring_app.my_spring_app.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatefulsetRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Namespace is required")
    private String namespace;

    @Min(value = 0, message = "Replicas must be >= 0")
    private Integer replicas;

    private String serviceName;

    private List<ContainerRequest> containers;

    private Map<String, String> selector;

    private Map<String, String> labels;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ContainerRequest {
        @NotBlank(message = "Container name is required")
        private String name;

        @NotBlank(message = "Image is required")
        private String image;

        private String imagePullPolicy;

        private List<PortRequest> ports;

        private ResourceRequest resources;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PortRequest {
        private String name;
        private Integer containerPort;
        private String protocol;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResourceRequest {
        private Map<String, String> requests;
        private Map<String, String> limits;
    }
}

