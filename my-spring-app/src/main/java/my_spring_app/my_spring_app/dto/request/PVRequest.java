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
public class PVRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Capacity is required")
    private String capacity; // e.g., "1Gi", "10Gi"

    private List<String> accessModes; // ReadWriteOnce, ReadOnlyMany, ReadWriteMany

    private String reclaimPolicy; // Retain, Delete, Recycle (default: Retain)

    private String storageClass; // Optional

    private String volumeMode; // Filesystem, Block

    private String volumeAttributesClass; // Optional

    private SourceInfo source; // NFS, HostPath, etc.

    private Map<String, String> labels; // Optional

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SourceInfo {
        private String type; // NFS, HostPath, Local, etc.

        // For NFS
        private String nfsServer;
        private String nfsPath;

        // For HostPath
        private String hostPath;

        // For Local
        private String localPath;

        // Additional options as key-value pairs
        private Map<String, String> options;
    }
}

