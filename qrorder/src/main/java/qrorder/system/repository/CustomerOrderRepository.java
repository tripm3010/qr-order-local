package qrorder.system.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import qrorder.system.entity.CustomerOrder;
import qrorder.system.entity.TableInfo;
import qrorder.system.enums.OrderStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long> {
    // Các hàm truy vấn đơn hàng sẽ được thêm sau (ví dụ: tìm theo bàn, theo store...)

    // [MỚI] Tìm đơn hàng theo ID và Store ID (để bảo mật multi-tenant)
    Optional<CustomerOrder> findByIdAndStoreId(Long id, Long storeId);

    // [MỚI] Tìm tất cả đơn hàng theo Store ID và danh sách trạng thái
    List<CustomerOrder> findAllByStoreIdAndStatusIn(Long storeId, Collection<OrderStatus> statuses);

    /**
     * [MỚI]
     * Kiểm tra xem một Bàn (tableId) có bất kỳ đơn hàng nào
     * đang ở trong các trạng thái (statuses) được chỉ định hay không.
     * Dùng để kiểm tra xem bàn là EMPTY hay ACTIVE.
     */
    boolean existsByTableAndStatusIn(TableInfo tableInfo, Collection<OrderStatus> statuses);
    /**
     * [MỚI]
     * Lấy tất cả các đơn hàng của một bàn cụ thể
     * (dùng storeId để bảo mật)
     */
    List<CustomerOrder> findAllByTableAndStoreId(TableInfo tableInfo, Long storeId);
    /**
     * [MỚI] Lấy các đơn hàng đang hoạt động (chưa thanh toán)
     * của một bàn cụ thể (dùng cho Giao diện Khách hàng)
     */
    List<CustomerOrder> findAllByTableAndStoreIdAndStatusIn(TableInfo tableInfo, Long storeId, Collection<OrderStatus> statuses);

}
