package my_spring_app.my_spring_app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "ssh_keys")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SshKeyEntity {

    public enum KeyType {
        RSA, ED25519
    }

    public enum KeyStatus {
        ACTIVE, REVOKED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Link to server
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "server_id")
    private ServerEntity server;

    @Enumerated(EnumType.STRING)
    @Column(name = "key_type", nullable = false, length = 16)
    private KeyType keyType = KeyType.RSA;

    @Column(name = "key_length")
    private Integer keyLength = 2048;

    @Column(name = "public_key", columnDefinition = "TEXT", nullable = false)
    private String publicKey;

    @Column(name = "encrypted_private_key", columnDefinition = "LONGTEXT", nullable = false)
    private String encryptedPrivateKey; // Lưu private key (có thể encrypt sau)

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private KeyStatus status = KeyStatus.ACTIVE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}