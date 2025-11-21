package qrorder.system.dto.request;

// Dùng để nhận request CẬP NHẬT user
public record UserUpdateRequest(
        String username, // Tùy chọn, có thể null
        String password, // Tùy chọn, null hoặc rỗng nếu không muốn đổi
        String role     // Tùy chọn, có thể null
) {}