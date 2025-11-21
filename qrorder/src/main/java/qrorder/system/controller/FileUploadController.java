package qrorder.system.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import qrorder.system.service.FileStorageService;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')") // Chỉ Admin được upload
public class FileUploadController {

    @Autowired
    private FileStorageService fileStorageService;

    /**
     * API để upload một file ảnh
     * POST /api/admin/upload
     */
    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        // 1. Lưu file
        String filename = fileStorageService.store(file);

        // 2. Tạo URL đầy đủ để trả về
        // (ví dụ: http://default.localhost:8080/images/<filename>)
        String fileUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/images/")
                .path(filename)
                .toUriString();

        // 3. Trả về URL
        return ResponseEntity.ok(Map.of("url", fileUrl));
    }
}