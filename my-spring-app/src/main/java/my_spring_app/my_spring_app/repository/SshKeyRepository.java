package my_spring_app.my_spring_app.repository;

import my_spring_app.my_spring_app.entity.SshKeyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SshKeyRepository extends JpaRepository<SshKeyEntity, Long> {
    
    List<SshKeyEntity> findByServer_Id(Long serverId);
}

