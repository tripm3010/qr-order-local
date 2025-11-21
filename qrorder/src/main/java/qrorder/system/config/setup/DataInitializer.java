package qrorder.system.config.setup;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import qrorder.system.entity.AppUser;
import qrorder.system.entity.Store;
import qrorder.system.repository.AppUserRepository;
import qrorder.system.repository.StoreRepository;

import java.util.Optional;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // === 1. KHỞI TẠO MASTER STORE (SAAS ADMIN) ===
        String masterSubdomain = "master";
        Store masterStore = storeRepository.findBySubdomain(masterSubdomain)
                .orElseGet(() -> {
                    Store s = new Store();
                    s.setSubdomain(masterSubdomain);
                    s.setName("Hệ Thống Quản Lý (SaaS)");
                    return storeRepository.save(s);
                });

        // Tạo Super Admin ("boss")
        if (appUserRepository.findByUsernameAndStoreId("boss", masterStore.getId()).isEmpty()) {
            AppUser boss = new AppUser();
            boss.setUsername("boss");
            boss.setPassword(passwordEncoder.encode("boss123")); // Mật khẩu: boss123
            boss.setRole("SUPER_ADMIN"); // Role quyền lực nhất
            boss.setStore(masterStore);
            appUserRepository.save(boss);
            System.out.println(">>> Đã tạo Super Admin: boss / boss123 (tại subdomain: master)");
        }

        // === 2. KHỞI TẠO DEFAULT STORE (DEMO NHÀ HÀNG) ===
        String defaultSubdomain = "default";
        Store defaultStore = storeRepository.findBySubdomain(defaultSubdomain)
                .orElseGet(() -> {
                    Store s = new Store();
                    s.setSubdomain(defaultSubdomain);
                    s.setName("Nhà Hàng Mẫu (Demo)");
                    return storeRepository.save(s);
                });

        // Tạo Admin cho nhà hàng mẫu ("admin")
        if (appUserRepository.findByUsernameAndStoreId("admin", defaultStore.getId()).isEmpty()) {
            AppUser admin = new AppUser();
            admin.setUsername("admin");
            admin.setPassword(passwordEncoder.encode("admin")); // Mật khẩu: admin
            admin.setRole("ADMIN");
            admin.setStore(defaultStore);
            appUserRepository.save(admin);
            System.out.println(">>> Đã tạo Store Admin: admin / admin (tại subdomain: default)");
        }
    }
}