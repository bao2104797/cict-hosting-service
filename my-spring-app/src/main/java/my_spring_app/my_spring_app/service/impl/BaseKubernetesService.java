package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.util.Config;
import io.kubernetes.client.openapi.models.V1Node;

import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;

/**
 * Base service cung cấp các hàm tiện ích làm việc với Kubernetes (SSH, parse metrics, format dữ liệu).
 * Các service con chỉ cần kế thừa class này để tái sử dụng logic dùng chung.
 */
public abstract class BaseKubernetesService {

    protected static final double BYTES_PER_GB = 1024d * 1024 * 1024;

    protected Session createSession(my_spring_app.my_spring_app.entity.ServerEntity server) throws Exception {
        JSch jsch = new JSch();
        Session session = jsch.getSession(server.getUsername(), server.getIp(), server.getPort());
        session.setPassword(server.getPassword());

        Properties config = new Properties();
        config.put("StrictHostKeyChecking", "no");
        session.setConfig(config);
        session.setTimeout(7000);
        session.connect();
        return session;
    }

    protected String executeCommand(Session session, String command, boolean ignoreNonZeroExit) throws Exception {
        ChannelExec channelExec = null;
        try {
            channelExec = (ChannelExec) session.openChannel("exec");
            channelExec.setCommand(command);
            channelExec.setErrStream(System.err);

            InputStream inputStream = channelExec.getInputStream();
            channelExec.connect();

            StringBuilder output = new StringBuilder();
            byte[] buffer = new byte[1024];
            while (true) {
                while (inputStream.available() > 0) {
                    int bytesRead = inputStream.read(buffer, 0, 1024);
                    if (bytesRead < 0) {
                        break;
                    }
                    output.append(new String(buffer, 0, bytesRead, StandardCharsets.UTF_8));
                }

                if (channelExec.isClosed()) {
                    if (inputStream.available() > 0) {
                        continue;
                    }
                    break;
                }
                Thread.sleep(100);
            }

            int exitStatus = channelExec.getExitStatus();
            String result = output.toString().trim();
            if (exitStatus != 0 && !ignoreNonZeroExit) {
                throw new RuntimeException("Command exited with status: " + exitStatus + ". Output: " + result);
            }
            return result;
        } finally {
            if (channelExec != null && channelExec.isConnected()) {
                channelExec.disconnect();
            }
        }
    }

    /**
     * Helper method để thay thế server URL trong kubeconfig
     * Thay https://127.0.0.1:6443 / https://localhost:6443 bằng https://<master-ip>:6443
     *
     * @param kubeconfigContent Nội dung kubeconfig gốc
     * @param masterIp IP của master server (có thể null)
     * @return Nội dung kubeconfig đã được thay thế server URL (nếu masterIp được cung cấp)
     */
    protected String replaceKubeconfigServer(String kubeconfigContent, String masterIp) {
        if (kubeconfigContent == null || masterIp == null || masterIp.isBlank()) {
            return kubeconfigContent;
        }
        String newServerUrl = "https://" + masterIp + ":6443";
        // Thay cả 127.0.0.1 và localhost nếu có
        String result = kubeconfigContent
                .replace("https://127.0.0.1:6443", newServerUrl)
                .replace("https://localhost:6443", newServerUrl);
        System.out.println("[replaceKubeconfigServer] Đã thay thế server URL thành: " + newServerUrl);
        return result;
    }

    /**
     * Tạo Kubernetes client từ kubeconfig trên master server
     * 
     * @param session SSH session đến master server
     * @param masterIp IP của master server (tùy chọn, nếu null sẽ không thay thế server URL)
     * @return ApiClient để tương tác với Kubernetes API
     * @throws Exception Nếu có lỗi khi tạo client
     */
    protected ApiClient createKubernetesClient(Session session, String masterIp) throws Exception {
        String kubeconfigPath = "~/.kube/config";
        File tempKubeconfig = null;
        try {
            String kubeconfigContent = executeCommand(session, "cat " + kubeconfigPath, false);
            if (kubeconfigContent == null || kubeconfigContent.trim().isEmpty()) {
                String[] alternativePaths = {
                        "/etc/kubernetes/admin.conf",
                        "/root/.kube/config",
                        "$HOME/.kube/config"
                };
                for (String altPath : alternativePaths) {
                    try {
                        kubeconfigContent = executeCommand(session, "cat " + altPath, true);
                        if (kubeconfigContent != null && !kubeconfigContent.trim().isEmpty()) {
                            break;
                        }
                    } catch (Exception ignored) {
                    }
                }
                if (kubeconfigContent == null || kubeconfigContent.trim().isEmpty()) {
                    throw new RuntimeException("Không thể đọc kubeconfig từ master server.");
                }
            }

            // Thay thế server URL nếu masterIp được cung cấp
            if (masterIp != null && !masterIp.isBlank()) {
                kubeconfigContent = replaceKubeconfigServer(kubeconfigContent, masterIp);
            }

            tempKubeconfig = File.createTempFile("kubeconfig-", ".yaml");
            try (FileWriter writer = new FileWriter(tempKubeconfig)) {
                writer.write(kubeconfigContent);
            }

            ApiClient client = Config.fromConfig(tempKubeconfig.getAbsolutePath());
            io.kubernetes.client.openapi.Configuration.setDefaultApiClient(client);
            return client;
        } finally {
            if (tempKubeconfig != null && tempKubeconfig.exists()) {
                if (!tempKubeconfig.delete()) {
                    tempKubeconfig.deleteOnExit();
                }
            }
        }
    }

    /**
     * Tạo Kubernetes client từ kubeconfig trên master server (không thay thế server URL)
     * Method này được giữ lại để tương thích ngược
     * 
     * @param session SSH session đến master server
     * @return ApiClient để tương tác với Kubernetes API
     * @throws Exception Nếu có lỗi khi tạo client
     */
    protected ApiClient createKubernetesClient(Session session) throws Exception {
        return createKubernetesClient(session, null);
    }

    protected double parseCpuCores(String cpuStr) {
        if (cpuStr == null || cpuStr.isEmpty()) {
            return 0.0;
        }
        cpuStr = cpuStr.trim().toLowerCase();
        if (cpuStr.endsWith("m")) {
            String value = cpuStr.substring(0, cpuStr.length() - 1);
            return Double.parseDouble(value) / 1000.0;
        }
        return Double.parseDouble(cpuStr);
    }

    protected long parseMemoryBytes(String memStr) {
        if (memStr == null || memStr.isEmpty()) {
            return 0L;
        }
        memStr = memStr.trim().toUpperCase();
        long factor = 1L;
        String numericPart = memStr;

        if (memStr.endsWith("KI")) {
            factor = 1024L;
            numericPart = memStr.substring(0, memStr.length() - 2);
        } else if (memStr.endsWith("MI")) {
            factor = 1024L * 1024L;
            numericPart = memStr.substring(0, memStr.length() - 2);
        } else if (memStr.endsWith("GI")) {
            factor = 1024L * 1024L * 1024L;
            numericPart = memStr.substring(0, memStr.length() - 2);
        } else if (memStr.endsWith("TI")) {
            factor = 1024L * 1024L * 1024L * 1024L;
            numericPart = memStr.substring(0, memStr.length() - 2);
        } else if (memStr.endsWith("K")) {
            factor = 1000L;
            numericPart = memStr.substring(0, memStr.length() - 1);
        } else if (memStr.endsWith("M")) {
            factor = 1000L * 1000L;
            numericPart = memStr.substring(0, memStr.length() - 1);
        } else if (memStr.endsWith("G")) {
            factor = 1000L * 1000L * 1000L;
            numericPart = memStr.substring(0, memStr.length() - 1);
        }

        double value = Double.parseDouble(numericPart);
        return (long) (value * factor);
    }

    protected double bytesToGb(long bytes) {
        return bytes / BYTES_PER_GB;
    }

    protected double roundToThreeDecimals(double value) {
        return Math.round(value * 1000d) / 1000d;
    }

    protected double parseQuantityToCpuCores(Object quantity) {
        if (quantity == null) {
            return 0.0;
        }
        try {
            String quantityStr = quantity.toString();
            if (quantityStr.contains("number=")) {
                java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("number=(-?\\d+)");
                java.util.regex.Matcher matcher = pattern.matcher(quantityStr);
                if (matcher.find()) {
                    return Double.parseDouble(matcher.group(1));
                }
            }
            return parseCpuCores(quantityStr);
        } catch (Exception e) {
            System.out.println("[AdminService] parseQuantityToCpuCores() - ERROR: " + e.getMessage() + " for quantity: "
                    + quantity);
            return 0.0;
        }
    }

    protected long parseQuantityToMemoryBytes(Object quantity) {
        if (quantity == null) {
            return 0L;
        }
        try {
            String quantityStr = quantity.toString();
            if (quantityStr.contains("number=")) {
                java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("number=(-?\\d+)");
                java.util.regex.Matcher matcher = pattern.matcher(quantityStr);
                if (matcher.find()) {
                    return Long.parseLong(matcher.group(1));
                }
            }
            return parseMemoryBytes(quantityStr);
        } catch (Exception e) {
            System.out.println("[AdminService] parseQuantityToMemoryBytes() - ERROR: " + e.getMessage()
                    + " for quantity: " + quantity);
            return 0L;
        }
    }

    protected String parseQuantityToGB(Object quantity) {
        if (quantity == null) {
            return "";
        }
        try {
            String quantityStr = quantity.toString();
            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("number=(-?\\d+)");
            java.util.regex.Matcher matcher = pattern.matcher(quantityStr);
            if (matcher.find()) {
                long bytes = Long.parseLong(matcher.group(1));
                double gb = bytesToGb(bytes);
                double roundedGb = roundToThreeDecimals(gb);
                String result = String.format("%.3f GB", roundedGb);
                return result.replaceAll("\\.?0+ GB$", " GB");
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    protected String calculateAge(OffsetDateTime creationTimestamp) {
        try {
            if (creationTimestamp == null) {
                return "";
            }
            Instant created = creationTimestamp.toInstant();
            Instant now = Instant.now();
            Duration duration = Duration.between(created, now);

            long days = duration.toDays();
            long hours = duration.toHours() % 24;
            long minutes = duration.toMinutes() % 60;

            if (days > 0) {
                return days + "d";
            } else if (hours > 0) {
                return hours + "h";
            } else {
                return minutes + "m";
            }
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * DTO nội bộ lưu trữ CPU/Memory dạng số để dễ cộng dồn.
     * 
     * Class này được sử dụng để:
     * - Lưu trữ CPU (cores) và Memory (bytes) dưới dạng số để dễ tính toán
     * - Hỗ trợ method chaining để cộng dồn giá trị một cách tiện lợi
     * - Tái sử dụng trong nhiều method để tính tổng usage
     * 
     * Các field:
     * - cpuCores: Tổng CPU cores (double, có thể có phần thập phân)
     * - memoryBytes: Tổng Memory bytes (long, số nguyên)
     */
    protected static class ResourceUsage {
        /**
         * Tổng CPU cores đang sử dụng.
         * Đơn vị: cores (có thể có phần thập phân, ví dụ: 1.5 cores)
         */
        private double cpuCores = 0.0;
        
        /**
         * Tổng Memory bytes đang sử dụng.
         * Đơn vị: bytes (số nguyên, ví dụ: 1073741824 bytes = 1 GB)
         */
        private long memoryBytes = 0L;

        /**
         * Cộng thêm CPU cores vào tổng hiện tại.
         * 
         * @param cores Số cores cần cộng thêm
         * @return ResourceUsage chính nó để hỗ trợ method chaining
         */
        public ResourceUsage addCpu(double cores) {
            this.cpuCores += cores;
            return this;
        }

        /**
         * Cộng thêm Memory bytes vào tổng hiện tại.
         * 
         * @param bytes Số bytes cần cộng thêm
         * @return ResourceUsage chính nó để hỗ trợ method chaining
         */
        public ResourceUsage addMemory(long bytes) {
            this.memoryBytes += bytes;
            return this;
        }

        /**
         * Lấy tổng CPU cores.
         * 
         * @return double tổng CPU cores
         */
        public double getCpuCores() {
            return cpuCores;
        }

        /**
         * Lấy tổng Memory bytes.
         * 
         * @return long tổng Memory bytes
         */
        public long getMemoryBytes() {
            return memoryBytes;
        }
    }

    /**
     * Extract node role từ labels (logic đồng bộ cho cả getNodes và parseNodeToResponse)
     * 
     * @param v1Node V1Node từ Kubernetes API
     * @param nodeName Tên node (để fallback)
     * @return Role string ("master" hoặc "worker")
     */
    protected String extractNodeRole(V1Node v1Node, String nodeName) {
        String nodeRole = "worker";
        if (v1Node.getMetadata() != null && v1Node.getMetadata().getLabels() != null) {
            Map<String, String> labels = v1Node.getMetadata().getLabels();
            boolean hasControlPlaneLabel = labels.containsKey("node-role.kubernetes.io/control-plane")
                    || labels.containsKey("node-role.kubernetes.io/master")
                    || (labels.containsKey("kubernetes.io/role")
                            && "master".equalsIgnoreCase(labels.get("kubernetes.io/role")));
            boolean hasWorkerLabel = labels.containsKey("node-role.kubernetes.io/worker")
                    || (labels.containsKey("kubernetes.io/role")
                            && "worker".equalsIgnoreCase(labels.get("kubernetes.io/role")));

            if (hasControlPlaneLabel) {
                nodeRole = "master";
            } else if (hasWorkerLabel) {
                nodeRole = "worker";
            } else if (labels.containsKey("node-role.kubernetes.io/node")) {
                nodeRole = "worker";
            } else if (nodeName.toLowerCase(Locale.ROOT).contains("master")) {
                // Fallback theo tên node
                nodeRole = "master";
            }
        }
        return nodeRole;
    }

    /**
     * Lấy CPU/Memory usage từ kubectl top cho một node cụ thể
     * 
     * @param nodeName Tên node
     * @param masterSession SSH session đến master server
     * @return ResourceUsage hoặc null nếu không lấy được
     */
    protected ResourceUsage getNodeUsageFromKubectlTop(String nodeName, Session masterSession) {
        try {
            String topNodesCmd = "kubectl top nodes --no-headers | grep " + nodeName;
            String topOutput = executeCommand(masterSession, topNodesCmd, true);
            if (topOutput != null && !topOutput.trim().isEmpty()) {
                String[] parts = topOutput.trim().split("\\s+");
                if (parts.length >= 4) {
                    double cpu = parseCpuCores(parts[1]);
                    long memory = parseMemoryBytes(parts[3]);
                    return new ResourceUsage().addCpu(cpu).addMemory(memory);
                }
            }
        } catch (Exception e) {
            // Nếu kubectl top không khả dụng, trả về null
        }
        return null;
    }

    /**
     * Lấy CPU/Memory usage từ kubectl top cho tất cả nodes
     * 
     * @param masterSession SSH session đến master server
     * @return Map với key là node name, value là ResourceUsage
     */
    protected Map<String, ResourceUsage> getAllNodesUsageFromKubectlTop(Session masterSession) {
        Map<String, ResourceUsage> nodeUsageMap = new HashMap<>();
        try {
            String topNodesCmd = "kubectl top nodes --no-headers";
            String topOutput = executeCommand(masterSession, topNodesCmd, true);
            if (topOutput != null && !topOutput.trim().isEmpty()) {
                String[] lines = topOutput.trim().split("\\r?\\n");
                for (String line : lines) {
                    String[] parts = line.trim().split("\\s+");
                    if (parts.length >= 4) {
                        String nodeName = parts[0];
                        double cpu = parseCpuCores(parts[1]);
                        long memory = parseMemoryBytes(parts[3]);
                        nodeUsageMap.put(nodeName, new ResourceUsage().addCpu(cpu).addMemory(memory));
                    }
                }
            }
        } catch (Exception e) {
            // Nếu kubectl top không khả dụng, để giá trị mặc định rỗng
        }
        return nodeUsageMap;
    }
}

