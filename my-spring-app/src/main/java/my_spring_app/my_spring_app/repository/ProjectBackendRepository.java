package my_spring_app.my_spring_app.repository;

import my_spring_app.my_spring_app.entity.ProjectBackendEntity;
import my_spring_app.my_spring_app.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectBackendRepository extends JpaRepository<ProjectBackendEntity, Long> {

    boolean existsByDomainNameSystem(String domainNameSystem);

    @Query("SELECT COUNT(e) > 0 FROM ProjectBackendEntity e WHERE e.uuid_k8s = :uuid_k8s")
    boolean existsByUuid_k8s(@Param("uuid_k8s") String uuid_k8s);
    
    long countByProject_User(UserEntity user);
}

