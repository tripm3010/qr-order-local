package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import qrorder.system.dto.request.StoreCreateRequest;
import qrorder.system.dto.response.StoreResponse;
import qrorder.system.service.StoreService;

import java.util.List;

@RestController
@RequestMapping("/api/super-admin")
// Chỉ cho phép Role SUPER_ADMIN (Bạn sẽ cần update DataInitializer để tạo user này)
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminController {

    @Autowired
    private StoreService storeService;

    @GetMapping("/stores")
    public ResponseEntity<List<StoreResponse>> getAllStores() {
        return ResponseEntity.ok(storeService.getAllStores());
    }

    @PostMapping("/stores")
    public ResponseEntity<StoreResponse> createStore(@RequestBody StoreCreateRequest request) {
        StoreResponse response = storeService.createTenant(request);
        return ResponseEntity.ok(response);
    }
}