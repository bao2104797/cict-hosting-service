# 📦 Hướng Dẫn Components

## 🗂️ Cấu Trúc Thư Mục

```
components/
├── ui/          # UI Components cơ bản (shadcn/ui)
├── common/      # Components dùng chung (user + admin)
├── user/        # Components chỉ dành cho user
└── admin/       # Components chỉ dành cho admin
```

---

## 🎨 `ui/` - UI Components Cơ Bản

**Mục đích**: Các component UI cơ bản từ thư viện shadcn/ui, giống như "nguyên liệu" để xây dựng giao diện.

**Các component:**
- `button.tsx` - Nút bấm
- `card.tsx` - Thẻ/card
- `input.tsx` - Ô nhập liệu
- `badge.tsx` - Nhãn/badge
- `tabs.tsx` - Tab
- `dialog.tsx` - Modal/popup
- `alert.tsx` - Cảnh báo
- `select.tsx` - Dropdown
- `checkbox.tsx` - Checkbox
- `label.tsx` - Nhãn
- `textarea.tsx` - Textarea
- `tooltip.tsx` - Tooltip

**Sử dụng:**
```typescript
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

<Button>Click me</Button>
<Card>Nội dung</Card>
```

**Dùng ở đâu:** TẤT CẢ các trang đều dùng các component này.

---

## 🔄 `common/` - Components Dùng Chung

**Mục đích**: Components có thể dùng ở cả trang user và admin.

### `EmptyState.tsx`
Hiển thị khi không có dữ liệu.

**Sử dụng:**
```typescript
import { EmptyState } from "@/components/common/EmptyState"

<EmptyState
  title="Không có project nào"
  description="Hãy tạo project đầu tiên của bạn"
  actionLabel="Tạo Project"
  onAction={() => navigate("/projects/new")}
/>
```

**Dùng ở:**
- `apps/user/pages/projects/List.tsx` - Khi không có project

---

## 👤 `user/` - Components Dành Cho User

**Mục đích**: Components chỉ dùng cho trang user (không dùng cho admin).

### `Navbar.tsx`
Thanh điều hướng ở đầu trang.

**Dùng ở:**
- `App.tsx` - Luôn hiển thị ở trên cùng

**Chức năng:**
- Logo và tên app
- Link "Projects"
- Nút "Tạo Project"
- Toggle dark mode
- Avatar user

---

### `Stepper.tsx`
Hiển thị tiến trình các bước trong wizard.

**Dùng ở:**
- `apps/user/pages/projects/New/index.tsx` - Wizard tạo project

**Ví dụ:**
```
[✓] Database → [→] Backend → [ ] Frontend → [ ] Tổng quan
```

---

### `HintBox.tsx`
Hộp hướng dẫn ở mỗi bước của wizard.

**Dùng ở:**
- `apps/user/pages/projects/New/StepDatabase.tsx`
- `apps/user/pages/projects/New/StepBackend.tsx`
- `apps/user/pages/projects/New/StepFrontend.tsx`

**Ví dụ:**
```typescript
<HintBox title="Hướng dẫn">
  Khi chọn "Của người dùng", bạn cần nhập IP, Port, Username và Password.
</HintBox>
```

---

## 👨‍💼 `admin/` - Components Dành Cho Admin

**Mục đích**: Components chỉ dùng cho trang admin (hiện tại chưa có).

**Dự kiến:**
- `AdminNavbar.tsx` - Navbar riêng cho admin
- `UserServices.tsx` - Quản lý dịch vụ người dùng
- `SystemSettings.tsx` - Cài đặt hệ thống
- ...

---

## 🔍 Cách Tìm Component Thuộc Trang Nào

### Bước 1: Xác định URL
Ví dụ: `/projects` → Trang danh sách

### Bước 2: Tìm file Page
Mở `apps/user/pages/projects/List.tsx`

### Bước 3: Xem import
```typescript
import { EmptyState } from "@/components/common/EmptyState"
// → EmptyState được dùng trong trang List
```

### Bước 4: Tìm component đó
Mở `components/common/EmptyState.tsx` để xem code

---

## 📝 Quy Tắc Đặt Tên

1. **Component file**: PascalCase (ví dụ: `EmptyState.tsx`)
2. **Export**: Named export (ví dụ: `export function EmptyState()`)
3. **Import**: 
   ```typescript
   import { EmptyState } from "@/components/common/EmptyState"
   ```

---

## 🆕 Thêm Component Mới

### Component UI mới
1. Tạo file trong `components/ui/`
2. Ví dụ: `components/ui/switch.tsx`
3. Import: `import { Switch } from "@/components/ui/switch"`

### Component Common mới
1. Tạo file trong `components/common/`
2. Ví dụ: `components/common/LoadingSpinner.tsx`
3. Export trong `components/common/index.ts`
4. Import: `import { LoadingSpinner } from "@/components/common"`

### Component User mới
1. Tạo file trong `apps/user/components/`
2. Ví dụ: `apps/user/components/ProjectCard.tsx`
3. Export trong `apps/user/components/index.ts`
4. Import: `import { ProjectCard } from "@/apps/user/components"`

---

## 🎯 Best Practices

1. **Tái sử dụng**: Nếu component dùng ở nhiều nơi → đặt trong `common/`
2. **Phân biệt role**: Component chỉ cho user → `user/`, chỉ cho admin → `admin/`
3. **UI base**: Component UI cơ bản → `ui/`
4. **Props rõ ràng**: Định nghĩa interface/type cho props
5. **Comment**: Thêm comment tiếng Việt cho component phức tạp

---

## 📚 Ví Dụ Thực Tế

### Ví dụ 1: Sử dụng Button trong List.tsx

```typescript
// apps/user/pages/projects/List.tsx
import { Button } from "@/components/ui/button"

<Button onClick={() => navigate("/projects/new")}>
  Tạo Project
</Button>
```

### Ví dụ 2: Sử dụng EmptyState trong List.tsx

```typescript
// apps/user/pages/projects/List.tsx
import { EmptyState } from "@/components/common/EmptyState"

{projects.length === 0 && (
  <EmptyState
    title="Chưa có project nào"
    description="Hãy tạo project đầu tiên"
    actionLabel="Tạo Project"
    onAction={() => navigate("/projects/new")}
  />
)}
```

### Ví dụ 3: Sử dụng Stepper trong New/index.tsx

```typescript
// apps/user/pages/projects/New/index.tsx
import { Stepper } from "@/apps/user/components/Stepper"

<Stepper steps={steps} currentStep={currentStep} />
```

---

**Chúc bạn code vui vẻ! 🚀**

