package qrorder.system.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    // Thư mục gốc để lưu ảnh (ví dụ: 'uploads'
    // ngay tại nơi chạy file .jar)
    private final Path rootLocation = Paths.get("/app/uploads");

    public FileStorageService() {
        // Tạo thư mục nếu chưa tồn tại
        try {
            Files.createDirectories(rootLocation);
        } catch (IOException e) {
            throw new RuntimeException("Không thể khởi tạo thư mục lưu trữ", e);
        }
    }

    /**
     * Lưu file upload
     * @param file File được gửi lên
     * @return Tên file (duy nhất) đã được lưu
     */
    public String store(MultipartFile file) {
        try {
            if (file.isEmpty()) {
                throw new RuntimeException("File rỗng.");
            }

            // Tạo tên file duy nhất (ví dụ: <uuid>_<tên-gốc>)
            String originalFilename = file.getOriginalFilename();
            String fileExtension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String uniqueFilename = UUID.randomUUID().toString() + fileExtension;

            Path destinationFile = this.rootLocation.resolve(uniqueFilename)
                    .normalize().toAbsolutePath();

            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, destinationFile,
                        StandardCopyOption.REPLACE_EXISTING);
            }

            // Trả về tên file đã lưu
            return uniqueFilename;

        } catch (IOException e) {
            throw new RuntimeException("Không thể lưu file.", e);
        }
    }
}