package my_spring_app.my_spring_app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "frontend_request")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FrontendRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "frontend_id", nullable = false)
    private ProjectFrontendEntity frontend;

    @Column(name = "old_replicas", nullable = false)
    private Integer oldReplicas;

    @Column(name = "new_replicas", nullable = false)
    private Integer newReplicas;

    @Column(name = "reason_reject", nullable = true)
    private String reasonReject;

    @Column(nullable = false)
    private String status; // PENDING, APPROVED, REJECTED

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}

