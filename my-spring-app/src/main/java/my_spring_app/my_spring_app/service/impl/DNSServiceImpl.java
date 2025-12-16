package my_spring_app.my_spring_app.service.impl;

import lombok.RequiredArgsConstructor;
import my_spring_app.my_spring_app.dto.reponse.DNSCheckResponse;
import my_spring_app.my_spring_app.repository.DNSRepository;
import my_spring_app.my_spring_app.service.DNSService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class DNSServiceImpl implements DNSService {

    private final DNSRepository dnsRepository;

    @Override
    public DNSCheckResponse checkDomain(String domainNameSystem) {
        if (!StringUtils.hasText(domainNameSystem)) {
            return new DNSCheckResponse(false, "domainNameSystem không được để trống");
        }

        boolean exists = dnsRepository.existsDomain(domainNameSystem.trim());
        String message = exists ? "Domain name đã tồn tại" : "Domain name hợp lệ có thể sử dụng";
        return new DNSCheckResponse(exists, message);
    }
}

