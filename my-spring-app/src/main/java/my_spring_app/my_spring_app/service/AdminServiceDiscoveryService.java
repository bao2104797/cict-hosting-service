package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.IngressDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.IngressListResponse;
import my_spring_app.my_spring_app.dto.reponse.IngressResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceListResponse;
import my_spring_app.my_spring_app.dto.reponse.ServiceResponse;
import my_spring_app.my_spring_app.dto.request.IngressRequest;
import my_spring_app.my_spring_app.dto.request.ServiceRequest;

public interface AdminServiceDiscoveryService {

    ServiceListResponse getServices();

    ServiceResponse getService(String namespace, String name);

    ServiceDetailResponse getServiceDetail(String namespace, String name);

    ServiceResponse createService(ServiceRequest request);

    ServiceResponse createServiceFromYaml(String yaml);

    ServiceResponse updateServiceFromYaml(String namespace, String name, String yaml);

    void deleteService(String namespace, String name);

    IngressListResponse getIngress();

    IngressResponse getIngress(String namespace, String name);

    IngressDetailResponse getIngressDetail(String namespace, String name);

    IngressResponse createIngress(IngressRequest request);

    IngressResponse updateIngress(String namespace, String name, IngressRequest request);

    IngressResponse updateIngressFromYaml(String namespace, String name, String yaml);

    IngressResponse createIngressFromYaml(String yaml);

    void deleteIngress(String namespace, String name);
}

