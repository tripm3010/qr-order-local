package qrorder.system.dto.request;

/**
 * DTOs cho chức năng Khách hàng gọi Nhân viên
 */

// 1. DTO Khách hàng gửi lên (Request)
public record StaffCallRequest(
        Long tableId,
        String callType // Ví dụ: "SERVICE" (gọi phục vụ), "PAYMENT" (gọi thanh toán)
) {}