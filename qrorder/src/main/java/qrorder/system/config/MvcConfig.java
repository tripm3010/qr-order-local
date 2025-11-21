package qrorder.system.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class MvcConfig implements WebMvcConfigurer {

    /**
     * Cấu hình này "mở" thư mục 'uploads' cho public
     * Bất kỳ request nào đến /images/** sẽ được
     * trỏ đến thư mục file:./uploads/
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Định nghĩa đường dẫn thực tế chứa ảnh
        Path uploadDir = Paths.get("/app/uploads");

        // [SỬA LỖI] Dùng toUri().toString() để tạo đường dẫn file chuẩn
        // (Nó sẽ tự động thêm số lượng dấu "/" đúng: file:///Users/...)
        String uploadPath = uploadDir.toAbsolutePath().toUri().toString();

        // Map URL "/images/**" vào thư mục trên ổ cứng
        registry.addResourceHandler("/images/**")
                .addResourceLocations(uploadPath);
    }
}