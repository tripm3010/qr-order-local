package qrorder.system.enums;

/**
 * Enum đại diện cho các trạng thái của một Đơn hàng
 */
public enum OrderStatus {
    PENDING,    // Chờ Bếp xác nhận
    PREPARING,  // Bếp đang chuẩn bị
    COMPLETED,  // Bếp đã hoàn thành
    SERVED,     // Nhân viên đã phục vụ
    PAID,       // Đã thanh toán
    CANCELLED   // Đã hủy
}