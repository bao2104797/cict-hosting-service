package my_spring_app.my_spring_app.repository;

import my_spring_app.my_spring_app.entity.BackendRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BackendRequestRepository extends JpaRepository<BackendRequestEntity, Long> {
    Optional<BackendRequestEntity> findFirstByBackend_IdAndStatus(Long backendId, String status);
    List<BackendRequestEntity> findAllByOrderByCreatedAtDesc();
    List<BackendRequestEntity> findAllByStatusOrderByCreatedAtDesc(String status);
    
    // Tìm tất cả requests của các backends thuộc một project
    @Query("SELECT br FROM BackendRequestEntity br WHERE br.backend.project.id = :projectId ORDER BY br.createdAt DESC")
    List<BackendRequestEntity> findAllByBackend_Project_IdOrderByCreatedAtDesc(@Param("projectId") Long projectId);
}

