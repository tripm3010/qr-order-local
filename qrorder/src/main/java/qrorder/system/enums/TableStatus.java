package qrorder.system.enums;

/**
 * Enum định nghĩa trạng thái của một Bàn ăn
 */
public enum TableStatus {
    EMPTY,    // Bàn trống, không có order đang hoạt động
    ACTIVE    // Bàn đang có order (chờ, đang làm, đã xong nhưng chưa thanh toán)
}