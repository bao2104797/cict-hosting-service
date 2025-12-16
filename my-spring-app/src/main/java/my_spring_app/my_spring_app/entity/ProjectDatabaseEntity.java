package my_spring_app.my_spring_app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "project_database")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectDatabaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "project_name", nullable = false)
    private String projectName;

    @Column(name = "description", nullable = true)
    private String description;

    @Column(name = "database_type", nullable = false)
    private String databaseType; // MYSQL, MONGODB

    @Column(name = "database_ip", nullable = false)
    private String databaseIp;

    @Column(name = "database_port", nullable = false)
    private Integer databasePort;

     @Column(name = "database_name", nullable = false)
    private String databaseName;

    @Column(name = "database_username", nullable = false)
    private String databaseUsername;

    @Column(name = "database_password", nullable = false)
    private String databasePassword;

    // Deployment information for K8s

    @Column(name = "uuid_k8s", nullable = false)
    private String uuid_k8s; // uuid short id for k8s

    @Column(name = "storage_size", nullable = true)
    private Integer storageSize; // storage size in GB

    @Column(name = "source_path", nullable = true)
    private String sourcePath; // path to the source file

    @Column(name = "yaml_path", nullable = true)
    private String yamlPath; // path to the yaml file

    //

    @Column(nullable = false)
    private String status; // RUNNING, STOPPED, ERROR

    // Relations

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private ProjectEntity project;

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

