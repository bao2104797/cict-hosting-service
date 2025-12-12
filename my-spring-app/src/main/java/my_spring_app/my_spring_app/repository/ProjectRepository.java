package my_spring_app.my_spring_app.repository;

import my_spring_app.my_spring_app.entity.ProjectEntity;
import my_spring_app.my_spring_app.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<ProjectEntity, Long> {
    
    // Tìm tất cả projects của một user
    List<ProjectEntity> findByUser(UserEntity user);
    
    // Đếm số lượng project của một user
    long countByUser(UserEntity user);
    
    // Query riêng để fetch databases
    @Query("SELECT DISTINCT p FROM ProjectEntity p LEFT JOIN FETCH p.databases WHERE p.user = :user")
    List<ProjectEntity> findByUserWithDatabases(@Param("user") UserEntity user);
    
    // Query riêng để fetch backends
    @Query("SELECT DISTINCT p FROM ProjectEntity p LEFT JOIN FETCH p.backends WHERE p.user = :user")
    List<ProjectEntity> findByUserWithBackends(@Param("user") UserEntity user);
    
    // Query riêng để fetch frontends
    @Query("SELECT DISTINCT p FROM ProjectEntity p LEFT JOIN FETCH p.frontends WHERE p.user = :user")
    List<ProjectEntity> findByUserWithFrontends(@Param("user") UserEntity user);
    
    // Query để fetch project by ID với databases
    @Query("SELECT DISTINCT p FROM ProjectEntity p LEFT JOIN FETCH p.databases WHERE p.id = :id")
    Optional<ProjectEntity> findByIdWithDatabases(@Param("id") Long id);
    
    // Query để fetch project by ID với backends
    @Query("SELECT DISTINCT p FROM ProjectEntity p LEFT JOIN FETCH p.backends WHERE p.id = :id")
    Optional<ProjectEntity> findByIdWithBackends(@Param("id") Long id);
    
    // Query để fetch project by ID với frontends
    @Query("SELECT DISTINCT p FROM ProjectEntity p LEFT JOIN FETCH p.frontends WHERE p.id = :id")
    Optional<ProjectEntity> findByIdWithFrontends(@Param("id") Long id);
}

