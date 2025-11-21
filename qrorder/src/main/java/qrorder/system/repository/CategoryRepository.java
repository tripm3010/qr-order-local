package qrorder.system.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import qrorder.system.entity.Category;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {
    // Tìm tất cả category theo storeId
    List<Category> findAllByStoreId(Long storeId);

    // Tìm một category cụ thể theo storeId và categoryId (để check quyền)
    Optional<Category> findByIdAndStoreId(Long id, Long storeId);

    boolean existsByIdAndStoreId(Long id, Long storeId);
}
