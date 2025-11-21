package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import qrorder.system.config.security.StoreUserDetails;
import qrorder.system.dto.StoreSettingsDTO;
import qrorder.system.entity.Store;
import qrorder.system.repository.StoreRepository;

@RestController
@RequestMapping("/api")
public class StoreSettingsController {

    @Autowired
    private StoreRepository storeRepository;

    // Admin cập nhật cấu hình
    @PutMapping("/admin/store/settings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateSettings(
            @RequestBody StoreSettingsDTO request,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        Store store = storeRepository.findById(userDetails.getStoreId())
                .orElseThrow(() -> new RuntimeException("Store not found"));

        store.setBankId(request.bankId());
        store.setAccountNo(request.accountNo());
        store.setAccountName(request.accountName());
        store.setQrTemplate(request.qrTemplate());

        storeRepository.save(store);
        return ResponseEntity.ok().build();
    }

    // Admin/Staff lấy cấu hình (để hiển thị QR hoặc Form edit)
    @GetMapping({"/admin/store/settings", "/staff/store/settings"})
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<StoreSettingsDTO> getSettings(
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        Store store = storeRepository.findById(userDetails.getStoreId())
                .orElseThrow(() -> new RuntimeException("Store not found"));

        return ResponseEntity.ok(new StoreSettingsDTO(
                store.getBankId(),
                store.getAccountNo(),
                store.getAccountName(),
                store.getQrTemplate()
        ));
    }
}