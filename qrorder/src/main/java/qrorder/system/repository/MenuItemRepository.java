package qrorder.system.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import qrorder.system.entity.MenuItem;

import java.util.List;
import java.util.Optional;

@Repository
public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {
    // Tìm tất cả món ăn theo storeId
    List<MenuItem> findAllByStoreIdAndDeletedFalse(Long storeId);

    // Tìm tất cả món ăn theo categoryId (và storeId để bảo mật)
    List<MenuItem> findAllByCategoryIdAndStoreId(Long categoryId, Long storeId);

    // Tìm một món ăn cụ thể theo storeId và itemId (để check quyền)
    Optional<MenuItem> findByIdAndStoreId(Long id, Long storeId);

    List<MenuItem> findAllByCategoryIdAndStoreIdAndDeletedFalse(Long categoryId, Long storeId);
}
