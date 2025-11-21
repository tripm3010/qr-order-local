package qrorder.system.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import qrorder.system.dto.request.StoreCreateRequest;
import qrorder.system.dto.response.StoreResponse;
import qrorder.system.entity.AppUser;
import qrorder.system.entity.Store;
import qrorder.system.repository.AppUserRepository;
import qrorder.system.repository.StoreRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class StoreService {

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Lấy danh sách tất cả các cửa hàng (Chỉ Super Admin dùng)
     */
    public List<StoreResponse> getAllStores() {
        return storeRepository.findAll().stream()
                .map(s -> new StoreResponse(s.getId(), s.getName(), s.getSubdomain(), s.getBankId(), s.getAccountNo()))
                .collect(Collectors.toList());
    }

    /**
     * Tạo một Tenant (Cửa hàng) mới kèm tài khoản Admin
     */
    @Transactional
    public StoreResponse createTenant(StoreCreateRequest request) {
        // 1. Kiểm tra subdomain trùng
        if (storeRepository.findBySubdomain(request.subdomain()).isPresent()) {
            throw new RuntimeException("Subdomain '" + request.subdomain() + "' đã tồn tại.");
        }

        // 2. Tạo Store
        Store store = new Store();
        store.setName(request.storeName());
        store.setSubdomain(request.subdomain());
        // Các cấu hình bank để null, để họ tự vào setting
        Store savedStore = storeRepository.save(store);

        // 3. Tạo User Admin cho Store đó
        AppUser admin = new AppUser();
        admin.setUsername(request.adminUsername());
        admin.setPassword(passwordEncoder.encode(request.adminPassword()));
        admin.setRole("ADMIN"); // Role quản lý cửa hàng
        admin.setStore(savedStore);

        appUserRepository.save(admin);

        return new StoreResponse(savedStore.getId(), savedStore.getName(), savedStore.getSubdomain(), null, null);
    }
}