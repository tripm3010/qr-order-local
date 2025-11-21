package qrorder.system.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import qrorder.system.entity.OrderItem;

import java.util.List;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {
    // [MỚI] Tìm tất cả các món hàng theo ID của đơn hàng cha
    List<OrderItem> findByOrder_Id(Long orderId);
}

