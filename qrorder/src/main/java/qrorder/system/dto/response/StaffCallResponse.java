package qrorder.system.dto.response;

import java.time.LocalDateTime;

// 2. DTO Backend gửi xuống cho Nhân viên (Response)
public record StaffCallResponse(
        Long tableId,
        String tableName, // Tên của bàn
        String callType,  // "SERVICE" hoặc "PAYMENT"
        LocalDateTime timestamp // Thời điểm gọi
) {}