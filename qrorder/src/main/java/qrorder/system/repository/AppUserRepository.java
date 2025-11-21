package qrorder.system.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import qrorder.system.entity.AppUser;

import java.util.List;
import java.util.Optional;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    // Tìm user theo username VÀ storeId (quan trọng cho multi-tenant)
    Optional<AppUser> findByUsernameAndStoreId(String username, Long storeId);
    Optional<AppUser> findByUsername(String username); // Tạm thời
    List<AppUser> findAllByStoreId(Long storeId);

}