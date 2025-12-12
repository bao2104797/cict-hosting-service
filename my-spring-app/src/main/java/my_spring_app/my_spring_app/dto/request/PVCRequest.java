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
public class PVCRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Namespace is required")
    private String namespace;

    @NotBlank(message = "Capacity is required")
    private String capacity; // e.g., "1Gi", "10Gi"

    private List<String> accessModes; // ReadWriteOnce, ReadOnlyMany, ReadWriteMany

    private String storageClass; // Optional, empty string means no storage class

    private String volumeMode; // Filesystem, Block

    private String volumeAttributesClass; // Optional

    private Map<String, String> labels; // Optional
}

