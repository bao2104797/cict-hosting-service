package my_spring_app.my_spring_app.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class DNSRepository {

    private final ProjectBackendRepository projectBackendRepository;
    private final ProjectFrontendRepository projectFrontendRepository;

    /**
     * Kiểm tra domainNameSystem đã tồn tại ở Backend hoặc Frontend hay chưa.
     */
    public boolean existsDomain(String domainNameSystem) {
        if (domainNameSystem == null || domainNameSystem.isBlank()) {
            return false;
        }
        return projectBackendRepository.existsByDomainNameSystem(domainNameSystem)
                || projectFrontendRepository.existsByDomainNameSystem(domainNameSystem);
    }
}

