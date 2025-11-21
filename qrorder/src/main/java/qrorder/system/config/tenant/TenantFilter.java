package qrorder.system.config.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import qrorder.system.entity.Store;
import qrorder.system.repository.StoreRepository;

import java.io.IOException;

/**
 * Đây là một Security Filter (chạy RẤT SỚM).
 * Nhiệm vụ của nó là đọc subdomain (chi nhánh) từ request
 * và lưu storeId vào TenantContext.
 *
 * Nó phải chạy TRƯỚC JwtAuthFilter.
 */
@Component
public class TenantFilter extends OncePerRequestFilter {

    @Autowired
    private StoreRepository storeRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        try {
            String serverName = request.getServerName(); // vd: "192.168.1.25" hoặc "gogi.localhost"
            String subdomain = extractSubdomain(serverName);

            // Tìm Store trong DB
            Store store = storeRepository.findBySubdomain(subdomain)
                    .orElseThrow(() -> new RuntimeException("Chi nhánh không hợp lệ: " + subdomain));

            // Lưu storeId vào ThreadLocal
            TenantContext.setTenantId(store.getId());

            // Tiếp tục chuỗi filter
            filterChain.doFilter(request, response);
        } catch (RuntimeException e) {
            // [QUAN TRỌNG] Nếu lỗi (không tìm thấy store), trả về 404 rõ ràng
            // thay vì để Spring Security chặn thành 403
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            response.getWriter().write(e.getMessage());
        } finally {
            TenantContext.clear();
        }
    }

    private String extractSubdomain(String serverName) {
        // [SỬA LỖI] Kiểm tra nếu là địa chỉ IP (dạng số.số.số.số)
        // Regex này kiểm tra pattern IPv4 cơ bản
        if (serverName.matches("^\\d+\\.\\d+\\.\\d+\\.\\d+$")) {
            System.out.println("Phát hiện truy cập bằng IP (" + serverName + "), sử dụng 'default'");
            return "default";
        }

        // Logic cũ cho domain (vd: gogi.com -> gogi)
        if (serverName.contains(".")) {
            return serverName.split("\\.")[0];
        }

        // Fallback cho localhost (không có dấu chấm)
        return "default";
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
        String path = request.getRequestURI();
        // Không lọc các file tĩnh (ảnh, css, js)
        return !path.startsWith("/api") && !path.startsWith("/ws");
    }
}