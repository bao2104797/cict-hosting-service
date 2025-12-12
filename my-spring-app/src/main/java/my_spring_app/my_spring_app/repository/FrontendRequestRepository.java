package my_spring_app.my_spring_app.repository;

import my_spring_app.my_spring_app.entity.FrontendRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FrontendRequestRepository extends JpaRepository<FrontendRequestEntity, Long> {
    Optional<FrontendRequestEntity> findFirstByFrontend_IdAndStatus(Long frontendId, String status);
    List<FrontendRequestEntity> findAllByOrderByCreatedAtDesc();
    List<FrontendRequestEntity> findAllByStatusOrderByCreatedAtDesc(String status);
}

