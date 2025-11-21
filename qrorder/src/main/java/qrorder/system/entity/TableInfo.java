package qrorder.system.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "table_info")
@Getter @Setter
public class TableInfo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "capacity", nullable = false)
    private int capacity;

    // [MỚI] Mã bí mật để tạo QR Code (Thay thế ID trên URL)
    // Ví dụ: "a1b2-c3d4-e5f6..."
    @Column(name = "access_key", nullable = false, unique = true)
    private String accessKey = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    // Helper: Tự động tạo key nếu chưa có (khi save)
    @PrePersist
    public void generateAccessKey() {
        if (this.accessKey == null) {
            this.accessKey = UUID.randomUUID().toString();
        }
    }
}
