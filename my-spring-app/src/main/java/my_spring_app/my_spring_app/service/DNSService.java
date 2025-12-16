package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.DNSCheckResponse;

public interface DNSService {

    DNSCheckResponse checkDomain(String domainNameSystem);
}

