package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import qrorder.system.config.security.StoreUserDetails;
import qrorder.system.dto.request.CreateCategoryRequest;
import qrorder.system.dto.request.MenuItemRequest;
import qrorder.system.dto.response.CategoryResponse;
import qrorder.system.dto.response.MenuItemResponse;
import qrorder.system.service.MenuService;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')") // Chỉ ADMIN mới được truy cập controller này
public class MenuManagementController {

    @Autowired
    private MenuService menuService;

    // Lấy storeId từ JWT (thông qua StoreUserDetails)
    private Long getStoreId(StoreUserDetails userDetails) {
        return userDetails.getStoreId();
    }

    // === CATEGORY ENDPOINTS ===

    @PostMapping("/categories")
    public ResponseEntity<CategoryResponse> createCategory(
            @RequestBody CreateCategoryRequest request,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        CategoryResponse category = menuService.createCategory(request, getStoreId(userDetails));
        return ResponseEntity.ok(category);
    }

    @GetMapping("/categories")
    public ResponseEntity<List<CategoryResponse>> getCategories(
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        List<CategoryResponse> categories = menuService.getCategoriesByStore(getStoreId(userDetails));
        return ResponseEntity.ok(categories);
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<CategoryResponse> updateCategory(
            @PathVariable Long id,
            @RequestBody CreateCategoryRequest request,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        CategoryResponse category = menuService.updateCategory(id, request, getStoreId(userDetails));
        return ResponseEntity.ok(category);
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(
            @PathVariable Long id,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        menuService.deleteCategory(id, getStoreId(userDetails));
        return ResponseEntity.noContent().build();
    }

    // === MENU ITEM ENDPOINTS ===

    @PostMapping("/menu-items")
    public ResponseEntity<MenuItemResponse> createMenuItem(
            @RequestBody MenuItemRequest request,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        MenuItemResponse item = menuService.createMenuItem(request, getStoreId(userDetails));
        return ResponseEntity.ok(item);
    }

    @GetMapping("/menu-items")
    public ResponseEntity<List<MenuItemResponse>> getMenuItems(
            @AuthenticationPrincipal StoreUserDetails userDetails,
            @RequestParam(required = false) Long categoryId) { // Cho phép lọc theo category

        List<MenuItemResponse> items;
        if (categoryId != null) {
            items = menuService.getMenuItemsByCategory(categoryId, getStoreId(userDetails));
        } else {
            items = menuService.getMenuItemsByStore(getStoreId(userDetails));
        }
        return ResponseEntity.ok(items);
    }

    @PutMapping("/menu-items/{id}")
    public ResponseEntity<MenuItemResponse> updateMenuItem(
            @PathVariable Long id,
            @RequestBody MenuItemRequest request,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        MenuItemResponse item = menuService.updateMenuItem(id, request, getStoreId(userDetails));
        return ResponseEntity.ok(item);
    }

    @DeleteMapping("/menu-items/{id}")
    public ResponseEntity<Void> deleteMenuItem(
            @PathVariable Long id,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        menuService.deleteMenuItem(id, getStoreId(userDetails));
        return ResponseEntity.noContent().build();
    }
    /**
     * [MỚI] API để bật/tắt trạng thái "Hết hàng"
     * PUT /api/admin/menu-items/{id}/toggle-stock
     */
    @PutMapping("/menu-items/{id}/toggle-stock")
    public ResponseEntity<MenuItemResponse> toggleMenuItemStock(
            @PathVariable Long id,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        MenuItemResponse item = menuService.toggleMenuItemStock(id, getStoreId(userDetails));
        return ResponseEntity.ok(item);
    }
}