package qrorder.system.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.Set;

@Entity
@Table(name = "store")
@Getter @Setter
public class Store {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String subdomain;

    @Column(nullable = false)
    private String name;

    // [MỚI] Thông tin ngân hàng
    @Column(name = "bank_id")
    private String bankId; // VD: MB, VCB

    @Column(name = "account_no")
    private String accountNo;

    @Column(name = "account_name")
    private String accountName;

    @Column(name = "qr_template")
    private String qrTemplate; // VD: compact, print

    @OneToMany(mappedBy = "store", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<AppUser> users;
}