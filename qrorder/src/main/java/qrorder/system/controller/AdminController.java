package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import qrorder.system.dto.request.UserCreateRequest;
import qrorder.system.dto.response.UserResponse;
import qrorder.system.dto.request.UserUpdateRequest;
import qrorder.system.service.AppUserService;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
// Chỉ Admin mới được vào đây (sẽ cấu hình trong SecurityConfig)
public class AdminController {

    @Autowired
    private AppUserService appUserService;

    /**
     * [CREATE] Tạo user mới (Staff, Kitchen, hoặc Admin khác)
     * POST /api/admin/users
     */
    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(@RequestBody UserCreateRequest request) {
        UserResponse response = appUserService.createUser(request);
        return ResponseEntity.ok(response);
    }

    /**
     * [READ] Lấy tất cả user trong chi nhánh của Admin
     * GET /api/admin/users
     */
    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        List<UserResponse> users = appUserService.getAllUsersForMyStore();
        return ResponseEntity.ok(users);
    }

    /**
     * [UPDATE] Cập nhật một user
     * PUT /api/admin/users/{userId}
     */
    @PutMapping("/users/{userId}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long userId, @RequestBody UserUpdateRequest request) {
        UserResponse updatedUser = appUserService.updateUser(userId, request);
        return ResponseEntity.ok(updatedUser);
    }

    /**
     * [DELETE] Xóa một user
     * DELETE /api/admin/users/{userId}
     */
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId) {
        appUserService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }
}