package qrorder.system.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import qrorder.system.config.tenant.TenantInterceptor;

@Configuration
public class WebConfig implements WebMvcConfigurer {

//    @Autowired
//    private TenantInterceptor tenantInterceptor;

/*    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Áp dụng Interceptor này cho TẤT CẢ các đường dẫn API
        registry.addInterceptor(tenantInterceptor)
                .addPathPatterns("/api/**"); // Áp dụng cho mọi API
    }*/

    /**
     * [GIỮ NGUYÊN] Cấu hình CORS
     */
    /*@Override
    public void addCorsMappings(CorsRegistry registry) {
        // [FIX LỖI CORS] Áp dụng cho cả API (/api) và WebSocket (/ws)
        registry.addMapping("/**")
                .allowedOrigins(
                        "http://localhost:3000", // Cho phép React (default)
                        "http://localhost:5173",  // Cho phép React (Vite)
                        // [CẬP NHẬT] Thêm các subdomain test
                        "http://default.localhost:3000",
                        "http://gogi-hcm-1.localhost:3000",
                        "http://kichi-vungtau.localhost:3000"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }*/

    // (Nếu bạn đã xóa TenantInterceptor ở bước trước thì bỏ qua đoạn này,
    // nếu chưa thì giữ nguyên hoặc xóa theo hướng dẫn trước)
    // Ở đây tôi giả định bạn đang dùng TenantFilter nên không cần addInterceptors

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                // [QUAN TRỌNG] Cho phép tất cả các nguồn truy cập
                // (bao gồm cả https://, http://ip_lan, http://subdomain...)
                // Sử dụng allowedOriginPatterns("*") thay vì allowedOrigins("*")
                // để tương thích với allowCredentials(true)
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true); // Cho phép gửi token/cookie xác thực
    }
}
