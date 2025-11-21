package qrorder.system.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import qrorder.system.dto.request.CreateCategoryRequest;
import qrorder.system.dto.request.MenuItemRequest;
import qrorder.system.dto.response.CategoryResponse;
import qrorder.system.dto.response.MenuItemResponse;
import qrorder.system.entity.Category;
import qrorder.system.entity.MenuItem;
import qrorder.system.entity.Store;
import qrorder.system.repository.CategoryRepository;
import qrorder.system.repository.MenuItemRepository;
import qrorder.system.repository.StoreRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class MenuService {

    @Autowired
    private MenuItemRepository menuItemRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private StoreRepository storeRepository;

    // === CATEGORY (Giữ nguyên) ===

    public CategoryResponse createCategory(CreateCategoryRequest request, Long storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy chi nhánh"));

        Category category = new Category();
        category.setName(request.name());
        category.setStore(store);

        Category savedCategory = categoryRepository.save(category);
        return new CategoryResponse(savedCategory.getId(), savedCategory.getName(), savedCategory.getStore().getId());
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getCategoriesByStore(Long storeId) {
        return categoryRepository.findAllByStoreId(storeId).stream()
                .map(cat -> new CategoryResponse(cat.getId(), cat.getName(), cat.getStore().getId()))
                .collect(Collectors.toList());
    }

    public CategoryResponse updateCategory(Long categoryId, CreateCategoryRequest request, Long storeId) {
        Category category = categoryRepository.findByIdAndStoreId(categoryId, storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy danh mục hoặc bạn không có quyền"));

        category.setName(request.name());
        Category updatedCategory = categoryRepository.save(category);
        return new CategoryResponse(updatedCategory.getId(), updatedCategory.getName(), updatedCategory.getStore().getId());
    }

    public void deleteCategory(Long categoryId, Long storeId) {
        Category category = categoryRepository.findByIdAndStoreId(categoryId, storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy danh mục hoặc bạn không có quyền"));
        categoryRepository.delete(category);
    }

    // === MENU ITEM (CẬP NHẬT XÓA MỀM) ===

    public MenuItemResponse createMenuItem(MenuItemRequest request, Long storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy chi nhánh"));

        Category category = categoryRepository.findByIdAndStoreId(request.categoryId(), storeId)
                .orElseThrow(() -> new AccessDeniedException("Danh mục không hợp lệ"));

        MenuItem item = new MenuItem();
        item.setName(request.name());
        item.setDescription(request.description());
        item.setPrice(request.price());
        item.setImageUrl(request.imageUrl());
        item.setCategory(category);
        item.setStore(store);
        item.setOutOfStock(request.isOutOfStock() != null && request.isOutOfStock());
        item.setDeleted(false); // [QUAN TRỌNG] Mặc định chưa xóa

        MenuItem savedItem = menuItemRepository.save(item);
        return toMenuItemResponse(savedItem);
    }

    @Transactional(readOnly = true)
    public List<MenuItemResponse> getMenuItemsByStore(Long storeId) {
        // [CẬP NHẬT] Chỉ lấy món có deleted = false
        return menuItemRepository.findAllByStoreIdAndDeletedFalse(storeId).stream()
                .map(this::toMenuItemResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MenuItemResponse> getMenuItemsByCategory(Long categoryId, Long storeId) {
        if (!categoryRepository.existsByIdAndStoreId(categoryId, storeId)) {
            throw new AccessDeniedException("Danh mục không hợp lệ");
        }

        // [CẬP NHẬT] Chỉ lấy món có deleted = false
        return menuItemRepository.findAllByCategoryIdAndStoreIdAndDeletedFalse(categoryId, storeId).stream()
                .map(this::toMenuItemResponse)
                .collect(Collectors.toList());
    }

    public MenuItemResponse updateMenuItem(Long itemId, MenuItemRequest request, Long storeId) {
        MenuItem item = menuItemRepository.findByIdAndStoreId(itemId, storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy món ăn"));

        Category category = categoryRepository.findByIdAndStoreId(request.categoryId(), storeId)
                .orElseThrow(() -> new AccessDeniedException("Danh mục không hợp lệ"));

        item.setName(request.name());
        item.setDescription(request.description());
        item.setPrice(request.price());
        item.setImageUrl(request.imageUrl());
        item.setCategory(category);
        item.setOutOfStock(request.isOutOfStock() != null && request.isOutOfStock());

        MenuItem updatedItem = menuItemRepository.save(item);
        return toMenuItemResponse(updatedItem);
    }

    /**
     * [CẬP NHẬT QUAN TRỌNG] Xóa Mềm Món ăn
     * Thay vì delete(), ta setDeleted(true) để giữ lại lịch sử đơn hàng
     */
    public void deleteMenuItem(Long itemId, Long storeId) {
        MenuItem item = menuItemRepository.findByIdAndStoreId(itemId, storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy món ăn"));

        // Xóa mềm: Đánh dấu là đã xóa
        item.setDeleted(true);
        menuItemRepository.save(item);
    }

    @Transactional
    public MenuItemResponse toggleMenuItemStock(Long itemId, Long storeId) {
        MenuItem item = menuItemRepository.findByIdAndStoreId(itemId, storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy món ăn hoặc bạn không có quyền"));

        item.setOutOfStock(!item.isOutOfStock());
        MenuItem updatedItem = menuItemRepository.save(item);

        return toMenuItemResponse(updatedItem);
    }

    private MenuItemResponse toMenuItemResponse(MenuItem item) {
        return new MenuItemResponse(
                item.getId(),
                item.getName(),
                item.getDescription(),
                item.getPrice(),
                item.getImageUrl(),
                item.getCategory().getId(),
                item.getCategory().getName(),
                item.getStore().getId(),
                item.isOutOfStock()
        );
    }
}