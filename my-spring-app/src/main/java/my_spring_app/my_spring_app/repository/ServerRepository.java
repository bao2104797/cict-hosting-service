package my_spring_app.my_spring_app.repository;

import my_spring_app.my_spring_app.entity.ServerEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ServerRepository extends JpaRepository<ServerEntity, Long> {

    Optional<ServerEntity> findByRole(String role);

    List<ServerEntity> findAllByClusterStatusIgnoreCase(String clusterStatus);

    // Kiểm tra server đã tồn tại với cùng ip, port, username
    boolean existsByIpAndPortAndUsername(String ip, Integer port, String username);

    // Tìm server theo ip, port, username (để kiểm tra duplicate)
    Optional<ServerEntity> findByIpAndPortAndUsername(String ip, Integer port, String username);

    // Eager load SSH keys để tránh LazyInitializationException
    @Query("SELECT s FROM ServerEntity s LEFT JOIN FETCH s.sshKey")
    List<ServerEntity> findAllWithSshKeys();
}


