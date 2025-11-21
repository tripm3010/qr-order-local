package qrorder.system.config.tenant;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import qrorder.system.entity.Store;
import qrorder.system.repository.StoreRepository;

@Component
public class TenantInterceptor implements HandlerInterceptor {

    @Autowired
    private StoreRepository storeRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {

        // Lấy server name (ví dụ: "default.localhost", "gogi-hcm-1.ten-mien.com")
        String serverName = request.getServerName();
        String subdomain = extractSubdomain(serverName);

        // Tìm storeId tương ứng
        Store store = storeRepository.findBySubdomain(subdomain)
                .orElseThrow(() -> new RuntimeException("Chi nhánh không hợp lệ: " + subdomain));

        // Lưu storeId vào ThreadLocal cho request này
        TenantContext.setTenantId(store.getId());

        return true; // Tiếp tục request
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
        // Xóa storeId khỏi ThreadLocal sau khi request hoàn tất
        TenantContext.clear();
    }

    private String extractSubdomain(String serverName) {
        // Đây là logic giả định đơn giản
        // Trong thực tế, bạn cần xử lý tên miền chính (ví dụ: ".ten-mien.com")
        // Giả sử chạy ở localhost (ví dụ: "default.localhost:8080")
        if (serverName.contains(".")) {
            return serverName.split("\\.")[0];
        }
        return "default"; // Fallback
    }
}