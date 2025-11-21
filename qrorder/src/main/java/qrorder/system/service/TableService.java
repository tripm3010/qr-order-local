package qrorder.system.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import qrorder.system.config.security.StoreUserDetails;
import qrorder.system.dto.TableStatusDTO;
import qrorder.system.dto.request.TableRequest;
import qrorder.system.dto.response.TableResponse;
import qrorder.system.entity.Store;
import qrorder.system.entity.TableInfo;
import qrorder.system.enums.OrderStatus;
import qrorder.system.enums.TableStatus;
import qrorder.system.repository.StoreRepository;
import qrorder.system.repository.CustomerOrderRepository;
import qrorder.system.repository.TableRepository;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TableService {

    @Autowired
    private TableRepository tableRepository;

    @Autowired
    private StoreRepository storeRepository;

    // [MỚI] Tiêm CustomerOrderRepository
    @Autowired
    private CustomerOrderRepository customerOrderRepository;

    // [MỚI] Danh sách các trạng thái đơn hàng được coi là "hoạt động" (chưa thanh toán)
    private static final List<OrderStatus> ACTIVE_ORDER_STATUSES = Arrays.asList(
            OrderStatus.PENDING,
            OrderStatus.PREPARING,
            OrderStatus.COMPLETED
    );

    /**
     * Admin/Staff tạo Bàn mới
     */
    public TableResponse createTable(TableRequest request, StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy chi nhánh"));

        TableInfo table = new TableInfo();
        table.setName(request.name());
        table.setCapacity(request.capacity());
        table.setStore(store);
        // accessKey sẽ được tự động tạo bởi @PrePersist trong Entity Table

        TableInfo savedTable = tableRepository.save(table);
        return toTableResponse(savedTable);
    }

    /**
     * Admin/Staff xem tất cả các Bàn của chi nhánh
     */
    @Transactional(readOnly = true)
    public List<TableResponse> getTablesByStore(Long storeId) {
        return tableRepository.findAllByStoreId(storeId).stream()
                .map(this::toTableResponse)
                .collect(Collectors.toList());
    }

    public TableResponse updateTable(Long tableId, TableRequest request, Long storeId) {
        TableInfo table = tableRepository.findById(tableId)
                .orElseThrow(() -> new RuntimeException("Table not found"));

        // Bảo mật: Đảm bảo bàn này thuộc store của admin
        if (!table.getStore().getId().equals(storeId)) {
            throw new AccessDeniedException("Table not found in your store");
        }

        table.setName(request.name());
        table.setCapacity(request.capacity());

        TableInfo updatedTable = tableRepository.save(table);
        return toTableResponse(updatedTable);
    }

    public void deleteTable(Long tableId, Long storeId) {
        TableInfo table = tableRepository.findById(tableId)
                .orElseThrow(() -> new RuntimeException("Table not found"));

        if (!table.getStore().getId().equals(storeId)) {
            throw new AccessDeniedException("Table not found in your store");
        }

        // TODO: Cân nhắc: Nếu bàn đang có order, CSDL sẽ báo lỗi
        // Cần xử lý logic (ví dụ: không cho xóa bàn đang có order PENDING)

        tableRepository.delete(table);
    }


    // Helper: Chuyển Entity sang Response DTO
    private TableResponse toTableResponse(TableInfo table) {
        return new TableResponse(
                table.getId(),
                table.getName(),
                table.getCapacity(),
                table.getStore().getId(),
                table.getAccessKey() // [QUAN TRỌNG] Trả về key để Frontend tạo QR
        );
    }

    /**
     * Admin/Staff xem tất cả các Bàn của chi nhánh
     * (Bao gồm cả accessKey để có thể xem lại QR bất cứ lúc nào)
     */
    @Transactional(readOnly = true)
    public List<TableResponse> getAllTablesForStore(StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();
        List<TableInfo> tables = tableRepository.findAllByStoreId(storeId);
        return tables.stream()
                .map(this::toTableResponse)
                .collect(Collectors.toList());
    }

    /**
     * Lấy danh sách trạng thái bàn (Cho Sơ đồ bàn của Staff)
     * (Logic này có thể được tích hợp vào getAllTablesForStore hoặc tách riêng như cũ)
     * Hiện tại StaffView đang dùng getAllTablesForStore (API /api/admin/tables) để lấy danh sách bàn và key,
     * và dùng API /api/staff/tables (map về getTableStatusesForStore) để lấy trạng thái.
     * * Ở đây tôi giữ nguyên getTableStatusesForStore từ phiên bản cũ để tương thích với StaffController.
     */
    @Transactional(readOnly = true)
    public List<TableStatusDTO> getTableStatusesForStore(StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();
        List<TableInfo> tables = tableRepository.findAllByStoreId(storeId);

        return tables.stream()
                .map(table -> {
                    // Kiểm tra trạng thái hoạt động
                    boolean hasActiveOrder = customerOrderRepository.existsByTableAndStatusIn(
                            table,
                            java.util.Arrays.asList(
                                    OrderStatus.PENDING,
                                    OrderStatus.PREPARING,
                                    OrderStatus.COMPLETED,
                                    OrderStatus.SERVED
                            )
                    );

                    return new TableStatusDTO(
                            table.getId(),
                            table.getName(),
                            table.getCapacity(),
                            hasActiveOrder ? TableStatus.ACTIVE : TableStatus.EMPTY,
                            table.getAccessKey()
                    );
                })
                .collect(Collectors.toList());
    }
}