package my_spring_app.my_spring_app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "project_backend")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectBackendEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_name", nullable = false)
    private String projectName;

    @Column(name = "description", nullable = true)
    private String description;

    @Column(name = "deployment_type", nullable = false)
    private String deploymentType; // DOCKER, FILE

    @Column(nullable = false)
    private String frameworkType; // SPRING, NODEJS

    // Database information

    @Column(name = "database_ip", nullable = true)
    private String databaseIp;

    @Column(name = "database_port", nullable = true)
    private Integer databasePort;

    @Column(name = "database_name", nullable = true)
    private String databaseName;

    @Column(name = "database_username", nullable = true)
    private String databaseUsername;

    @Column(name = "database_password", nullable = true)
    private String databasePassword;

    // Deployment information for K8s

    @Column(name = "uuid_k8s", nullable = false)
    private String uuid_k8s; // uuid short id for k8s

    @Column(name = "replicas", nullable = true)
    private Integer replicas;

    @Column(name = "max_replicas", nullable = true)
    private Integer maxReplicas;

    @Column(name = "source_path", nullable = true)
    private String sourcePath;

    @Column(name = "yaml_path", nullable = true)
    private String yamlPath;

     @Column(name = "docker_image", nullable = true)
    private String dockerImage;

    @Column(name = "domain_name_system", nullable = true)
    private String domainNameSystem;

    //

    @Column(nullable = false)
    private String status; // RUNNING, STOPPED, ERROR

    // Relations

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private ProjectEntity project;

    @OneToMany(mappedBy = "backend", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BackendRequestEntity> requests = new ArrayList<>();

    //

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}

