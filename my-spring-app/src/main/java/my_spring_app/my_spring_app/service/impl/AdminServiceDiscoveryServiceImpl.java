package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.Session;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.apis.NetworkingV1Api;
import io.kubernetes.client.openapi.models.V1Ingress;
import io.kubernetes.client.openapi.models.V1IngressBackend;
import io.kubernetes.client.openapi.models.V1IngressLoadBalancerIngress;
import io.kubernetes.client.openapi.models.V1IngressRule;
import io.kubernetes.client.openapi.models.V1IngressServiceBackend;
import io.kubernetes.client.openapi.models.V1IngressSpec;
import io.kubernetes.client.openapi.models.V1IngressStatus;
import io.kubernetes.client.openapi.models.V1IngressTLS;
import io.kubernetes.client.openapi.models.CoreV1EndpointPort;
import io.kubernetes.client.openapi.models.V1HTTPIngressPath;
import io.kubernetes.client.openapi.models.V1HTTPIngressRuleValue;
import io.kubernetes.client.openapi.models.V1Endpoints;
import io.kubernetes.client.openapi.models.V1EndpointAddress;
import io.kubernetes.client.openapi.models.V1EndpointSubset;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1Service;
import io.kubernetes.client.openapi.models.V1ServicePort;
import io.kubernetes.client.openapi.models.V1ServiceSpec;
import io.kubernetes.client.openapi.models.V1ServiceStatus;
import io.kubernetes.client.util.Yaml;
import io.kubernetes.client.util.Config;
import io.kubernetes.client.openapi.Configuration;
import my_spring_app.my_spring_app.dto.reponse.IngressDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.IngressListResponse;
import my_spring_app.my_spring_app.dto.reponse.IngressResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceListResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceDetailResponse;
import my_spring_app.my_spring_app.dto.request.IngressRequest;
import my_spring_app.my_spring_app.dto.request.ServiceRequest;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.service.AdminServiceDiscoveryService;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class AdminServiceDiscoveryServiceImpl extends BaseKubernetesService implements AdminServiceDiscoveryService {

    private final ServerRepository serverRepository;

    public AdminServiceDiscoveryServiceImpl(ServerRepository serverRepository) {
        this.serverRepository = serverRepository;
    }

    private ServerEntity getMasterServer() {
        return serverRepository.findByRole("MASTER").orElseThrow(() -> new RuntimeException(
                "Không tìm thấy server MASTER. Vui lòng cấu hình server MASTER trong hệ thống."));
    }

    @Override
    public ServiceListResponse getServices() {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            io.kubernetes.client.openapi.models.V1ServiceList serviceList = api.listServiceForAllNamespaces(
                    null, null, null, null, null, null, null, null, null, null, null);

            List<ServiceResponse> services = new ArrayList<>();
            if (serviceList.getItems() != null) {
                for (V1Service v1Service : serviceList.getItems()) {
                    try {
                        services.add(buildServiceResponse(v1Service));
                    } catch (Exception ignored) {
                    }
                }
            }
            return new ServiceListResponse(services);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy danh sách services từ Kubernetes API: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy danh sách services: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public ServiceResponse getService(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            V1Service v1Service = api.readNamespacedService(name, namespace, null);
            if (v1Service == null) {
                throw new RuntimeException("Service không tồn tại");
            }
            return buildServiceResponse(v1Service);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy service: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy service: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public ServiceDetailResponse getServiceDetail(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1Service v1Service = api.readNamespacedService(name, namespace, null);
            if (v1Service == null) {
                throw new RuntimeException("Service không tồn tại");
            }

            ServiceDetailResponse detail = new ServiceDetailResponse();
            String id = name + "-" + namespace;
            detail.setId(id);
            detail.setName(name);
            detail.setNamespace(namespace);
            detail.setAge(calculateAge(v1Service.getMetadata().getCreationTimestamp()));

            V1ServiceSpec spec = v1Service.getSpec();
            if (spec != null) {
                detail.setType(spec.getType() != null ? spec.getType() : "ClusterIP");
                if (spec.getClusterIP() != null && !"None".equals(spec.getClusterIP())) {
                    detail.setClusterIP(spec.getClusterIP());
                } else {
                    detail.setClusterIP("-");
                }

                List<ServiceResponse.PortInfo> ports = new ArrayList<>();
                if (spec.getPorts() != null) {
                    for (V1ServicePort servicePort : spec.getPorts()) {
                        ServiceResponse.PortInfo portInfo = new ServiceResponse.PortInfo();
                        if (servicePort.getPort() != null) {
                            portInfo.setPort(servicePort.getPort());
                        }
                        if (servicePort.getTargetPort() != null) {
                            if (servicePort.getTargetPort().isInteger()) {
                                portInfo.setTargetPort(servicePort.getTargetPort().getIntValue());
                            } else if (servicePort.getTargetPort().getStrValue() != null) {
                                try {
                                    portInfo.setTargetPort(
                                            Integer.parseInt(servicePort.getTargetPort().getStrValue()));
                                } catch (NumberFormatException e) {
                                    portInfo.setTargetPort(servicePort.getPort());
                                }
                            }
                        } else {
                            portInfo.setTargetPort(servicePort.getPort());
                        }
                        portInfo.setProtocol(servicePort.getProtocol() != null ? servicePort.getProtocol() : "TCP");
                        ports.add(portInfo);
                    }
                }
                detail.setPorts(ports);

                if (spec.getSelector() != null && !spec.getSelector().isEmpty()) {
                    Map<String, String> selector = new HashMap<>(spec.getSelector());
                    detail.setSelector(selector);
                } else {
                    detail.setSelector(new HashMap<>());
                }
            }

            String externalIP = "-";
            V1ServiceStatus status = v1Service.getStatus();
            if (status != null && status.getLoadBalancer() != null
                    && status.getLoadBalancer().getIngress() != null
                    && !status.getLoadBalancer().getIngress().isEmpty()) {
                List<String> externalIPs = new ArrayList<>();
                for (io.kubernetes.client.openapi.models.V1LoadBalancerIngress ingress : status.getLoadBalancer()
                        .getIngress()) {
                    if (ingress.getIp() != null) {
                        externalIPs.add(ingress.getIp());
                    } else if (ingress.getHostname() != null) {
                        externalIPs.add(ingress.getHostname());
                    }
                }
                if (!externalIPs.isEmpty()) {
                    externalIP = String.join(",", externalIPs);
                }
            } else if (spec != null && spec.getExternalIPs() != null && !spec.getExternalIPs().isEmpty()) {
                externalIP = String.join(",", spec.getExternalIPs());
            }
            detail.setExternalIP(externalIP);

            // Metadata
            if (v1Service.getMetadata() != null) {
                detail.setLabels(v1Service.getMetadata().getLabels());
                detail.setAnnotations(v1Service.getMetadata().getAnnotations());
                detail.setUid(v1Service.getMetadata().getUid());
                detail.setResourceVersion(v1Service.getMetadata().getResourceVersion());
                if (v1Service.getMetadata().getCreationTimestamp() != null) {
                    detail.setCreationTimestamp(v1Service.getMetadata().getCreationTimestamp().toString());
                }
            }

            // Endpoints
            List<ServiceDetailResponse.EndpointInfo> endpoints = new ArrayList<>();
            try {
                V1Endpoints v1Endpoints = api.readNamespacedEndpoints(name, namespace, null);
                if (v1Endpoints != null && v1Endpoints.getSubsets() != null) {
                    for (V1EndpointSubset subset : v1Endpoints.getSubsets()) {
                        List<String> portNumbers = new ArrayList<>();
                        if (subset.getPorts() != null) {
                            for (CoreV1EndpointPort port : subset.getPorts()) {
                                if (port.getPort() != null) {
                                    portNumbers.add(port.getPort().toString());
                                }
                            }
                        }
                        if (subset.getAddresses() != null) {
                            for (V1EndpointAddress address : subset.getAddresses()) {
                                ServiceDetailResponse.EndpointInfo endpointInfo = new ServiceDetailResponse.EndpointInfo();
                                endpointInfo.setIp(address.getIp());
                                List<Integer> ports = new ArrayList<>();
                                for (String portStr : portNumbers) {
                                    try {
                                        ports.add(Integer.parseInt(portStr));
                                    } catch (NumberFormatException e) {
                                        // Bỏ qua
                                    }
                                }
                                endpointInfo.setPorts(ports);
                                if (address.getTargetRef() != null) {
                                    endpointInfo.setTargetRefKind(address.getTargetRef().getKind());
                                    endpointInfo.setTargetRefName(address.getTargetRef().getName());
                                    endpointInfo.setTargetRefNamespace(address.getTargetRef().getNamespace());
                                }
                                endpoints.add(endpointInfo);
                            }
                        }
                    }
                }
            } catch (ApiException e) {
                // Bỏ qua lỗi khi lấy endpoints
            }
            detail.setEndpoints(endpoints);

            // Events - Sử dụng kubectl để lấy events
            List<ServiceDetailResponse.EventInfo> events = new ArrayList<>();
            try {
                String cmd = String.format("kubectl get events -n %s --field-selector involvedObject.name=%s,involvedObject.kind=Service --sort-by='.lastTimestamp' -o json", namespace, name);
                String output = executeCommand(session, cmd, true);
                // Tạm thời bỏ qua parsing JSON, có thể implement sau nếu cần
            } catch (Exception e) {
                // Bỏ qua lỗi
            }
            detail.setEvents(events);

            // Status
            ServiceDetailResponse.StatusInfo statusInfo = new ServiceDetailResponse.StatusInfo();
            statusInfo.setEndpointCount(endpoints.size());
            if (status != null && status.getLoadBalancer() != null
                    && status.getLoadBalancer().getIngress() != null
                    && !status.getLoadBalancer().getIngress().isEmpty()) {
                statusInfo.setLoadBalancerStatus("Active");
            } else {
                statusInfo.setLoadBalancerStatus("-");
            }
            detail.setStatus(statusInfo);

            // YAML
            try {
                detail.setYaml(Yaml.dump(v1Service));
            } catch (Exception e) {
                detail.setYaml("");
            }

            return detail;
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy chi tiết service: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chi tiết service: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }


    @Override
    public ServiceResponse updateServiceFromYaml(String namespace, String name, String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1Service serviceFromYaml = Yaml.loadAs(yaml, V1Service.class);
            if (serviceFromYaml == null) {
                throw new RuntimeException("YAML không hợp lệ");
            }

            if (serviceFromYaml.getMetadata() == null) {
                serviceFromYaml.setMetadata(new V1ObjectMeta());
            }
            if (!name.equals(serviceFromYaml.getMetadata().getName())) {
                throw new RuntimeException("Tên trong YAML không khớp với tên service");
            }
            if (!namespace.equals(serviceFromYaml.getMetadata().getNamespace())) {
                throw new RuntimeException("Namespace trong YAML không khớp với namespace service");
            }

            V1Service existing = api.readNamespacedService(name, namespace, null);
            if (existing == null) {
                throw new RuntimeException("Service không tồn tại");
            }
            if (existing.getMetadata() != null) {
                serviceFromYaml.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
                serviceFromYaml.getMetadata().setUid(existing.getMetadata().getUid());
            }

            V1Service updated = api.replaceNamespacedService(name, namespace, serviceFromYaml, null, null, null, null);
            return buildServiceResponse(updated);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể cập nhật service từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể cập nhật service từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public ServiceResponse createService(ServiceRequest request) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1Service service = buildV1ServiceFromRequest(request);
            V1Service created = api.createNamespacedService(
                    request.getNamespace(),
                    service,
                    null,
                    null,
                    null,
                    null);
            return buildServiceResponse(created);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo service: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo service: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public ServiceResponse createServiceFromYaml(String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);

            V1Service serviceFromYaml = Yaml.loadAs(yaml, V1Service.class);
            if (serviceFromYaml == null || serviceFromYaml.getMetadata() == null
                    || serviceFromYaml.getMetadata().getName() == null
                    || serviceFromYaml.getMetadata().getNamespace() == null) {
                throw new RuntimeException("YAML thiếu name hoặc namespace");
            }

            V1Service created = api.createNamespacedService(
                    serviceFromYaml.getMetadata().getNamespace(),
                    serviceFromYaml,
                    null,
                    null,
                    null,
                    null);
            return buildServiceResponse(created);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo service từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo service từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public void deleteService(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            CoreV1Api api = new CoreV1Api(client);
            api.deleteNamespacedService(name, namespace, null, null, null, null, null, null);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể xóa service: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể xóa service: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public IngressListResponse getIngress() {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            NetworkingV1Api api = new NetworkingV1Api(client);

            io.kubernetes.client.openapi.models.V1IngressList ingressListResponse = api.listIngressForAllNamespaces(
                    null, null, null, null, null, null, null, null, null, null, null);

            List<IngressResponse> ingressList = new ArrayList<>();
            if (ingressListResponse.getItems() != null) {
                for (V1Ingress v1Ingress : ingressListResponse.getItems()) {
                    try {
                        ingressList.add(buildIngressResponse(v1Ingress));
                    } catch (Exception ignored) {
                    }
                }
            }
            return new IngressListResponse(ingressList);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy danh sách ingress từ Kubernetes API: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy danh sách ingress: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public IngressResponse getIngress(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            NetworkingV1Api api = new NetworkingV1Api(client);
            V1Ingress v1Ingress = api.readNamespacedIngress(name, namespace, null);
            if (v1Ingress == null) {
                throw new RuntimeException("Ingress không tồn tại");
            }
            return buildIngressResponse(v1Ingress);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy ingress: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy ingress: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public IngressDetailResponse getIngressDetail(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            NetworkingV1Api api = new NetworkingV1Api(client);

            V1Ingress v1Ingress = api.readNamespacedIngress(name, namespace, null);
            if (v1Ingress == null) {
                throw new RuntimeException("Ingress không tồn tại");
            }

            IngressDetailResponse detail = new IngressDetailResponse();
            detail.setId(name + "-" + namespace);
            detail.setName(name);
            detail.setNamespace(namespace);
            if (v1Ingress.getMetadata() != null) {
                detail.setAge(calculateAge(v1Ingress.getMetadata().getCreationTimestamp()));
                detail.setLabels(v1Ingress.getMetadata().getLabels());
                detail.setAnnotations(v1Ingress.getMetadata().getAnnotations());
                detail.setUid(v1Ingress.getMetadata().getUid());
                detail.setResourceVersion(v1Ingress.getMetadata().getResourceVersion());
                if (v1Ingress.getMetadata().getCreationTimestamp() != null) {
                    detail.setCreationTimestamp(v1Ingress.getMetadata().getCreationTimestamp().toString());
                }
            }

            V1IngressSpec spec = v1Ingress.getSpec();
            List<String> hosts = new ArrayList<>();
            List<Integer> ports = new ArrayList<>();
            List<IngressDetailResponse.RuleInfo> rules = new ArrayList<>();
            List<IngressDetailResponse.TlsInfo> tlsInfos = new ArrayList<>();

            if (spec != null) {
                detail.setIngressClass(spec.getIngressClassName());
                if (spec.getRules() != null) {
                    for (V1IngressRule rule : spec.getRules()) {
                        if (rule.getHost() != null && !rule.getHost().isEmpty()) {
                            hosts.add(rule.getHost());
                        }
                        if (rule.getHttp() != null && rule.getHttp().getPaths() != null) {
                            for (V1HTTPIngressPath path : rule.getHttp().getPaths()) {
                                IngressDetailResponse.RuleInfo ruleInfo = new IngressDetailResponse.RuleInfo();
                                ruleInfo.setHost(rule.getHost());
                                ruleInfo.setPath(path.getPath());
                                ruleInfo.setPathType(path.getPathType());
                                V1IngressBackend backend = path.getBackend();
                                if (backend != null && backend.getService() != null) {
                                    V1IngressServiceBackend svcBackend = backend.getService();
                                    ruleInfo.setServiceName(svcBackend.getName());
                                    if (svcBackend.getPort() != null) {
                                        if (svcBackend.getPort().getNumber() != null) {
                                            ruleInfo.setServicePort(String.valueOf(svcBackend.getPort().getNumber()));
                                            ports.add(svcBackend.getPort().getNumber());
                                        } else if (svcBackend.getPort().getName() != null) {
                                            ruleInfo.setServicePort(svcBackend.getPort().getName());
                                        }
                                    }
                                }
                                rules.add(ruleInfo);
                            }
                        }
                    }
                }
                if (spec.getTls() != null) {
                    for (V1IngressTLS tls : spec.getTls()) {
                        IngressDetailResponse.TlsInfo tlsInfo = new IngressDetailResponse.TlsInfo();
                        tlsInfo.setSecretName(tls.getSecretName());
                        tlsInfo.setHosts(tls.getHosts());
                        tlsInfos.add(tlsInfo);
                    }
                }
            }
            detail.setHosts(hosts);
            if (ports.isEmpty()) {
                ports.add(80);
                ports.add(443);
            }
            detail.setPorts(ports);
            detail.setRules(rules);
            detail.setTls(tlsInfos);

            V1IngressStatus status = v1Ingress.getStatus();
            if (status != null && status.getLoadBalancer() != null
                    && status.getLoadBalancer().getIngress() != null
                    && !status.getLoadBalancer().getIngress().isEmpty()) {
                List<String> addresses = new ArrayList<>();
                for (V1IngressLoadBalancerIngress ingress : status.getLoadBalancer().getIngress()) {
                    if (ingress.getIp() != null) {
                        addresses.add(ingress.getIp());
                    } else if (ingress.getHostname() != null) {
                        addresses.add(ingress.getHostname());
                    }
                }
                detail.setAddress(String.join(",", addresses));
                IngressDetailResponse.StatusInfo statusInfo = new IngressDetailResponse.StatusInfo();
                statusInfo.setAddresses(addresses);
                detail.setStatus(statusInfo);
            }

            List<IngressDetailResponse.EventInfo> events = new ArrayList<>();
            try {
                String cmd = String.format("kubectl get events -n %s --field-selector involvedObject.name=%s,involvedObject.kind=Ingress --sort-by='.lastTimestamp' -o json", namespace, name);
                executeCommand(session, cmd, true);
            } catch (Exception e) {
                // ignore
            }
            detail.setEvents(events);

            try {
                detail.setYaml(Yaml.dump(v1Ingress));
            } catch (Exception e) {
                detail.setYaml("");
            }

            return detail;
        } catch (ApiException e) {
            throw new RuntimeException("Không thể lấy chi tiết ingress: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chi tiết ingress: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public void deleteIngress(String namespace, String name) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            NetworkingV1Api api = new NetworkingV1Api(client);
            api.deleteNamespacedIngress(name, namespace, null, null, null, null, null, null);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể xóa ingress: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể xóa ingress: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public IngressResponse updateIngressFromYaml(String namespace, String name, String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            NetworkingV1Api api = new NetworkingV1Api(client);

            V1Ingress ingressFromYaml = Yaml.loadAs(yaml, V1Ingress.class);
            if (ingressFromYaml == null) {
                throw new RuntimeException("YAML không hợp lệ");
            }

            if (ingressFromYaml.getMetadata() == null) {
                ingressFromYaml.setMetadata(new V1ObjectMeta());
            }
            if (!name.equals(ingressFromYaml.getMetadata().getName())) {
                throw new RuntimeException("Tên trong YAML không khớp với tên ingress");
            }
            if (!namespace.equals(ingressFromYaml.getMetadata().getNamespace())) {
                throw new RuntimeException("Namespace trong YAML không khớp với namespace ingress");
            }

            V1Ingress existing = api.readNamespacedIngress(name, namespace, null);
            if (existing == null) {
                throw new RuntimeException("Ingress không tồn tại");
            }
            if (existing.getMetadata() != null) {
                ingressFromYaml.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
                ingressFromYaml.getMetadata().setUid(existing.getMetadata().getUid());
            }

            V1Ingress updated = api.replaceNamespacedIngress(name, namespace, ingressFromYaml, null, null, null, null);
            return buildIngressResponse(updated);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể cập nhật ingress từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể cập nhật ingress từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public IngressResponse createIngress(IngressRequest request) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            NetworkingV1Api api = new NetworkingV1Api(client);

            V1Ingress ingress = buildV1IngressFromRequest(request);
            V1Ingress created = api.createNamespacedIngress(
                    request.getNamespace(),
                    ingress,
                    null,
                    null,
                    null,
                    null);
            return buildIngressResponse(created);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo ingress: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo ingress: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    @Override
    public IngressResponse updateIngress(String namespace, String name, IngressRequest request) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            NetworkingV1Api api = new NetworkingV1Api(client);

            // Lấy ingress hiện tại để giữ lại resourceVersion và UID
            V1Ingress existing = api.readNamespacedIngress(name, namespace, null);
            if (existing == null) {
                throw new RuntimeException("Ingress không tồn tại");
            }

            V1Ingress ingress = buildV1IngressFromRequest(request);
            
            // Merge metadata từ ingress hiện tại
            if (existing.getMetadata() != null) {
                ingress.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
                ingress.getMetadata().setUid(existing.getMetadata().getUid());
            }

            V1Ingress updated = api.replaceNamespacedIngress(name, namespace, ingress, null, null, null, null);
            return buildIngressResponse(updated);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể cập nhật ingress: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể cập nhật ingress: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
    }

    private V1Ingress buildV1IngressFromRequest(IngressRequest request) {
        V1Ingress ingress = new V1Ingress();
        ingress.setApiVersion("networking.k8s.io/v1");
        ingress.setKind("Ingress");

        // Metadata
        V1ObjectMeta metadata = new V1ObjectMeta();
        metadata.setName(request.getName());
        metadata.setNamespace(request.getNamespace());
        ingress.setMetadata(metadata);

        // Spec
        V1IngressSpec spec = new V1IngressSpec();
        
        // Ingress Class
        if (request.getIngressClass() != null && !request.getIngressClass().isEmpty()) {
            spec.setIngressClassName(request.getIngressClass());
        }

        // Rules
        List<V1IngressRule> rules = new ArrayList<>();
        if (request.getHosts() != null && !request.getHosts().isEmpty()) {
            for (String host : request.getHosts()) {
                V1IngressRule rule = new V1IngressRule();
                rule.setHost(host.trim());
                
                // Tạo HTTP path với default backend (service name = request name, port = first port hoặc 80)
                V1HTTPIngressPath path = new V1HTTPIngressPath();
                path.setPathType("Prefix");
                path.setPath("/");
                
                V1IngressBackend backend = new V1IngressBackend();
                V1IngressServiceBackend serviceBackend = new V1IngressServiceBackend();
                serviceBackend.setName(request.getName()); // Sử dụng tên ingress làm service name
                
                io.kubernetes.client.openapi.models.V1ServiceBackendPort servicePort = 
                    new io.kubernetes.client.openapi.models.V1ServiceBackendPort();
                int port = (request.getPorts() != null && !request.getPorts().isEmpty()) 
                    ? request.getPorts().get(0) : 80;
                servicePort.setNumber(port);
                serviceBackend.setPort(servicePort);
                
                backend.setService(serviceBackend);
                path.setBackend(backend);
                
                V1HTTPIngressRuleValue httpRule = new V1HTTPIngressRuleValue();
                httpRule.setPaths(List.of(path));
                rule.setHttp(httpRule);
                
                rules.add(rule);
            }
        } else {
            // Nếu không có hosts, tạo rule mặc định
            V1IngressRule rule = new V1IngressRule();
            V1HTTPIngressPath path = new V1HTTPIngressPath();
            path.setPathType("Prefix");
            path.setPath("/");
            
            V1IngressBackend backend = new V1IngressBackend();
            V1IngressServiceBackend serviceBackend = new V1IngressServiceBackend();
            serviceBackend.setName(request.getName());
            
            io.kubernetes.client.openapi.models.V1ServiceBackendPort servicePort = 
                new io.kubernetes.client.openapi.models.V1ServiceBackendPort();
            int port = (request.getPorts() != null && !request.getPorts().isEmpty()) 
                ? request.getPorts().get(0) : 80;
            servicePort.setNumber(port);
            serviceBackend.setPort(servicePort);
            
            backend.setService(serviceBackend);
            path.setBackend(backend);
            
            io.kubernetes.client.openapi.models.V1HTTPIngressRuleValue httpRule = 
                new io.kubernetes.client.openapi.models.V1HTTPIngressRuleValue();
            httpRule.setPaths(List.of(path));
            rule.setHttp(httpRule);
            
            rules.add(rule);
        }
        
        spec.setRules(rules);
        ingress.setSpec(spec);

        return ingress;
    }

    @Override
    public IngressResponse createIngressFromYaml(String yaml) {
        ServerEntity masterServer = getMasterServer();
        Session session = null;
        try {
            session = createSession(masterServer);
            ApiClient client = createKubernetesClient(session);
            NetworkingV1Api api = new NetworkingV1Api(client);

            V1Ingress ingressFromYaml = Yaml.loadAs(yaml, V1Ingress.class);
            if (ingressFromYaml == null || ingressFromYaml.getMetadata() == null
                    || ingressFromYaml.getMetadata().getName() == null
                    || ingressFromYaml.getMetadata().getNamespace() == null) {
                throw new RuntimeException("YAML thiếu name hoặc namespace");
            }

            V1Ingress created = api.createNamespacedIngress(
                    ingressFromYaml.getMetadata().getNamespace(),
                    ingressFromYaml,
                    null,
                    null,
                    null,
                    null);
            return buildIngressResponse(created);
        } catch (ApiException e) {
            throw new RuntimeException("Không thể tạo ingress từ YAML: " + e.getResponseBody(), e);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo ingress từ YAML: " + e.getMessage(), e);
        } finally {
            if (session != null && session.isConnected()) {
                session.disconnect();
            }
        }
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

    private ServiceResponse buildServiceResponse(V1Service v1Service) {
        ServiceResponse service = new ServiceResponse();
        String namespace = v1Service.getMetadata().getNamespace();
        String name = v1Service.getMetadata().getName();
        service.setId(name + "-" + namespace);
        service.setName(name);
        service.setNamespace(namespace);
        service.setAge(calculateAge(v1Service.getMetadata().getCreationTimestamp()));

        V1ServiceSpec spec = v1Service.getSpec();
        if (spec != null) {
            service.setType(spec.getType() != null ? spec.getType() : "ClusterIP");
            if (spec.getClusterIP() != null && !"None".equals(spec.getClusterIP())) {
                service.setClusterIP(spec.getClusterIP());
            } else {
                service.setClusterIP("-");
            }

            List<ServiceResponse.PortInfo> ports = new ArrayList<>();
            if (spec.getPorts() != null) {
                for (V1ServicePort servicePort : spec.getPorts()) {
                    ServiceResponse.PortInfo portInfo = new ServiceResponse.PortInfo();
                    if (servicePort.getPort() != null) {
                        portInfo.setPort(servicePort.getPort());
                    }
                    if (servicePort.getTargetPort() != null) {
                        if (servicePort.getTargetPort().isInteger()) {
                            portInfo.setTargetPort(servicePort.getTargetPort().getIntValue());
                        } else if (servicePort.getTargetPort().getStrValue() != null) {
                            try {
                                portInfo.setTargetPort(
                                        Integer.parseInt(servicePort.getTargetPort().getStrValue()));
                            } catch (NumberFormatException e) {
                                portInfo.setTargetPort(servicePort.getPort());
                            }
                        }
                    } else {
                        portInfo.setTargetPort(servicePort.getPort());
                    }
                    portInfo.setProtocol(servicePort.getProtocol() != null ? servicePort.getProtocol() : "TCP");
                    ports.add(portInfo);
                }
            }
            service.setPorts(ports);

            if (spec.getSelector() != null && !spec.getSelector().isEmpty()) {
                Map<String, String> selector = new HashMap<>(spec.getSelector());
                service.setSelector(selector);
            } else {
                service.setSelector(new HashMap<>());
            }
        }

        String externalIP = "-";
        V1ServiceStatus status = v1Service.getStatus();
        if (status != null && status.getLoadBalancer() != null
                && status.getLoadBalancer().getIngress() != null
                && !status.getLoadBalancer().getIngress().isEmpty()) {
            List<String> externalIPs = new ArrayList<>();
            for (io.kubernetes.client.openapi.models.V1LoadBalancerIngress ingress : status.getLoadBalancer()
                    .getIngress()) {
                if (ingress.getIp() != null) {
                    externalIPs.add(ingress.getIp());
                } else if (ingress.getHostname() != null) {
                    externalIPs.add(ingress.getHostname());
                }
            }
            if (!externalIPs.isEmpty()) {
                externalIP = String.join(",", externalIPs);
            }
        } else if (spec != null && spec.getExternalIPs() != null && !spec.getExternalIPs().isEmpty()) {
            externalIP = String.join(",", spec.getExternalIPs());
        }
        service.setExternalIP(externalIP);
        return service;
    }

    private V1Service buildV1ServiceFromRequest(ServiceRequest request) {
        V1Service service = new V1Service();
        service.setApiVersion("v1");
        service.setKind("Service");

        // Metadata
        V1ObjectMeta metadata = new V1ObjectMeta();
        metadata.setName(request.getName());
        metadata.setNamespace(request.getNamespace());
        if (request.getLabels() != null && !request.getLabels().isEmpty()) {
            metadata.setLabels(new HashMap<>(request.getLabels()));
        }
        service.setMetadata(metadata);

        // Spec
        V1ServiceSpec spec = new V1ServiceSpec();
        spec.setType(request.getType() != null ? request.getType() : "ClusterIP");
        if (request.getClusterIP() != null && !request.getClusterIP().isEmpty()) {
            spec.setClusterIP(request.getClusterIP());
        }

        // Ports
        if (request.getPorts() != null && !request.getPorts().isEmpty()) {
            List<V1ServicePort> ports = new ArrayList<>();
            for (ServiceRequest.PortRequest portReq : request.getPorts()) {
                V1ServicePort port = new V1ServicePort();
                if (portReq.getName() != null) {
                    port.setName(portReq.getName());
                }
                if (portReq.getPort() != null) {
                    port.setPort(portReq.getPort());
                }
                if (portReq.getTargetPort() != null) {
                    port.setTargetPort(new io.kubernetes.client.custom.IntOrString(portReq.getTargetPort()));
                } else if (portReq.getPort() != null) {
                    port.setTargetPort(new io.kubernetes.client.custom.IntOrString(portReq.getPort()));
                }
                if (portReq.getProtocol() != null) {
                    port.setProtocol(portReq.getProtocol());
                } else {
                    port.setProtocol("TCP");
                }
                ports.add(port);
            }
            spec.setPorts(ports);
        }

        // Selector
        if (request.getSelector() != null && !request.getSelector().isEmpty()) {
            spec.setSelector(new HashMap<>(request.getSelector()));
        }

        // ExternalIPs
        if (request.getExternalIPs() != null && !request.getExternalIPs().isEmpty()) {
            spec.setExternalIPs(new ArrayList<>(request.getExternalIPs()));
        }

        service.setSpec(spec);
        return service;
    }

    private IngressResponse buildIngressResponse(V1Ingress v1Ingress) {
        IngressResponse ingress = new IngressResponse();
        String namespace = v1Ingress.getMetadata().getNamespace();
        String name = v1Ingress.getMetadata().getName();
        ingress.setId(name + "-" + namespace);
        ingress.setName(name);
        ingress.setNamespace(namespace);
        ingress.setAge(calculateAge(v1Ingress.getMetadata().getCreationTimestamp()));

        V1IngressSpec spec = v1Ingress.getSpec();
        if (spec != null) {
            ingress.setIngressClass(spec.getIngressClassName());
            List<String> hosts = new ArrayList<>();
            Set<Integer> portsSet = new HashSet<>();

            if (spec.getRules() != null) {
                for (V1IngressRule rule : spec.getRules()) {
                    if (rule.getHost() != null && !rule.getHost().isEmpty()) {
                        hosts.add(rule.getHost());
                    }
                    if (rule.getHttp() != null && rule.getHttp().getPaths() != null) {
                        rule.getHttp().getPaths().forEach(path -> {
                            if (path.getBackend() != null
                                    && path.getBackend().getService() != null
                                    && path.getBackend().getService().getPort() != null) {
                                io.kubernetes.client.openapi.models.V1ServiceBackendPort servicePort = path
                                        .getBackend().getService().getPort();
                                if (servicePort.getNumber() != null) {
                                    portsSet.add(servicePort.getNumber());
                                } else if (servicePort.getName() != null) {
                                    if ("http".equalsIgnoreCase(servicePort.getName())) {
                                        portsSet.add(80);
                                    } else if ("https".equalsIgnoreCase(servicePort.getName())) {
                                        portsSet.add(443);
                                    }
                                }
                            }
                        });
                    }
                }
            }

            ingress.setHosts(hosts);

            List<Integer> ports = new ArrayList<>(portsSet);
            if (ports.isEmpty()) {
                ports.add(80);
                ports.add(443);
            }
            ports.sort(Integer::compareTo);
            ingress.setPorts(ports);
        } else {
            ingress.setHosts(new ArrayList<>());
            ingress.setPorts(List.of(80, 443));
        }

        String address = null;
        V1IngressStatus status = v1Ingress.getStatus();
        if (status != null && status.getLoadBalancer() != null
                && status.getLoadBalancer().getIngress() != null
                && !status.getLoadBalancer().getIngress().isEmpty()) {
            List<String> addresses = new ArrayList<>();
            for (V1IngressLoadBalancerIngress lbIngress : status.getLoadBalancer().getIngress()) {
                if (lbIngress.getIp() != null) {
                    addresses.add(lbIngress.getIp());
                } else if (lbIngress.getHostname() != null) {
                    addresses.add(lbIngress.getHostname());
                }
            }
            if (!addresses.isEmpty()) {
                address = String.join(",", addresses);
            }
        }
        ingress.setAddress(address);
        return ingress;
    }
}

