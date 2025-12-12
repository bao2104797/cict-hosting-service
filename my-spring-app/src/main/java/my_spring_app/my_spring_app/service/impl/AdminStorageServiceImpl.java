package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.Session;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.CoreV1Event;
import io.kubernetes.client.openapi.models.CoreV1EventList;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1ObjectReference;
import io.kubernetes.client.openapi.models.V1PersistentVolume;
import io.kubernetes.client.openapi.models.V1PersistentVolumeClaim;
import io.kubernetes.client.openapi.models.V1PersistentVolumeClaimCondition;
import io.kubernetes.client.openapi.models.V1PersistentVolumeClaimSpec;
import io.kubernetes.client.openapi.models.V1PersistentVolumeClaimStatus;
import io.kubernetes.client.openapi.models.V1PersistentVolumeSpec;
import io.kubernetes.client.openapi.models.V1PersistentVolumeStatus;
import io.kubernetes.client.openapi.models.V1ResourceRequirements;
import io.kubernetes.client.openapi.models.V1NFSVolumeSource;
import io.kubernetes.client.openapi.models.V1HostPathVolumeSource;
import io.kubernetes.client.openapi.models.V1LocalVolumeSource;
import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.openapi.models.V1Pod;
import io.kubernetes.client.openapi.models.V1PodList;
import io.kubernetes.client.openapi.models.V1Volume;
import my_spring_app.my_spring_app.dto.reponse.PVCDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.PVCListResponse;
import my_spring_app.my_spring_app.dto.reponse.PVCResponse;
import my_spring_app.my_spring_app.dto.reponse.PVListResponse;
import my_spring_app.my_spring_app.dto.reponse.PVDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.PVResponse;
import my_spring_app.my_spring_app.dto.request.PVCRequest;
import my_spring_app.my_spring_app.dto.request.PVRequest;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.service.AdminStorageService;
import io.kubernetes.client.util.Yaml;
import io.kubernetes.client.util.Config;
import io.kubernetes.client.openapi.Configuration;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AdminStorageServiceImpl extends BaseKubernetesService implements AdminStorageService {

    private final ServerRepository serverRepository;

    public AdminStorageServiceImpl(ServerRepository serverRepository) {
        this.serverRepository = serverRepository;
    }

    private ServerEntity getMasterServer() {
        return serverRepository.findByRole("MASTER").orElseThrow(() -> new RuntimeException(
                "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));
    }

    /**
     * Override method createKubernetesClient để thay thế server URL trong kubeconfig
     * trước khi feed cho Java Kubernetes client
     */
    @Override
    protected ApiClient createKubernetesClient(Session session) throws Exception {
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

    @Override
    public PVCListResponse getPVCs() {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            io.kubernetes.client.openapi.models.V1PersistentVolumeClaimList pvcList = api
                    .listPersistentVolumeClaimForAllNamespaces(
                            null, null, null, null, null, null, null, null, null, null, null);

            List<PVCResponse> pvcs = new ArrayList<>();
            if (pvcList.getItems() != null) {
                for (V1PersistentVolumeClaim v1PVC : pvcList.getItems()) {
                    try {
                        pvcs.add(buildPVCResponse(v1PVC));
                    } catch (Exception ignored) {
                    }
                }
            }
            return new PVCListResponse(pvcs);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy danh sách PVCs từ Kubernetes API: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy danh sách PVCs: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVCResponse getPVC(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            V1PersistentVolumeClaim pvc = api.readNamespacedPersistentVolumeClaim(name, namespace, null);
            if (pvc == null) {
                throw new RuntimeException("PVC không tồn tại");
            }
            return buildPVCResponse(pvc);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy pvc: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy pvc: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVCDetailResponse getPVCDetail(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1PersistentVolumeClaim pvc = api.readNamespacedPersistentVolumeClaim(name, namespace, null);
            if (pvc == null) {
                throw new RuntimeException("PVC không tồn tại");
            }

            PVCDetailResponse detail = new PVCDetailResponse();
            detail.setId(name + "-" + namespace);
            detail.setName(name);
            detail.setNamespace(namespace);
            detail.setAge(calculateAge(pvc.getMetadata().getCreationTimestamp()));

            V1PersistentVolumeClaimSpec spec = pvc.getSpec();
            if (spec != null) {
                if (spec.getAccessModes() != null) {
                    detail.setAccessModes(new ArrayList<>(spec.getAccessModes()));
                }
                detail.setStorageClass(spec.getStorageClassName());
                detail.setVolume(spec.getVolumeName());
                detail.setVolumeMode(spec.getVolumeMode());
                detail.setVolumeAttributesClass(null);
            }

            V1PersistentVolumeClaimStatus status = pvc.getStatus();
            if (status != null) {
                detail.setStatus(status.getPhase());
                if (status.getCapacity() != null && status.getCapacity().containsKey("storage")) {
                    detail.setCapacity(parseQuantityToGB(status.getCapacity().get("storage")));
                } else if (spec != null && spec.getResources() != null
                        && spec.getResources().getRequests() != null
                        && spec.getResources().getRequests().containsKey("storage")) {
                    detail.setCapacity(parseQuantityToGB(spec.getResources().getRequests().get("storage")));
                }
                if (status.getConditions() != null) {
                    List<PVCDetailResponse.ConditionInfo> conditions = new ArrayList<>();
                    for (V1PersistentVolumeClaimCondition condition : status.getConditions()) {
                        PVCDetailResponse.ConditionInfo conditionInfo = new PVCDetailResponse.ConditionInfo();
                        conditionInfo.setType(condition.getType());
                        conditionInfo.setStatus(condition.getStatus());
                        conditionInfo.setReason(condition.getReason());
                        conditionInfo.setMessage(condition.getMessage());
                        if (condition.getLastTransitionTime() != null) {
                            conditionInfo.setLastTransitionTime(condition.getLastTransitionTime().toString());
                        }
                        conditions.add(conditionInfo);
                    }
                    detail.setConditions(conditions);
                } else {
                    detail.setConditions(new ArrayList<>());
                }
            } else {
                detail.setStatus("Pending");
                detail.setCapacity("");
                detail.setConditions(new ArrayList<>());
            }

            if (pvc.getMetadata() != null) {
                detail.setLabels(pvc.getMetadata().getLabels());
                detail.setAnnotations(pvc.getMetadata().getAnnotations());
                detail.setUid(pvc.getMetadata().getUid());
                detail.setResourceVersion(pvc.getMetadata().getResourceVersion());
                if (pvc.getMetadata().getCreationTimestamp() != null) {
                    detail.setCreationTimestamp(pvc.getMetadata().getCreationTimestamp().toString());
                }
            }

            // Pods using this PVC
            List<PVCDetailResponse.PodInfo> pods = new ArrayList<>();
            V1PodList podList = api.listNamespacedPod(
                    namespace, null, null, null, null, null, null, null, null, null, null, null);
            if (podList != null && podList.getItems() != null) {
                for (V1Pod pod : podList.getItems()) {
                    if (pod.getSpec() != null && pod.getSpec().getVolumes() != null) {
                        boolean usesPVC = pod.getSpec().getVolumes().stream()
                                .anyMatch(volume -> volume.getPersistentVolumeClaim() != null
                                        && name.equals(volume.getPersistentVolumeClaim().getClaimName()));
                        if (usesPVC) {
                            pods.add(buildPVCDetailPodInfo(pod));
                        }
                    }
                }
            }
            detail.setPods(pods);

            // Events
            List<PVCDetailResponse.EventInfo> events = new ArrayList<>();
            CoreV1EventList eventList = api.listNamespacedEvent(
                    namespace,
                    null,
                    null,
                    null,
                    null,
                    String.format("involvedObject.name=%s,involvedObject.kind=PersistentVolumeClaim", name),
                    null,
                    null,
                    null,
                    null,
                    null,
                    null);
            if (eventList != null && eventList.getItems() != null) {
                for (CoreV1Event event : eventList.getItems()) {
                    events.add(buildPVCDetailEventInfo(event));
                }
            }
            detail.setEvents(events);

            try {
                detail.setYaml(Yaml.dump(pvc));
            } catch (Exception e) {
                detail.setYaml("");
            }

            return detail;
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy chi tiết pvc: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chi tiết pvc: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVCResponse updatePVCFromYaml(String namespace, String name, String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1PersistentVolumeClaim pvcFromYaml = Yaml.loadAs(yaml, V1PersistentVolumeClaim.class);
            if (pvcFromYaml == null) {
                throw new RuntimeException("YAML không hợp lệ");
            }

            if (pvcFromYaml.getMetadata() == null) {
                pvcFromYaml.setMetadata(new V1ObjectMeta());
            }
            if (!name.equals(pvcFromYaml.getMetadata().getName())) {
                throw new RuntimeException("Tên trong YAML không khớp với tên PVC");
            }
            if (!namespace.equals(pvcFromYaml.getMetadata().getNamespace())) {
                throw new RuntimeException("Namespace trong YAML không khớp với namespace PVC");
            }

            V1PersistentVolumeClaim existingPVC = api.readNamespacedPersistentVolumeClaim(name, namespace, null);
            if (existingPVC == null) {
                throw new RuntimeException("PVC không tồn tại");
            }

            if (existingPVC.getMetadata() != null) {
                pvcFromYaml.getMetadata().setResourceVersion(existingPVC.getMetadata().getResourceVersion());
                pvcFromYaml.getMetadata().setUid(existingPVC.getMetadata().getUid());
            }

            V1PersistentVolumeClaim updated = api.replaceNamespacedPersistentVolumeClaim(
                    name, namespace, pvcFromYaml, null, null, null, null);
            return buildPVCResponse(updated);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể cập nhật pvc từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể cập nhật pvc từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVCResponse createPVC(PVCRequest request) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1PersistentVolumeClaim pvc = buildV1PersistentVolumeClaimFromRequest(request);
            V1PersistentVolumeClaim created = api.createNamespacedPersistentVolumeClaim(
                    request.getNamespace(),
                    pvc,
                    null,
                    null,
                    null,
                    null);
            return buildPVCResponse(created);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo PVC: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo PVC: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVCResponse createPVCFromYaml(String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1PersistentVolumeClaim pvcFromYaml = Yaml.loadAs(yaml, V1PersistentVolumeClaim.class);
            if (pvcFromYaml == null || pvcFromYaml.getMetadata() == null
                    || pvcFromYaml.getMetadata().getName() == null
                    || pvcFromYaml.getMetadata().getNamespace() == null) {
                throw new RuntimeException("YAML thiếu name hoặc namespace");
            }

            V1PersistentVolumeClaim created = api.createNamespacedPersistentVolumeClaim(
                    pvcFromYaml.getMetadata().getNamespace(),
                    pvcFromYaml,
                    null,
                    null,
                    null,
                    null);
            return buildPVCResponse(created);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo pvc từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo pvc từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public void deletePVC(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            api.deleteNamespacedPersistentVolumeClaim(name, namespace, null, null, null, null, null, null);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể xóa pvc: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể xóa pvc: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVListResponse getPVs() {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            io.kubernetes.client.openapi.models.V1PersistentVolumeList pvList = api.listPersistentVolume(
                    null, null, null, null, null, null, null, null, null, null, null);

            List<PVResponse> pvs = new ArrayList<>();
            if (pvList.getItems() != null) {
                for (V1PersistentVolume v1PV : pvList.getItems()) {
                    try {
                        pvs.add(buildPVResponse(v1PV));
                    } catch (Exception ignored) {
                    }
                }
            }
            return new PVListResponse(pvs);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy danh sách PVs từ Kubernetes API: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy danh sách PVs: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVResponse getPV(String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            V1PersistentVolume pv = api.readPersistentVolume(name, null);
            if (pv == null) {
                throw new RuntimeException("PV không tồn tại");
            }
            return buildPVResponse(pv);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy pv: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy pv: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVDetailResponse getPVDetail(String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1PersistentVolume pv = api.readPersistentVolume(name, null);
            if (pv == null) {
                throw new RuntimeException("PV không tồn tại");
            }

            PVDetailResponse detail = new PVDetailResponse();
            detail.setId(name);
            detail.setName(name);
            if (pv.getMetadata() != null) {
                detail.setAge(calculateAge(pv.getMetadata().getCreationTimestamp()));
                detail.setLabels(pv.getMetadata().getLabels());
                detail.setAnnotations(pv.getMetadata().getAnnotations());
                detail.setUid(pv.getMetadata().getUid());
                detail.setResourceVersion(pv.getMetadata().getResourceVersion());
                if (pv.getMetadata().getCreationTimestamp() != null) {
                    detail.setCreationTimestamp(pv.getMetadata().getCreationTimestamp().toString());
                }
            }

            V1PersistentVolumeSpec spec = pv.getSpec();
            if (spec != null) {
                if (spec.getCapacity() != null && spec.getCapacity().containsKey("storage")) {
                    detail.setCapacity(parseQuantityToGB(spec.getCapacity().get("storage")));
                }
                if (spec.getAccessModes() != null) {
                    detail.setAccessModes(new ArrayList<>(spec.getAccessModes()));
                }
                detail.setReclaimPolicy(spec.getPersistentVolumeReclaimPolicy());
                detail.setStorageClass(spec.getStorageClassName());
                detail.setVolumeMode(spec.getVolumeMode());
                detail.setMountOptions(spec.getMountOptions());
                if (spec.getClaimRef() != null) {
                    PVResponse.ClaimInfo claimInfo = new PVResponse.ClaimInfo();
                    claimInfo.setNamespace(spec.getClaimRef().getNamespace());
                    claimInfo.setName(spec.getClaimRef().getName());
                    detail.setClaim(claimInfo);
                }
                detail.setSource(buildPVSourceInfo(spec));
            }

            V1PersistentVolumeStatus status = pv.getStatus();
            List<PVDetailResponse.ConditionInfo> conditions = new ArrayList<>();
            if (status != null) {
                detail.setStatus(status.getPhase());
                PVDetailResponse.ConditionInfo conditionInfo = new PVDetailResponse.ConditionInfo();
                conditionInfo.setType(status.getPhase());
                conditionInfo.setStatus(status.getPhase());
                conditionInfo.setMessage(status.getMessage() != null ? status.getMessage() : status.getReason());
                conditions.add(conditionInfo);
            } else {
                detail.setStatus("Available");
            }
            detail.setConditions(conditions);

            // Pods using this PV (via bound PVC)
            List<PVDetailResponse.PodInfo> pods = new ArrayList<>();
            if (spec != null && spec.getClaimRef() != null
                    && spec.getClaimRef().getNamespace() != null
                    && spec.getClaimRef().getName() != null) {
                String pvcNamespace = spec.getClaimRef().getNamespace();
                String pvcName = spec.getClaimRef().getName();
                V1PodList podList = api.listNamespacedPod(
                        pvcNamespace, null, null, null, null, null, null, null, null, null, null, null);
                if (podList != null && podList.getItems() != null) {
                    for (V1Pod pod : podList.getItems()) {
                        if (pod.getSpec() != null && pod.getSpec().getVolumes() != null) {
                            for (V1Volume volume : pod.getSpec().getVolumes()) {
                                if (volume.getPersistentVolumeClaim() != null
                                        && pvcName.equals(volume.getPersistentVolumeClaim().getClaimName())) {
                                    pods.add(buildPVDetailPodInfo(pod));
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            detail.setPods(pods);

            // Events
            List<PVDetailResponse.EventInfo> events = new ArrayList<>();
            CoreV1EventList eventList = api.listEventForAllNamespaces(
                    null,
                    null,
                    String.format("involvedObject.name=%s,involvedObject.kind=PersistentVolume", name),
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null);
            if (eventList != null && eventList.getItems() != null) {
                for (CoreV1Event event : eventList.getItems()) {
                    events.add(buildPVDetailEventInfo(event));
                }
            }
            detail.setEvents(events);

            try {
                detail.setYaml(Yaml.dump(pv));
            } catch (Exception e) {
                detail.setYaml("");
            }

            return detail;
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy chi tiết PV: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chi tiết PV: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVResponse createPV(PVRequest request) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1PersistentVolume pv = buildV1PersistentVolumeFromRequest(request);
            V1PersistentVolume created = api.createPersistentVolume(pv, null, null, null, null);
            return buildPVResponse(created);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo PV: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo PV: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVResponse createPVFromYaml(String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1PersistentVolume pvFromYaml = Yaml.loadAs(yaml, V1PersistentVolume.class);
            if (pvFromYaml == null || pvFromYaml.getMetadata() == null || pvFromYaml.getMetadata().getName() == null) {
                throw new RuntimeException("YAML thiếu tên PV");
            }

            V1PersistentVolume created = api.createPersistentVolume(pvFromYaml, null, null, null, null);
            return buildPVResponse(created);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo PV từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo PV từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public PVResponse updatePVFromYaml(String name, String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1PersistentVolume pvFromYaml = Yaml.loadAs(yaml, V1PersistentVolume.class);
            if (pvFromYaml == null) {
                throw new RuntimeException("YAML không hợp lệ");
            }

            if (pvFromYaml.getMetadata() == null) {
                pvFromYaml.setMetadata(new V1ObjectMeta());
            }
            if (!name.equals(pvFromYaml.getMetadata().getName())) {
                throw new RuntimeException("Tên trong YAML không khớp với tên PV");
            }

            V1PersistentVolume existing = api.readPersistentVolume(name, null);
            if (existing == null) {
                throw new RuntimeException("PV không tồn tại");
            }
            if (existing.getMetadata() != null) {
                pvFromYaml.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
                pvFromYaml.getMetadata().setUid(existing.getMetadata().getUid());
            }

            V1PersistentVolume updated = api.replacePersistentVolume(name, pvFromYaml, null, null, null, null);
            return buildPVResponse(updated);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể cập nhật PV từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể cập nhật PV từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public void deletePV(String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            api.deletePersistentVolume(name, null, null, null, null, null, null);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể xóa PV: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể xóa PV: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    private PVCResponse buildPVCResponse(V1PersistentVolumeClaim v1PVC) {
        PVCResponse pvc = new PVCResponse();
        String namespace = v1PVC.getMetadata().getNamespace();
        String name = v1PVC.getMetadata().getName();
        pvc.setId(name + "-" + namespace);
        pvc.setName(name);
        pvc.setNamespace(namespace);
        pvc.setAge(calculateAge(v1PVC.getMetadata().getCreationTimestamp()));

        V1PersistentVolumeClaimSpec spec = v1PVC.getSpec();
        if (spec != null) {
            List<String> accessModes = new ArrayList<>();
            if (spec.getAccessModes() != null) {
                accessModes.addAll(spec.getAccessModes());
            }
            pvc.setAccessModes(accessModes);
            pvc.setStorageClass(spec.getStorageClassName() != null ? spec.getStorageClassName() : "");
            pvc.setVolumeMode(spec.getVolumeMode());
            pvc.setVolume(spec.getVolumeName() != null ? spec.getVolumeName() : null);
        }

        V1PersistentVolumeClaimStatus status = v1PVC.getStatus();
        if (status != null) {
            // Return PVC status phase directly from Kubernetes (Bound, Pending, Lost)
            if (status.getPhase() != null) {
                pvc.setStatus(status.getPhase()); // Keep original case: Bound, Pending, Lost
            } else {
                pvc.setStatus("Pending");
            }
            if (status.getCapacity() != null && status.getCapacity().containsKey("storage")) {
                pvc.setCapacity(parseQuantityToGB(status.getCapacity().get("storage")));
            } else if (spec != null && spec.getResources() != null
                    && spec.getResources().getRequests() != null
                    && spec.getResources().getRequests().containsKey("storage")) {
                pvc.setCapacity(parseQuantityToGB(spec.getResources().getRequests().get("storage")));
            } else {
                pvc.setCapacity("");
            }
        } else {
            pvc.setStatus("Pending");
            pvc.setCapacity("");
        }
        return pvc;
    }

    private PVResponse buildPVResponse(V1PersistentVolume v1PV) {
        PVResponse pv = new PVResponse();
        String name = v1PV.getMetadata().getName();
        pv.setId(name);
        pv.setName(name);
        pv.setAge(calculateAge(v1PV.getMetadata().getCreationTimestamp()));

        V1PersistentVolumeSpec spec = v1PV.getSpec();
        if (spec != null) {
            if (spec.getCapacity() != null && spec.getCapacity().containsKey("storage")) {
                pv.setCapacity(parseQuantityToGB(spec.getCapacity().get("storage")));
            } else {
                pv.setCapacity("");
            }

            List<String> accessModes = new ArrayList<>();
            if (spec.getAccessModes() != null) {
                accessModes.addAll(spec.getAccessModes());
            }
            pv.setAccessModes(accessModes);
            pv.setReclaimPolicy(spec.getPersistentVolumeReclaimPolicy() != null
                    ? spec.getPersistentVolumeReclaimPolicy()
                    : "Retain");
            pv.setStorageClass(spec.getStorageClassName() != null ? spec.getStorageClassName() : "");

            if (spec.getClaimRef() != null) {
                V1ObjectReference claimRef = spec.getClaimRef();
                PVResponse.ClaimInfo claim = new PVResponse.ClaimInfo();
                claim.setNamespace(claimRef.getNamespace());
                claim.setName(claimRef.getName());
                pv.setClaim(claim);
            } else {
                pv.setClaim(null);
            }
            pv.setVolumeMode(spec.getVolumeMode());
        }

        V1PersistentVolumeStatus status = v1PV.getStatus();
        if (status != null) {
            pv.setStatus(status.getPhase() != null ? status.getPhase().toLowerCase() : "available");
            pv.setReason(status.getReason());
        } else {
            pv.setStatus("available");
            pv.setReason(null);
        }
        return pv;
    }

    private V1PersistentVolumeClaim buildV1PersistentVolumeClaimFromRequest(PVCRequest request) {
        V1PersistentVolumeClaim pvc = new V1PersistentVolumeClaim();
        pvc.setApiVersion("v1");
        pvc.setKind("PersistentVolumeClaim");

        V1ObjectMeta metadata = new V1ObjectMeta();
        metadata.setName(request.getName());
        metadata.setNamespace(request.getNamespace());
        if (request.getLabels() != null && !request.getLabels().isEmpty()) {
            metadata.setLabels(new HashMap<>(request.getLabels()));
        }
        pvc.setMetadata(metadata);

        V1PersistentVolumeClaimSpec spec = new V1PersistentVolumeClaimSpec();
        
        // Access Modes
        if (request.getAccessModes() != null && !request.getAccessModes().isEmpty()) {
            spec.setAccessModes(new ArrayList<>(request.getAccessModes()));
        } else {
            // Default to ReadWriteOnce if not specified
            spec.setAccessModes(List.of("ReadWriteOnce"));
        }

        // Storage Class
        if (request.getStorageClass() != null && !request.getStorageClass().trim().isEmpty()) {
            spec.setStorageClassName(request.getStorageClass());
        }

        // Volume Mode
        if (request.getVolumeMode() != null && !request.getVolumeMode().trim().isEmpty()) {
            spec.setVolumeMode(request.getVolumeMode());
        }

        // Volume Attributes Class - Note: This field may not be available in all Kubernetes versions
        // if (request.getVolumeAttributesClass() != null && !request.getVolumeAttributesClass().trim().isEmpty()) {
        //     spec.setVolumeAttributesClassName(request.getVolumeAttributesClass());
        // }

        // Resources (Capacity)
        V1ResourceRequirements resources = new V1ResourceRequirements();
        Map<String, Quantity> requests = new HashMap<>();
        requests.put("storage", new Quantity(request.getCapacity()));
        resources.setRequests(requests);
        spec.setResources(resources);

        pvc.setSpec(spec);
        return pvc;
    }

    private V1PersistentVolume buildV1PersistentVolumeFromRequest(PVRequest request) {
        V1PersistentVolume pv = new V1PersistentVolume();
        pv.setApiVersion("v1");
        pv.setKind("PersistentVolume");

        V1ObjectMeta metadata = new V1ObjectMeta();
        metadata.setName(request.getName());
        if (request.getLabels() != null && !request.getLabels().isEmpty()) {
            metadata.setLabels(new HashMap<>(request.getLabels()));
        }
        pv.setMetadata(metadata);

        V1PersistentVolumeSpec spec = new V1PersistentVolumeSpec();

        // Capacity
        Map<String, Quantity> capacity = new HashMap<>();
        capacity.put("storage", new Quantity(request.getCapacity()));
        spec.setCapacity(capacity);

        // Access Modes
        if (request.getAccessModes() != null && !request.getAccessModes().isEmpty()) {
            spec.setAccessModes(new ArrayList<>(request.getAccessModes()));
        } else {
            // Default to ReadWriteOnce if not specified
            spec.setAccessModes(List.of("ReadWriteOnce"));
        }

        // Reclaim Policy
        if (request.getReclaimPolicy() != null && !request.getReclaimPolicy().trim().isEmpty()) {
            spec.setPersistentVolumeReclaimPolicy(request.getReclaimPolicy());
        } else {
            spec.setPersistentVolumeReclaimPolicy("Retain");
        }

        // Storage Class
        if (request.getStorageClass() != null && !request.getStorageClass().trim().isEmpty()) {
            spec.setStorageClassName(request.getStorageClass());
        }

        // Volume Mode
        if (request.getVolumeMode() != null && !request.getVolumeMode().trim().isEmpty()) {
            spec.setVolumeMode(request.getVolumeMode());
        }

        // Volume Attributes Class - Note: This field may not be available in all Kubernetes versions
        // if (request.getVolumeAttributesClass() != null && !request.getVolumeAttributesClass().trim().isEmpty()) {
        //     spec.setVolumeAttributesClassName(request.getVolumeAttributesClass());
        // }

        // Source (NFS, HostPath, Local, etc.)
        if (request.getSource() != null && request.getSource().getType() != null) {
            String sourceType = request.getSource().getType();
            if ("NFS".equalsIgnoreCase(sourceType)) {
                V1NFSVolumeSource nfs = new V1NFSVolumeSource();
                if (request.getSource().getNfsServer() != null) {
                    nfs.setServer(request.getSource().getNfsServer());
                }
                if (request.getSource().getNfsPath() != null) {
                    nfs.setPath(request.getSource().getNfsPath());
                }
                if (request.getSource().getOptions() != null && request.getSource().getOptions().containsKey("readOnly")) {
                    nfs.setReadOnly("true".equalsIgnoreCase(request.getSource().getOptions().get("readOnly")));
                }
                spec.setNfs(nfs);
            } else if ("HostPath".equalsIgnoreCase(sourceType)) {
                V1HostPathVolumeSource hostPath = new V1HostPathVolumeSource();
                if (request.getSource().getHostPath() != null) {
                    hostPath.setPath(request.getSource().getHostPath());
                }
                if (request.getSource().getOptions() != null && request.getSource().getOptions().containsKey("type")) {
                    hostPath.setType(request.getSource().getOptions().get("type"));
                }
                spec.setHostPath(hostPath);
            } else if ("Local".equalsIgnoreCase(sourceType)) {
                V1LocalVolumeSource local = new V1LocalVolumeSource();
                if (request.getSource().getLocalPath() != null) {
                    local.setPath(request.getSource().getLocalPath());
                }
                spec.setLocal(local);
            }
        }

        pv.setSpec(spec);
        return pv;
    }

    private PVCDetailResponse.PodInfo buildPVCDetailPodInfo(V1Pod pod) {
        PVCDetailResponse.PodInfo info = new PVCDetailResponse.PodInfo();
        if (pod.getMetadata() != null) {
            info.setName(pod.getMetadata().getName());
            info.setNamespace(pod.getMetadata().getNamespace());
            info.setAge(calculateAge(pod.getMetadata().getCreationTimestamp()));
        }
        if (pod.getStatus() != null) {
            info.setStatus(pod.getStatus().getPhase());
            if (pod.getSpec() != null) {
                info.setNode(pod.getSpec().getNodeName());
            }
        }
        return info;
    }

    private PVCDetailResponse.EventInfo buildPVCDetailEventInfo(CoreV1Event event) {
        PVCDetailResponse.EventInfo info = new PVCDetailResponse.EventInfo();
        info.setType(event.getType());
        info.setReason(event.getReason());
        info.setMessage(event.getMessage());
        info.setCount(event.getCount());
        if (event.getFirstTimestamp() != null) {
            info.setFirstTimestamp(event.getFirstTimestamp().toString());
        }
        if (event.getLastTimestamp() != null) {
            info.setLastTimestamp(event.getLastTimestamp().toString());
        }
        return info;
    }

    private PVDetailResponse.PodInfo buildPVDetailPodInfo(V1Pod pod) {
        PVDetailResponse.PodInfo info = new PVDetailResponse.PodInfo();
        if (pod.getMetadata() != null) {
            info.setName(pod.getMetadata().getName());
            info.setNamespace(pod.getMetadata().getNamespace());
            info.setAge(calculateAge(pod.getMetadata().getCreationTimestamp()));
        }
        if (pod.getStatus() != null) {
            info.setStatus(pod.getStatus().getPhase());
        }
        if (pod.getSpec() != null) {
            info.setNode(pod.getSpec().getNodeName());
        }
        return info;
    }

    private PVDetailResponse.EventInfo buildPVDetailEventInfo(CoreV1Event event) {
        PVDetailResponse.EventInfo info = new PVDetailResponse.EventInfo();
        info.setType(event.getType());
        info.setReason(event.getReason());
        info.setMessage(event.getMessage());
        info.setCount(event.getCount());
        if (event.getFirstTimestamp() != null) {
            info.setFirstTimestamp(event.getFirstTimestamp().toString());
        }
        if (event.getLastTimestamp() != null) {
            info.setLastTimestamp(event.getLastTimestamp().toString());
        }
        return info;
    }

    private PVDetailResponse.SourceInfo buildPVSourceInfo(V1PersistentVolumeSpec spec) {
        if (spec == null) {
            return null;
        }
        PVDetailResponse.SourceInfo info = new PVDetailResponse.SourceInfo();
        Map<String, Object> details = new HashMap<>();
        if (spec.getNfs() != null) {
            info.setType("NFS");
            details.put("server", spec.getNfs().getServer());
            details.put("path", spec.getNfs().getPath());
            details.put("readOnly", spec.getNfs().getReadOnly());
        } else if (spec.getHostPath() != null) {
            info.setType("HostPath");
            details.put("path", spec.getHostPath().getPath());
            details.put("type", spec.getHostPath().getType());
        } else if (spec.getLocal() != null) {
            info.setType("Local");
            details.put("path", spec.getLocal().getPath());
            details.put("fsType", spec.getLocal().getFsType());
        } else if (spec.getAwsElasticBlockStore() != null) {
            info.setType("AwsElasticBlockStore");
            details.put("volumeID", spec.getAwsElasticBlockStore().getVolumeID());
            details.put("fsType", spec.getAwsElasticBlockStore().getFsType());
            details.put("partition", spec.getAwsElasticBlockStore().getPartition());
            details.put("readOnly", spec.getAwsElasticBlockStore().getReadOnly());
        } else if (spec.getGcePersistentDisk() != null) {
            info.setType("GcePersistentDisk");
            details.put("pdName", spec.getGcePersistentDisk().getPdName());
            details.put("fsType", spec.getGcePersistentDisk().getFsType());
            details.put("partition", spec.getGcePersistentDisk().getPartition());
            details.put("readOnly", spec.getGcePersistentDisk().getReadOnly());
        } else if (spec.getCephfs() != null) {
            info.setType("CephFS");
            details.put("monitors", spec.getCephfs().getMonitors());
            details.put("path", spec.getCephfs().getPath());
            details.put("readOnly", spec.getCephfs().getReadOnly());
        } else if (spec.getIscsi() != null) {
            info.setType("iSCSI");
            details.put("targetPortal", spec.getIscsi().getTargetPortal());
            details.put("iqn", spec.getIscsi().getIqn());
            details.put("lun", spec.getIscsi().getLun());
            details.put("fsType", spec.getIscsi().getFsType());
        } else if (spec.getCsi() != null) {
            info.setType("CSI");
            details.put("driver", spec.getCsi().getDriver());
            details.put("volumeHandle", spec.getCsi().getVolumeHandle());
            details.put("fsType", spec.getCsi().getFsType());
            details.put("volumeAttributes", spec.getCsi().getVolumeAttributes());
        } else if (spec.getPhotonPersistentDisk() != null) {
            info.setType("PhotonPersistentDisk");
            details.put("pdID", spec.getPhotonPersistentDisk().getPdID());
            details.put("fsType", spec.getPhotonPersistentDisk().getFsType());
        } else if (spec.getAzureFile() != null) {
            info.setType("AzureFile");
            details.put("shareName", spec.getAzureFile().getShareName());
            details.put("secretName", spec.getAzureFile().getSecretName());
            details.put("readOnly", spec.getAzureFile().getReadOnly());
        } else if (spec.getAzureDisk() != null) {
            info.setType("AzureDisk");
            details.put("diskName", spec.getAzureDisk().getDiskName());
            details.put("diskURI", spec.getAzureDisk().getDiskURI());
            details.put("cachingMode", spec.getAzureDisk().getCachingMode());
        } else {
            info.setType("Unknown");
            details.put("spec", spec.toString());
        }
        info.setDetails(details);
        return info;
    }
}

