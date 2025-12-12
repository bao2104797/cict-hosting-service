package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.*;
import my_spring_app.my_spring_app.dto.reponse.DeployDatabaseResponse;
import my_spring_app.my_spring_app.dto.request.DeployDatabaseRequest;
import my_spring_app.my_spring_app.entity.ProjectDatabaseEntity;
import my_spring_app.my_spring_app.entity.ProjectEntity;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.entity.UserEntity;
import my_spring_app.my_spring_app.repository.ProjectDatabaseRepository;
import my_spring_app.my_spring_app.repository.ProjectRepository;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.repository.UserRepository;
import my_spring_app.my_spring_app.service.ProjectDatabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.Configuration;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Namespace;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1Scale;
import io.kubernetes.client.openapi.models.V1ScaleSpec;
import io.kubernetes.client.util.Config;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;

/**
 * Service implementation cho ProjectDatabase
 * Xử lý các nghiệp vụ liên quan đến triển khai database projects
 */
@Service
@Transactional
public class ProjectDatabaseServiceImpl extends BaseKubernetesService implements ProjectDatabaseService {

    @Autowired
    private ProjectDatabaseRepository projectDatabaseRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ServerRepository serverRepository;

    /**
     * Tạo short UUID từ UUID đầy đủ để sử dụng trong Kubernetes
     * UUID đầy đủ có 36 ký tự (với dấu gạch ngang), short UUID sẽ có độ dài cố định 12 ký tự
     * Đảm bảo tính duy nhất bằng cách kiểm tra trong database
     * 
     * @param fullUuid UUID đầy đủ từ UUID.randomUUID().toString()
     * @return Short UUID (12 ký tự) đảm bảo tính duy nhất
     */
    private String generateShortUuid(String fullUuid) {
        // Loại bỏ dấu gạch ngang và lấy 12 ký tự đầu
        String uuidWithoutDashes = fullUuid.replace("-", "");
        String shortUuid = uuidWithoutDashes.substring(0, 12);
        
        // Kiểm tra tính duy nhất trong database
        int attempt = 0;
        while (projectDatabaseRepository.existsByUuid_k8s(shortUuid)) {
            attempt++;
            // Nếu trùng, tạo UUID mới và lấy 12 ký tự đầu
            if (attempt > 100) {
                // Nếu quá nhiều lần thử, throw exception
                throw new RuntimeException("Không thể tạo short UUID duy nhất sau " + attempt + " lần thử");
            }
            // Tạo UUID mới
            fullUuid = UUID.randomUUID().toString();
            uuidWithoutDashes = fullUuid.replace("-", "");
            shortUuid = uuidWithoutDashes.substring(0, 12);
        }
        
        return shortUuid;
    }

    /**
     * Kiểm tra và tạo namespace trên Kubernetes cluster nếu chưa tồn tại
     * Sử dụng Kubernetes Java Client API
     * 
     * @param session SSH session đến MASTER server để lấy kubeconfig
     * @param namespace Tên namespace cần kiểm tra/tạo
     * @throws Exception Nếu có lỗi khi kiểm tra hoặc tạo namespace
     */
    private void ensureNamespaceExists(Session session, String namespace) throws Exception {
        System.out.println("[ensureNamespaceExists] Kiểm tra namespace: " + namespace);
        
        try {
            // Sử dụng method createKubernetesClient từ parent class (đã xử lý thay thế server URL)
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api();
            
            // Kiểm tra namespace đã tồn tại chưa
            try {
                V1Namespace ns = api.readNamespace(namespace, null);
                System.out.println("[ensureNamespaceExists] Namespace đã tồn tại: " + namespace + " (Status: " + 
                    (ns.getStatus() != null && ns.getStatus().getPhase() != null ? ns.getStatus().getPhase() : "Unknown") + ")");
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    // Namespace chưa tồn tại, tạo mới
                    System.out.println("[ensureNamespaceExists] Namespace chưa tồn tại, đang tạo mới: " + namespace);
                    V1Namespace newNamespace = new V1Namespace();
                    V1ObjectMeta metadata = new V1ObjectMeta();
                    metadata.setName(namespace);
                    newNamespace.setMetadata(metadata);
                    
                    V1Namespace createdNamespace = api.createNamespace(newNamespace, null, null, null, null);
                    System.out.println("[ensureNamespaceExists] Đã tạo namespace thành công: " + namespace);
                } else {
                    System.err.println("[ensureNamespaceExists] Lỗi API khi kiểm tra namespace. Code: " + e.getCode() + ", Message: " + e.getMessage());
                    throw new RuntimeException("Lỗi khi kiểm tra namespace: " + e.getMessage(), e);
                }
            }
            
        } catch (Exception e) {
            System.err.println("[ensureNamespaceExists] Lỗi: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Không thể kiểm tra/tạo namespace: " + e.getMessage(), e);
        }
    }

    /**
     * Helper method để tạo nội dung YAML Kubernetes cho MySQL database
     * Tạo file YAML bao gồm: Secret, Service, StatefulSet
     *
     * @param uuid_k8s Short UUID cho deployment
     * @param namespace Namespace để deploy vào Kubernetes
     * @param databaseName Database name
     * @param databaseUsername Database username
     * @param databasePassword Database password
     * @param storageSize Storage size in GB
     * @return Nội dung YAML đầy đủ cho Secret, Service và StatefulSet
     */
    private String generateMySQLYaml(String uuid_k8s, String namespace, String databaseName, 
                                      String databaseUsername, String databasePassword, Integer storageSize) {
        String resourceName = "db-" + uuid_k8s;
        String secretName = resourceName + "-secret";
        String serviceName = resourceName + "-svc";
        
        // Escape password để tránh lỗi YAML
        String escapedPassword = databasePassword.replace("'", "''").replace("\"", "\\\"");
        String escapedRootPassword = databasePassword.replace("'", "''").replace("\"", "\\\"");
        
        return "---\n" +
                "apiVersion: v1\n" +
                "kind: Secret\n" +
                "metadata:\n" +
                "  name: " + secretName + "\n" +
                "  namespace: " + namespace + "\n" +
                "type: Opaque\n" +
                "stringData:\n" +
                "  MYSQL_ROOT_PASSWORD: \"" + escapedRootPassword + "\"\n" +
                "  MYSQL_DATABASE: \"" + databaseName + "\"\n" +
                "  MYSQL_USER: \"" + databaseUsername + "\"\n" +
                "  MYSQL_PASSWORD: \"" + escapedPassword + "\"\n" +
                "---\n" +
                "apiVersion: v1\n" +
                "kind: Service\n" +
                "metadata:\n" +
                "  name: " + serviceName + "\n" +
                "  namespace: " + namespace + "\n" +
                "  labels:\n" +
                "    app: " + resourceName + "\n" +
                "spec:\n" +
                "  type: LoadBalancer\n" +
                "  selector:\n" +
                "    app: " + resourceName + "\n" +
                "  ports:\n" +
                "    - name: mysql\n" +
                "      port: 3306\n" +
                "      targetPort: 3306\n" +
                "---\n" +
                "apiVersion: apps/v1\n" +
                "kind: StatefulSet\n" +
                "metadata:\n" +
                "  name: " + resourceName + "\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  serviceName: " + serviceName + "\n" +
                "  replicas: 1\n" +
                "  selector:\n" +
                "    matchLabels:\n" +
                "      app: " + resourceName + "\n" +
                "  template:\n" +
                "    metadata:\n" +
                "      labels:\n" +
                "        app: " + resourceName + "\n" +
                "    spec:\n" +
                "      containers:\n" +
                "        - name: mysql\n" +
                "          image: mysql:8.0\n" +
                "          imagePullPolicy: IfNotPresent\n" +
                "          ports:\n" +
                "            - containerPort: 3306\n" +
                "              name: mysql\n" +
                "          envFrom:\n" +
                "            - secretRef:\n" +
                "                name: " + secretName + "\n" +
                "          args:\n" +
                "            - \"--default-authentication-plugin=mysql_native_password\"\n" +
                "            - \"--character-set-server=utf8mb4\"\n" +
                "            - \"--collation-server=utf8mb4_unicode_ci\"\n" +
                "          volumeMounts:\n" +
                "            - name: mysql-data\n" +
                "              mountPath: /var/lib/mysql\n" +
                "          readinessProbe:\n" +
                "            exec:\n" +
                "              command:\n" +
                "                - sh\n" +
                "                - -c\n" +
                "                - 'mysqladmin ping -h 127.0.0.1 -uroot -p\"$$MYSQL_ROOT_PASSWORD\"'\n" +
                "            initialDelaySeconds: 15\n" +
                "            periodSeconds: 5\n" +
                "          livenessProbe:\n" +
                "            exec:\n" +
                "              command:\n" +
                "                - sh\n" +
                "                - -c\n" +
                "                - 'mysqladmin ping -h 127.0.0.1 -uroot -p\"$$MYSQL_ROOT_PASSWORD\"'\n" +
                "            initialDelaySeconds: 30\n" +
                "            periodSeconds: 10\n" +
                "  volumeClaimTemplates:\n" +
                "    - metadata:\n" +
                "        name: mysql-data\n" +
                "      spec:\n" +
                "        accessModes: [\"ReadWriteOnce\"]\n" +
                "        storageClassName: local-path\n" +
                "        resources:\n" +
                "          requests:\n" +
                "            storage: " + (storageSize != null ? storageSize : 1) + "Gi\n";
    }

    /**
     * Helper method để tạo nội dung YAML Kubernetes cho MongoDB database
     * Tạo file YAML bao gồm: StatefulSet, Service
     *
     * @param uuid_k8s Short UUID cho deployment
     * @param namespace Namespace để deploy vào Kubernetes
     * @param databaseName Database name
     * @param databaseUsername Database username
     * @param databasePassword Database password
     * @param storageSize Storage size in GB
     * @return Nội dung YAML đầy đủ cho StatefulSet và Service
     */
    private String generateMongoDBYaml(String uuid_k8s, String namespace, String databaseName,
                                       String databaseUsername, String databasePassword, Integer storageSize) {
        String resourceName = "db-" + uuid_k8s;
        
        return "apiVersion: apps/v1\n" +
                "kind: StatefulSet\n" +
                "metadata:\n" +
                "  name: " + resourceName + "\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  serviceName: " + resourceName + "-svc\n" +
                "  replicas: 1\n" +
                "  selector:\n" +
                "    matchLabels:\n" +
                "      app: " + resourceName + "\n" +
                "  template:\n" +
                "    metadata:\n" +
                "      labels:\n" +
                "        app: " + resourceName + "\n" +
                "    spec:\n" +
                "      containers:\n" +
                "        - name: mongodb\n" +
                "          image: mongo:7.0\n" +
                "          env:\n" +
                "            - name: MONGO_INITDB_ROOT_USERNAME\n" +
                "              value: '" + databaseUsername + "'\n" +
                "            - name: MONGO_INITDB_ROOT_PASSWORD\n" +
                "              value: '" + databasePassword + "'\n" +
                "            - name: MONGO_INITDB_DATABASE\n" +
                "              value: '" + databaseName + "'\n" +
                "          ports:\n" +
                "            - containerPort: 27017\n" +
                "              name: mongodb\n" +
                "          volumeMounts:\n" +
                "            - name: mongodb-data\n" +
                "              mountPath: /data/db\n" +
                "  volumeClaimTemplates:\n" +
                "    - metadata:\n" +
                "        name: mongodb-data\n" +
                "      spec:\n" +
                "        accessModes: [ \"ReadWriteOnce\" ]\n" +
                "        resources:\n" +
                "          requests:\n" +
                "            storage: " + (storageSize != null ? storageSize : 10) + "Gi\n" +
                "---\n" +
                "apiVersion: v1\n" +
                "kind: Service\n" +
                "metadata:\n" +
                "  name: " + resourceName + "-svc\n" +
                "  namespace: " + namespace + "\n" +
                "spec:\n" +
                "  type: ClusterIP\n" +
                "  selector:\n" +
                "    app: " + resourceName + "\n" +
                "  ports:\n" +
                "    - port: 27017\n" +
                "      targetPort: 27017\n" +
                "      name: mongodb\n";
    }

    /**
     * Chờ PVC chuyển sang trạng thái Bound trước khi tiếp tục.
     */
    private void waitForPvcBound(Session session, String namespace, String pvcName, int timeoutSeconds) throws Exception {
        long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
        String status = "";
        String cmd = String.format("kubectl get pvc %s -n %s -o jsonpath='{.status.phase}'", pvcName, namespace);
        while (System.currentTimeMillis() < deadline) {
            try {
                status = executeCommand(session, cmd).replace("'", "").trim();
                if ("Bound".equalsIgnoreCase(status)) {
                    System.out.println("[waitForPvcBound] PVC " + pvcName + " đã ở trạng thái Bound");
                    return;
                }
                System.out.println("[waitForPvcBound] PVC " + pvcName + " hiện ở trạng thái: " + status + ", tiếp tục chờ...");
            } catch (Exception ex) {
                System.out.println("[waitForPvcBound] Không đọc được trạng thái PVC (sẽ thử lại): " + ex.getMessage());
            }
            Thread.sleep(5000);
        }
        throw new RuntimeException("PVC " + pvcName + " chưa sẵn sàng (trạng thái: " +
                (status == null ? "Unknown" : status) + ") sau " + timeoutSeconds + " giây. Vui lòng kiểm tra StorageClass/PV.");
    }

    /**
     * Chờ pod với nhãn app=<resourceName> chuyển sang trạng thái Ready.
     */
    private void waitForPodReady(Session session, String namespace, String resourceName, int timeoutSeconds) throws Exception {
        String waitCmd = String.format("kubectl wait --for=condition=ready pod -l app=%s -n %s --timeout=%ds",
                resourceName, namespace, timeoutSeconds);
        System.out.println("[waitForPodReady] " + waitCmd);
        executeCommand(session, waitCmd);
        System.out.println("[waitForPodReady] Pod với nhãn app=" + resourceName + " đã sẵn sàng");
    }

    /**
     * Helper method để thực thi lệnh qua SSH (tương thích với code cũ)
     * Gọi method từ parent class với ignoreNonZeroExit = false
     */
    private String executeCommand(Session session, String command) throws Exception {
        return executeCommand(session, command, false);
    }

    /**
     * Triển khai database project lên Kubernetes cluster
     * Tạo database trên K8s và import dữ liệu từ file SQL nếu có
     *
     * @param request Thông tin request để deploy database project
     * @return Response chứa thông tin database đã deploy
     * @throws RuntimeException Nếu có lỗi trong quá trình deploy
     */
    @Override
    public DeployDatabaseResponse deploy(DeployDatabaseRequest request) {
        System.out.println("[deployDatabase] Bắt đầu triển khai database project");

        // ========== BƯỚC 1: VALIDATE VÀ CHUẨN BỊ DỮ LIỆU ==========

        // Tìm user theo username
        Optional<UserEntity> userOptional = userRepository.findByUsername(request.getUsername());
        if (userOptional.isEmpty()) {
            throw new RuntimeException("User không tồn tại");
        }
        UserEntity user = userOptional.get();
        System.out.println("[deployDatabase] Tier của user: " + user.getTier());

        if ("STANDARD".equalsIgnoreCase(user.getTier())) {
            long databaseCount = projectDatabaseRepository.countByProject_User(user);
            System.out.println("[deployDatabase] User STANDARD hiện có " + databaseCount + " database project(s)");
            if (databaseCount >= 1) {
                String errorMessage = "Tài khoản STANDARD chỉ được phép triển khai 1 database. Vui lòng nâng cấp gói để tiếp tục.";
                System.err.println("[deployDatabase] Lỗi: " + errorMessage);
                throw new RuntimeException(errorMessage);
            }
        }

        // Lấy ProjectEntity từ projectId
        Optional<ProjectEntity> projectOptional = projectRepository.findById(request.getProjectId());
        if (projectOptional.isEmpty()) {
            throw new RuntimeException("Project không tồn tại với id: " + request.getProjectId());
        }
        ProjectEntity project = projectOptional.get();

        // Validate database type (chỉ hỗ trợ MYSQL, MONGODB)
        String databaseType = request.getDatabaseType().toUpperCase();
        if (!"MYSQL".equals(databaseType) && !"MONGODB".equals(databaseType)) {
            throw new RuntimeException("Database type không hợp lệ. Chỉ hỗ trợ MYSQL, MONGODB");
        }

        // Tạo UUID đầy đủ để đảm bảo tính duy nhất
        String fullUuid = UUID.randomUUID().toString();
        // Tạo short UUID từ UUID đầy đủ để sử dụng trong Kubernetes (12 ký tự)
        String uuid_k8s = generateShortUuid(fullUuid);
        System.out.println("[deployDatabase] Tạo UUID đầy đủ: " + fullUuid);
        System.out.println("[deployDatabase] Short UUID cho deployment: " + uuid_k8s + " (độ dài: " + uuid_k8s.length() + " ký tự)");

        // Lấy namespace từ ProjectEntity
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace. Vui lòng cấu hình namespace cho project.");
        }
        System.out.println("[deployDatabase] Sử dụng namespace từ ProjectEntity: " + namespace);

        // Sử dụng thông tin database từ request
        String databaseName = request.getDatabaseName();
        String databaseUsername = request.getDatabaseUsername();
        String databasePassword = request.getDatabasePassword();

        // Thiết lập storage size mặc định dựa trên loại database
        // MySQL: 1GB, MongoDB: 10GB
        Integer storageSize = "MYSQL".equals(databaseType) ? 1 : 10;

        // Tạo ProjectDatabaseEntity và thiết lập các thuộc tính cơ bản
        ProjectDatabaseEntity projectEntity = new ProjectDatabaseEntity();
        projectEntity.setProjectName(request.getProjectName());
        projectEntity.setDatabaseType(databaseType);
        projectEntity.setStatus("BUILDING"); // Trạng thái ban đầu là BUILDING
        projectEntity.setProject(project);
        projectEntity.setUuid_k8s(uuid_k8s);
        projectEntity.setDatabaseName(databaseName);
        projectEntity.setDatabaseUsername(databaseUsername);
        projectEntity.setDatabasePassword(databasePassword);
        projectEntity.setStorageSize(storageSize);

        // ========== BƯỚC 2: LẤY THÔNG TIN SERVER TỪ DATABASE ==========

        // Lấy thông tin MASTER server (Kubernetes cluster)
        Optional<ServerEntity> masterServerOptional = serverRepository.findByRole("MASTER");

        // Validate server bắt buộc
        if (masterServerOptional.isEmpty()) {
            throw new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống.");
        }

        ServerEntity masterServer = masterServerOptional.get();

        // Set port theo loại database: MYSQL = 3306, MONGODB = 27017
        // Database IP sẽ được lấy từ EXTERNAL-IP sau khi apply YAML
        if ("MYSQL".equals(databaseType)) {
            projectEntity.setDatabasePort(3306);
        } else if ("MONGODB".equals(databaseType)) {
            projectEntity.setDatabasePort(27017);
        }

        // Khởi tạo các biến để quản lý SSH/SFTP connections
        Session masterSession = null;
        ChannelSftp sftpMaster = null;

        try {
            // ========== BƯỚC 3: KẾT NỐI ĐẾN MASTER SERVER ==========

            System.out.println("[deployDatabase] Kết nối SSH đến MASTER server: " + masterServer.getIp() + ":" + masterServer.getPort());
            JSch jsch = new JSch();
            masterSession = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
            masterSession.setPassword(masterServer.getPassword());
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            masterSession.setConfig(config);
            masterSession.setTimeout(7000);
            masterSession.connect();
            System.out.println("[deployDatabase] Kết nối SSH đến MASTER server thành công");

            // ========== BƯỚC 4: KIỂM TRA VÀ TẠO NAMESPACE ==========

            ensureNamespaceExists(masterSession, namespace);

            // ========== BƯỚC 5: XỬ LÝ FILE DATABASE (NẾU CÓ) ==========

            String sqlFilePath = null;

            if (request.getFile() != null && !request.getFile().isEmpty()) {
                // Upload database file lên MASTER server
                Channel channelMaster = masterSession.openChannel("sftp");
                channelMaster.connect();
                sftpMaster = (ChannelSftp) channelMaster;

                String dbFileName = request.getFile().getOriginalFilename();
                // Tạo thư mục với UUID để tránh trùng tên: /home/<master_username>/uploads/<username>/<uuid_k8s của project>/database/<uuid_k8s>
                String remoteDbBase = "/home/" + masterServer.getUsername() + "/uploads/" + user.getUsername() + "/" + project.getUuid_k8s() + "/database/" + uuid_k8s;

                System.out.println("[deployDatabase] Tạo/cd thư mục đích: " + remoteDbBase);
                // Đảm bảo thư mục tồn tại
                String[] parts = remoteDbBase.split("/");
                String cur = "";
                for (String p : parts) {
                    if (p == null || p.isBlank()) continue;
                    cur += "/" + p;
                    try {
                        sftpMaster.cd(cur);
                    } catch (Exception e) {
                        sftpMaster.mkdir(cur);
                        sftpMaster.cd(cur);
                    }
                }

                String dbRemotePath = remoteDbBase + "/" + dbFileName;
                System.out.println("[deployDatabase] Upload database file lên: " + dbRemotePath);
                sftpMaster.put(request.getFile().getInputStream(), dbRemotePath);
                System.out.println("[deployDatabase] Đã upload database file lên MASTER server: " + dbRemotePath);

                // Lưu đường dẫn file vào entity
                projectEntity.setSourcePath(dbRemotePath);

                // Giải nén file database (nếu là .zip)
                if (dbFileName != null && dbFileName.endsWith(".zip")) {
                    // Bỏ qua thư mục/mac metadata (__MACOSX, .DS_Store)
                    String unzipCmd = "cd " + remoteDbBase + " && unzip -o '" + dbFileName + "' -x '__MACOSX/*' '*.DS_Store'";
                    System.out.println("[deployDatabase] Giải nén database file: " + unzipCmd);
                    executeCommand(masterSession, unzipCmd);

                    // Tìm file .sql trong thư mục đã giải nén
                    String findSqlCmd = "cd " + remoteDbBase + " && find . -type f -name '*.sql' "
                            + "! -path '*__MACOSX*' "
                            + "! -name '._*' "
                            + "| head -1";
                    String sqlFile = executeCommand(masterSession, findSqlCmd).trim();
                    if (!sqlFile.isEmpty()) {
                        sqlFile = sqlFile.replaceFirst("^\\./", "");
                        sqlFilePath = remoteDbBase + "/" + sqlFile;
                        System.out.println("[deployDatabase] Tìm thấy file SQL: " + sqlFilePath);
                    } else {
                        System.out.println("[deployDatabase] Không tìm thấy file .sql trong thư mục đã giải nén");
                    }
                } else if (dbFileName != null && dbFileName.endsWith(".sql")) {
                    sqlFilePath = dbRemotePath;
                    System.out.println("[deployDatabase] Sử dụng file SQL trực tiếp: " + sqlFilePath);
                }

                sftpMaster.disconnect();
                sftpMaster = null;
            }

            // ========== BƯỚC 6: TẠO VÀ APPLY YAML CHO DATABASE ==========

            // Tạo nội dung YAML file
            String fileName = uuid_k8s + ".yaml";
            String yamlContent;
            if ("MYSQL".equals(databaseType)) {
                yamlContent = generateMySQLYaml(uuid_k8s, namespace, databaseName, databaseUsername, databasePassword, storageSize);
            } else {
                // MONGODB
                yamlContent = generateMongoDBYaml(uuid_k8s, namespace, databaseName, databaseUsername, databasePassword, storageSize);
            }

            // Mở SFTP channel để upload YAML file
            Channel sftpYamlCh = masterSession.openChannel("sftp");
            sftpYamlCh.connect();
            sftpMaster = (ChannelSftp) sftpYamlCh;

            // Tạo thư mục đích với UUID: /home/<master_username>/uploads/<username>/<uuid_k8s của project>/database/<uuid_k8s>
            String yamlRemoteDir = "/home/" + masterServer.getUsername() + "/uploads/" + user.getUsername() + "/" + project.getUuid_k8s() + "/database/" + uuid_k8s;
            System.out.println("[deployDatabase] Tạo/cd thư mục YAML: " + yamlRemoteDir);
            String[] yamlDirParts = yamlRemoteDir.split("/");
            String yamlCur = "";
            for (String p : yamlDirParts) {
                if (p == null || p.isBlank()) continue;
                yamlCur += "/" + p;
                try {
                    sftpMaster.cd(yamlCur);
                } catch (Exception e) {
                    sftpMaster.mkdir(yamlCur);
                    sftpMaster.cd(yamlCur);
                }
            }

            // Upload YAML file lên MASTER server
            InputStream yamlStream = new ByteArrayInputStream(yamlContent.getBytes(StandardCharsets.UTF_8));
            String yamlRemotePath = yamlRemoteDir + "/" + fileName;
            sftpMaster.put(yamlStream, yamlRemotePath);
            System.out.println("[deployDatabase] Đã upload YAML file: " + yamlRemotePath);

            // Lưu yamlPath (đường dẫn YAML trên MASTER server)
            projectEntity.setYamlPath(yamlRemotePath);

            // Apply YAML file vào Kubernetes cluster bằng kubectl
            System.out.println("[deployDatabase] Đang apply YAML: kubectl apply -f " + yamlRemotePath);
            executeCommand(masterSession, "kubectl apply -f '" + yamlRemotePath + "'");

            String resourceName = "db-" + uuid_k8s;
            String pvcNamePrefix = "MYSQL".equalsIgnoreCase(databaseType) ? "mysql-data-" : "mongodb-data-";
            String pvcName = pvcNamePrefix + resourceName + "-0";

            // Đợi PVC được bind và pod sẵn sàng trước khi thao tác thêm (ví dụ copy file SQL)
            waitForPvcBound(masterSession, namespace, pvcName, 300);
            waitForPodReady(masterSession, namespace, resourceName, 300);

            // Đợi một chút để service được tạo
            System.out.println("[deployDatabase] Đợi service được tạo...");
            Thread.sleep(3000); // Đợi 3 giây

            // ========== BƯỚC 6.5: LẤY EXTERNAL-IP TỪ SERVICE ==========
            
            String serviceName = "db-" + uuid_k8s + "-svc";
            System.out.println("[deployDatabase] Đang lấy EXTERNAL-IP từ service: " + serviceName);
            
            // Chờ EXTERNAL-IP được assign (có thể mất vài giây với LoadBalancer)
            String externalIp = null;
            int maxRetries = 30; // Tối đa 30 lần thử (30 giây)
            for (int i = 0; i < maxRetries; i++) {
                try {
                    String getSvcCmd = "kubectl get svc " + serviceName + " -n " + namespace + " -o jsonpath='{.status.loadBalancer.ingress[0].ip}'";
                    String result = executeCommand(masterSession, getSvcCmd);
                    if (result != null && !result.trim().isEmpty() && !result.trim().equals("<none>")) {
                        externalIp = result.trim();
                        System.out.println("[deployDatabase] Đã lấy được EXTERNAL-IP: " + externalIp);
                        break;
                    }
                } catch (Exception e) {
                    System.out.println("[deployDatabase] Lần thử " + (i + 1) + "/" + maxRetries + ": Chưa có EXTERNAL-IP, đợi thêm...");
                }
                
                if (i < maxRetries - 1) {
                    Thread.sleep(1000); // Đợi 1 giây trước khi thử lại
                }
            }
            
            if (externalIp == null || externalIp.isEmpty()) {
                System.err.println("[deployDatabase] WARNING: Không thể lấy EXTERNAL-IP sau " + maxRetries + " lần thử");
                System.err.println("[deployDatabase] Sử dụng service name làm database IP");
                // Fallback: sử dụng service name
                externalIp = serviceName + "." + namespace + ".svc.cluster.local";
            }
            
            // Cập nhật database IP với EXTERNAL-IP
            projectEntity.setDatabaseIp(externalIp);
            System.out.println("[deployDatabase] Database IP đã được cập nhật: " + externalIp);

            // Đợi một chút để database pod khởi động
            System.out.println("[deployDatabase] Đợi database pod khởi động...");
            Thread.sleep(2000); // Đợi thêm 2 giây

            // ========== BƯỚC 7: IMPORT FILE SQL (NẾU CÓ) ==========

            if (sqlFilePath != null && "MYSQL".equals(databaseType)) {
                // Import file SQL vào MySQL pod
                String podName = "db-" + uuid_k8s + "-0"; // StatefulSet pod name
                System.out.println("[deployDatabase] Bắt đầu import file SQL vào pod: " + podName);
                
                // Copy file SQL vào pod trước
                String copyCmd = "kubectl cp " + sqlFilePath + " " + namespace + "/" + podName + ":/tmp/import.sql";
                System.out.println("[deployDatabase] Copy file SQL vào pod: " + copyCmd);
                try {
                    executeCommand(masterSession, copyCmd);
                    System.out.println("[deployDatabase] Đã copy file SQL vào pod");
                } catch (Exception e) {
                    System.err.println("[deployDatabase] Lỗi khi copy file SQL vào pod: " + e.getMessage());
                    throw new RuntimeException("Không thể copy file SQL vào pod: " + e.getMessage(), e);
                }
                
                // Import SQL từ file trong pod
                String importCmd = "kubectl exec -n " + namespace + " " + podName + " -- sh -c \"mysql -u" + databaseUsername + " -p'" + databasePassword + "' " + databaseName + " < /tmp/import.sql\"";
                System.out.println("[deployDatabase] Thực thi import SQL: " + importCmd);
                try {
                    String importOutput = executeCommand(masterSession, importCmd);
                    if (!importOutput.isEmpty()) {
                        System.out.println("[deployDatabase] Output từ import SQL: " + importOutput);
                    }
                    System.out.println("[deployDatabase] Đã import file SQL thành công");
                    
                    // Xóa file tạm trong pod
                    String cleanupCmd = "kubectl exec -n " + namespace + " " + podName + " -- rm -f /tmp/import.sql";
                    executeCommand(masterSession, cleanupCmd);
                } catch (Exception e) {
                    System.err.println("[deployDatabase] Lỗi khi import file SQL: " + e.getMessage());
                    System.err.println("[deployDatabase] WARNING: Import SQL thất bại nhưng database đã được tạo");
                } finally {
                    // Dọn dẹp file SQL và file nén đã upload
                    try {
                        String deleteSqlCmd = String.format("rm -f '%s' || true", escapeSingleQuotes(sqlFilePath));
                        System.out.println("[deployDatabase] Dọn dẹp file SQL: " + deleteSqlCmd);
                        executeCommand(masterSession, deleteSqlCmd, true);
                    } catch (Exception cleanupEx) {
                        System.err.println("[deployDatabase] Lỗi khi dọn dẹp file SQL (bỏ qua): " + cleanupEx.getMessage());
                    }

                    String sourcePath = projectEntity.getSourcePath();
                    if (sourcePath != null && !sourcePath.trim().isEmpty()) {
                        String trimmedSource = sourcePath.trim();
                        try {
                            String deleteZipCmd = String.format("rm -f '%s' || true", escapeSingleQuotes(trimmedSource));
                            System.out.println("[deployDatabase] Dọn dẹp file nén đã upload: " + deleteZipCmd);
                            executeCommand(masterSession, deleteZipCmd, true);
                        } catch (Exception cleanupEx) {
                            System.err.println("[deployDatabase] Lỗi khi dọn dẹp file nén (bỏ qua): " + cleanupEx.getMessage());
                        }
                    }
                }
            } else if (sqlFilePath != null && "MONGODB".equals(databaseType)) {
                // TODO: Xử lý import cho MongoDB
                System.out.println("[deployDatabase] Import MongoDB chưa được hỗ trợ");
            }

            // ========== BƯỚC 8: CẬP NHẬT TRẠNG THÁI VÀ TRẢ VỀ KẾT QUẢ ==========

            // Cập nhật thông tin vào entity
            projectEntity.setStatus("RUNNING");
            projectDatabaseRepository.save(projectEntity);
            System.out.println("[deployDatabase] Hoàn tất triển khai database, projectName=" + request.getProjectName() + ", databaseName=" + databaseName);

            // Tạo response và trả về
            DeployDatabaseResponse response = new DeployDatabaseResponse();
            response.setStatus(projectEntity.getStatus());
            response.setDatabaseIp(projectEntity.getDatabaseIp());
            response.setDatabasePort(projectEntity.getDatabasePort());
            response.setDatabaseName(databaseName);
            response.setDatabaseUsername(databaseUsername);
            response.setDatabasePassword(databasePassword);
            return response;

        } catch (Exception ex) {
            // ========== XỬ LÝ LỖI ==========
            System.err.println("[deployDatabase] Lỗi: " + ex.getMessage());
            ex.printStackTrace();
            // Cập nhật trạng thái project thành ERROR
            projectEntity.setStatus("ERROR");
            projectDatabaseRepository.save(projectEntity);
            throw new RuntimeException("Lỗi khi triển khai database: " + ex.getMessage(), ex);
        } finally {
            // ========== DỌN DẸP TÀI NGUYÊN ==========
            if (sftpMaster != null && sftpMaster.isConnected()) {
                sftpMaster.disconnect();
            }
            if (masterSession != null && masterSession.isConnected()) {
                masterSession.disconnect();
            }
            System.out.println("[deployDatabase] Đã đóng các kết nối SSH/SFTP");
        }
    }

    /**
     * Dừng database bằng cách scale StatefulSet về 0 replicas
     * 
     * @param projectId ID của project
     * @param databaseId ID của database cần dừng
     */
    @Override
    public void stopDatabase(Long projectId, Long databaseId) {
        System.out.println("[stopDatabase] Yêu cầu dừng database projectId=" + projectId + ", databaseId=" + databaseId);

        // Lấy project để kiểm tra quyền sở hữu database
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project không tồn tại với id: " + projectId));

        // Lấy database cần dừng
        ProjectDatabaseEntity database = projectDatabaseRepository.findById(databaseId)
                .orElseThrow(() -> new RuntimeException("Database project không tồn tại với id: " + databaseId));

        // Đảm bảo database thuộc về đúng project
        if (database.getProject() == null || !database.getProject().getId().equals(project.getId())) {
            throw new RuntimeException("Database project không thuộc về project này");
        }

        // Scale StatefulSet về 0 để dừng database
        scaleDatabaseStatefulSet(project, database, 0);

        // Cập nhật trạng thái
        database.setStatus("STOPPED");
        projectDatabaseRepository.save(database);
        System.out.println("[stopDatabase] Đã dừng database thành công");
    }

    /**
     * Khởi động database bằng cách scale StatefulSet về 1 replica
     * 
     * @param projectId ID của project
     * @param databaseId ID của database cần khởi động
     */
    @Override
    public void startDatabase(Long projectId, Long databaseId) {
        System.out.println("[startDatabase] Yêu cầu khởi động database projectId=" + projectId + ", databaseId=" + databaseId);

        // Lấy project để kiểm tra quyền sở hữu database
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project không tồn tại với id: " + projectId));

        // Lấy database cần khởi động
        ProjectDatabaseEntity database = projectDatabaseRepository.findById(databaseId)
                .orElseThrow(() -> new RuntimeException("Database project không tồn tại với id: " + databaseId));

        // Đảm bảo database thuộc về đúng project
        if (database.getProject() == null || !database.getProject().getId().equals(project.getId())) {
            throw new RuntimeException("Database project không thuộc về project này");
        }

        // Scale StatefulSet về 1 để khởi động database
        scaleDatabaseStatefulSet(project, database, 1);

        // Cập nhật trạng thái
        database.setStatus("RUNNING");
        projectDatabaseRepository.save(database);
        System.out.println("[startDatabase] Đã khởi động database thành công");
    }

    /**
     * Override method createKubernetesClient để thay thế server URL trong kubeconfig
     * trước khi feed cho Java Kubernetes client
     */
    @Override
    protected ApiClient createKubernetesClient(Session session) throws Exception {
        String kubeconfigPath = "~/.kube/config";
        System.out.println("[createKubernetesClient] Đang đọc kubeconfig từ: " + kubeconfigPath);
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

            // Lấy IP MASTER và thay thế server URL trong kubeconfig trước khi sử dụng
            Optional<ServerEntity> masterOpt = serverRepository.findByRole("MASTER");
            if (masterOpt.isPresent()) {
                String masterIp = masterOpt.get().getIp();
                kubeconfigContent = replaceKubeconfigServer(kubeconfigContent, masterIp);
            } else {
                System.err.println("[createKubernetesClient] WARNING: Không tìm thấy server MASTER để thay server URL trong kubeconfig");
            }

            tempKubeconfig = File.createTempFile("kubeconfig-", ".yaml");
            try (FileWriter writer = new FileWriter(tempKubeconfig)) {
                writer.write(kubeconfigContent);
            }
            System.out.println("[createKubernetesClient] Đã tạo kubeconfig tạm tại: " + tempKubeconfig.getAbsolutePath());

            ApiClient client = Config.fromConfig(tempKubeconfig.getAbsolutePath());
            Configuration.setDefaultApiClient(client);
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
     * Helper method để scale StatefulSet của database
     * 
     * @param project Project chứa database
     * @param database Database cần scale
     * @param replicas Số replicas (0 để dừng, 1 để chạy)
     */
    private void scaleDatabaseStatefulSet(ProjectEntity project, ProjectDatabaseEntity database, int replicas) {
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace. Không thể thay đổi replicas database.");
        }

        // Tên StatefulSet là "db-" + uuid_k8s
        String statefulSetName = "db-" + database.getUuid_k8s();

        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session clusterSession = null;
        try {
            JSch jsch = new JSch();
            clusterSession = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
            clusterSession.setPassword(masterServer.getPassword());
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            clusterSession.setConfig(config);
            clusterSession.setTimeout(7000);
            clusterSession.connect();
            System.out.println("[scaleDatabaseStatefulSet] Đã kết nối tới MASTER server");

            ApiClient client = createKubernetesClient(clusterSession);
            AppsV1Api appsApi = new AppsV1Api(client);

            // Đọc scale hiện tại của StatefulSet
            V1Scale scale = appsApi.readNamespacedStatefulSetScale(statefulSetName, namespace, null);
            if (scale.getSpec() == null) {
                scale.setSpec(new V1ScaleSpec());
            }
            scale.getSpec().setReplicas(replicas);
            
            // Cập nhật scale
            appsApi.replaceNamespacedStatefulSetScale(statefulSetName, namespace, scale, null, null, null, null);
            System.out.println("[scaleDatabaseStatefulSet] Đã scale StatefulSet " + statefulSetName + " về " + replicas + " replica(s)");
        } catch (Exception e) {
            System.err.println("[scaleDatabaseStatefulSet] Lỗi: " + e.getMessage());
            throw new RuntimeException("Không thể scale database: " + e.getMessage(), e);
        } finally {
            if (clusterSession != null && clusterSession.isConnected()) {
                clusterSession.disconnect();
            }
        }
    }

    /**
     * Xóa database project và tất cả các tài nguyên liên quan trên Kubernetes
     * Xóa StatefulSet, Service, Secret (nếu là MySQL), PVC và YAML files
     * 
     * @param projectId ID của project
     * @param databaseId ID của database cần xóa
     */
    @Override
    public void deleteDatabase(Long projectId, Long databaseId) {
        System.out.println("[deleteDatabase] Yêu cầu xóa database projectId=" + projectId + ", databaseId=" + databaseId);

        // Lấy project để kiểm tra quyền sở hữu database
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project không tồn tại với id: " + projectId));

        // Lấy database cần xóa
        ProjectDatabaseEntity database = projectDatabaseRepository.findById(databaseId)
                .orElseThrow(() -> new RuntimeException("Database project không tồn tại với id: " + databaseId));

        // Đảm bảo database thuộc về đúng project
        if (database.getProject() == null || !database.getProject().getId().equals(project.getId())) {
            throw new RuntimeException("Database project không thuộc về project này");
        }

        // Xóa tài nguyên trên Kubernetes
        deleteDatabaseResources(project, database);

        // Xóa record khỏi database
        projectDatabaseRepository.delete(database);
        System.out.println("[deleteDatabase] Đã xóa database thành công");
    }

    /**
     * Helper method để xóa các tài nguyên Kubernetes của database
     * Xóa StatefulSet, Service, Secret (cho MySQL), PVC và YAML files
     * 
     * @param project Project chứa database
     * @param database Database cần xóa
     */
    private void deleteDatabaseResources(ProjectEntity project, ProjectDatabaseEntity database) {
        String namespace = project.getNamespace();
        if (namespace == null || namespace.trim().isEmpty()) {
            throw new RuntimeException("Project không có namespace. Không thể xóa resources database.");
        }

        String uuid = database.getUuid_k8s();
        if (uuid == null || uuid.trim().isEmpty()) {
            throw new RuntimeException("Database không có uuid_k8s. Không thể xóa resources database.");
        }

        String statefulSetName = "db-" + uuid;
        String serviceName = statefulSetName + "-svc";
        String secretName = statefulSetName + "-secret"; // Chỉ cho MySQL
        
        // Xác định PVC name dựa trên loại database
        String pvcName;
        String databaseType = database.getDatabaseType();
        if ("MYSQL".equalsIgnoreCase(databaseType)) {
            pvcName = "mysql-data-" + statefulSetName + "-0";
        } else if ("MONGODB".equalsIgnoreCase(databaseType)) {
            pvcName = "mongodb-data-" + statefulSetName + "-0";
        } else {
            // Fallback: thử xóa cả 2 loại PVC
            pvcName = null;
        }

        ServerEntity masterServer = serverRepository.findByRole("MASTER")
                .orElseThrow(() -> new RuntimeException("Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));

        Session clusterSession = null;
        try {
            // Kết nối SSH tới MASTER server để có thể chạy lệnh kubectl
            JSch jsch = new JSch();
            clusterSession = jsch.getSession(masterServer.getUsername(), masterServer.getIp(), masterServer.getPort());
            clusterSession.setPassword(masterServer.getPassword());
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            clusterSession.setConfig(config);
            clusterSession.setTimeout(7000);
            clusterSession.connect();
            System.out.println("[deleteDatabaseResources] Đã kết nối MASTER server để xóa resources");

            // Xóa StatefulSet
            String deleteStatefulSetCmd = String.format("kubectl -n %s delete statefulset/%s || true", namespace, statefulSetName);
            System.out.println("[deleteDatabaseResources] " + deleteStatefulSetCmd);
            executeCommand(clusterSession, deleteStatefulSetCmd, true);

            // Xóa Service
            String deleteServiceCmd = String.format("kubectl -n %s delete svc/%s || true", namespace, serviceName);
            System.out.println("[deleteDatabaseResources] " + deleteServiceCmd);
            executeCommand(clusterSession, deleteServiceCmd, true);

            // Xóa Secret (chỉ cho MySQL)
            if ("MYSQL".equalsIgnoreCase(databaseType)) {
                String deleteSecretCmd = String.format("kubectl -n %s delete secret/%s || true", namespace, secretName);
                System.out.println("[deleteDatabaseResources] " + deleteSecretCmd);
                executeCommand(clusterSession, deleteSecretCmd, true);
            }

            // Xóa PVC chứa dữ liệu
            if (pvcName != null) {
                String deletePvcCmd = String.format("kubectl -n %s delete pvc/%s || true", namespace, pvcName);
                System.out.println("[deleteDatabaseResources] " + deletePvcCmd);
                executeCommand(clusterSession, deletePvcCmd, true);
            } else {
                // Nếu không xác định được loại database, thử xóa cả 2 loại PVC
                String deleteMySqlPvcCmd = String.format("kubectl -n %s delete pvc/mysql-data-%s-0 || true", namespace, statefulSetName);
                System.out.println("[deleteDatabaseResources] " + deleteMySqlPvcCmd);
                executeCommand(clusterSession, deleteMySqlPvcCmd, true);
                
                String deleteMongoPvcCmd = String.format("kubectl -n %s delete pvc/mongodb-data-%s-0 || true", namespace, statefulSetName);
                System.out.println("[deleteDatabaseResources] " + deleteMongoPvcCmd);
                executeCommand(clusterSession, deleteMongoPvcCmd, true);
            }

            // Xóa YAML file và thư mục chứa nó
            String yamlPath = database.getYamlPath();
            if (yamlPath != null && !yamlPath.trim().isEmpty()) {
                String cleanedPath = yamlPath.trim();
                String deleteYamlCmd = String.format("rm -f '%s'", escapeSingleQuotes(cleanedPath));
                System.out.println("[deleteDatabaseResources] " + deleteYamlCmd);
                executeCommand(clusterSession, deleteYamlCmd, true);

                // Xóa thư mục chứa file YAML
                java.io.File yamlFile = new java.io.File(cleanedPath);
                String parentDir = yamlFile.getParent();
                if (parentDir != null && !parentDir.trim().isEmpty()) {
                    String deleteDirCmd = String.format("rm -rf '%s'", escapeSingleQuotes(parentDir.trim()));
                    System.out.println("[deleteDatabaseResources] " + deleteDirCmd);
                    executeCommand(clusterSession, deleteDirCmd, true);
                }
            }
        } catch (Exception e) {
            System.err.println("[deleteDatabaseResources] Lỗi: " + e.getMessage());
            throw new RuntimeException("Không thể xóa resources database: " + e.getMessage(), e);
        } finally {
            if (clusterSession != null && clusterSession.isConnected()) {
                clusterSession.disconnect();
            }
        }
    }

    /**
     * Helper method để escape single quotes trong shell command
     * 
     * @param input Chuỗi cần escape
     * @return Chuỗi đã escape
     */
    private String escapeSingleQuotes(String input) {
        return input.replace("'", "'\"'\"'");
    }
}

