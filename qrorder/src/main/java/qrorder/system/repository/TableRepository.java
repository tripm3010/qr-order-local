package qrorder.system.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import qrorder.system.entity.TableInfo;

import java.util.List;
import java.util.Optional;

@Repository
public interface TableRepository extends JpaRepository<TableInfo, Long> {
    // Tìm tất cả bàn thuộc một chi nhánh (Dùng cho Admin/Staff)
    List<TableInfo> findAllByStoreId(Long storeId);

    // [MỚI] Tìm bàn bằng Access Key (Dùng cho Khách hàng khi quét QR)
    // Giúp bảo mật, ngăn chặn việc đoán ID bàn (IDOR)
    Optional<TableInfo> findByAccessKey(String accessKey);
}
