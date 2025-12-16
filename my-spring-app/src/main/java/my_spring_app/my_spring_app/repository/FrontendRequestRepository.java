package my_spring_app.my_spring_app.repository;

import my_spring_app.my_spring_app.entity.FrontendRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FrontendRequestRepository extends JpaRepository<FrontendRequestEntity, Long> {
    Optional<FrontendRequestEntity> findFirstByFrontend_IdAndStatus(Long frontendId, String status);
    List<FrontendRequestEntity> findAllByOrderByCreatedAtDesc();
    List<FrontendRequestEntity> findAllByStatusOrderByCreatedAtDesc(String status);
    
    // Tìm tất cả requests của các frontends thuộc một project
    @Query("SELECT fr FROM FrontendRequestEntity fr WHERE fr.frontend.project.id = :projectId ORDER BY fr.createdAt DESC")
    List<FrontendRequestEntity> findAllByFrontend_Project_IdOrderByCreatedAtDesc(@Param("projectId") Long projectId);
}

