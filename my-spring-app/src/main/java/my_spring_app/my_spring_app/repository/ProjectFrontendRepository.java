package my_spring_app.my_spring_app.repository;

import my_spring_app.my_spring_app.entity.ProjectFrontendEntity;
import my_spring_app.my_spring_app.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectFrontendRepository extends JpaRepository<ProjectFrontendEntity, Long> {
    
    Optional<ProjectFrontendEntity> findByDomainNameSystem(String domainNameSystem);
    
    boolean existsByDomainNameSystem(String domainNameSystem);
    
    // Kiểm tra uuid_k8s có tồn tại không
    @Query("SELECT COUNT(e) > 0 FROM ProjectFrontendEntity e WHERE e.uuid_k8s = :uuid_k8s")
    boolean existsByUuid_k8s(@Param("uuid_k8s") String uuid_k8s);
    
    long countByProject_User(UserEntity user);
}

