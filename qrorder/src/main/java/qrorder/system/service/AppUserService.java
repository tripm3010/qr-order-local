package qrorder.system.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import qrorder.system.config.security.StoreUserDetails;
import qrorder.system.dto.request.UserCreateRequest;
import qrorder.system.dto.response.UserResponse;
import qrorder.system.dto.request.UserUpdateRequest;
import qrorder.system.entity.AppUser;
import qrorder.system.entity.Store;
import qrorder.system.repository.AppUserRepository;
import qrorder.system.repository.StoreRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AppUserService {

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Helper: Lấy thông tin user (Admin) đang đăng nhập
     */
    private StoreUserDetails getAuthenticatedAdmin() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof StoreUserDetails) {
            return (StoreUserDetails) principal;
        }
        throw new IllegalStateException("Không thể lấy thông tin người dùng từ Security Context");
    }

    /**
     * CREATE: Tạo user mới cho chi nhánh của Admin
     */
    @Transactional
    public UserResponse createUser(UserCreateRequest request) {
        Long adminStoreId = getAuthenticatedAdmin().getStoreId();

        // Kiểm tra xem username đã tồn tại trong chi nhánh này chưa
        appUserRepository.findByUsernameAndStoreId(request.username(), adminStoreId)
                .ifPresent(u -> {
                    throw new IllegalArgumentException("Username '" + request.username() + "' đã tồn tại trong chi nhánh này");
                });

        Store store = storeRepository.findById(adminStoreId)
                .orElseThrow(() -> new IllegalStateException("Không tìm thấy chi nhánh của Admin"));

        AppUser newUser = new AppUser();
        newUser.setUsername(request.username());
        newUser.setPassword(passwordEncoder.encode(request.password())); // Hash mật khẩu
        newUser.setRole(request.role()); // Cần validate role (ADMIN, STAFF, KITCHEN)
        newUser.setStore(store);

        AppUser savedUser = appUserRepository.save(newUser);
        return mapToUserResponse(savedUser);
    }

    /**
     * READ: Lấy tất cả user của chi nhánh của Admin
     */
    public List<UserResponse> getAllUsersForMyStore() {
        Long adminStoreId = getAuthenticatedAdmin().getStoreId();

        return appUserRepository.findAllByStoreId(adminStoreId).stream()
                .map(this::mapToUserResponse)
                .collect(Collectors.toList());
    }

    /**
     * UPDATE: Cập nhật user
     */
    @Transactional
    public UserResponse updateUser(Long userId, UserUpdateRequest request) {
        Long adminStoreId = getAuthenticatedAdmin().getStoreId();

        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy User ID: " + userId));

        // Bảo mật: Đảm bảo Admin chỉ sửa được user trong chi nhánh của mình
        if (!user.getStore().getId().equals(adminStoreId)) {
            throw new SecurityException("Bạn không có quyền sửa user của chi nhánh khác");
        }

        if (request.username() != null && !request.username().isEmpty()) {
            user.setUsername(request.username());
        }
        if (request.role() != null && !request.role().isEmpty()) {
            user.setRole(request.role());
        }
        if (request.password() != null && !request.password().isEmpty()) {
            user.setPassword(passwordEncoder.encode(request.password()));
        }

        AppUser updatedUser = appUserRepository.save(user);
        return mapToUserResponse(updatedUser);
    }

    /**
     * DELETE: Xóa user
     */
    @Transactional
    public void deleteUser(Long userId) {
        Long adminStoreId = getAuthenticatedAdmin().getStoreId();

        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy User ID: " +  userId));

        // Bảo mật: Đảm bảo Admin chỉ xóa được user trong chi nhánh của mình
        if (!user.getStore().getId().equals(adminStoreId)) {
            throw new SecurityException("Bạn không có quyền xóa user của chi nhánh khác");
        }

        appUserRepository.delete(user);
    }

    // Helper map Entity -> Response DTO
    private UserResponse mapToUserResponse(AppUser user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.getStore().getId()
        );
    }
}