package qrorder.system.dto.response;

// Dùng để GỬI thông tin user về cho client (KHÔNG BAO GỒM MẬT KHẨU)
public record UserResponse(
        Long id,
        String username,
        String role,
        Long storeId
) {}