package qrorder.system.dto.request;

public record StoreCreateRequest(
        String storeName,      // Tên hiển thị (VD: Phở Hùng)
        String subdomain,      // Định danh (VD: pho-hung)
        String adminUsername,  // Tài khoản admin cho quán đó
        String adminPassword   // Mật khẩu khởi tạo
) {}