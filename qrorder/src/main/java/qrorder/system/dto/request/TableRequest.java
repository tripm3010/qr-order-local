package qrorder.system.dto.request;

// Dùng cho request tạo/cập nhật Bàn
public record TableRequest(
        String name, // Ví dụ: "Bàn 1", "Lầu 2 - Bàn 5"
        int capacity // Sức chứa (số người)
) {}