# Hệ thống Triển khai Ứng dụng Tự động - CICT-Hosting

Ứng dụng React hiện đại để người dùng tự khai báo và triển khai dự án đa thành phần (database, backend, frontend) tương tự Vercel.

## 📚 Tài Liệu Hướng Dẫn

**👉 Cho người mới bắt đầu React:**
- **[HUONG_DAN_CAU_TRUC.md](./HUONG_DAN_CAU_TRUC.md)** - Hướng dẫn chi tiết về cấu trúc dự án, cách các phần kết nối với nhau, và cách tìm component thuộc trang nào.

**👉 Hướng dẫn Components:**
- **[src/components/README.md](./src/components/README.md)** - Giải thích cấu trúc components và cách sử dụng.

## 🚀 Hướng dẫn Chạy

### Yêu cầu
- Node.js >= 18
- pnpm (hoặc npm/yarn)

### Cài đặt và Chạy

```bash
# Cài đặt dependencies
pnpm install

# Chạy development server
pnpm dev
```

Ứng dụng sẽ chạy tại `http://localhost:5173` (hoặc port khác nếu 5173 đã được sử dụng).

## 📁 Cấu trúc Dự án

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── tabs.tsx
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   ├── Stepper.tsx      # Component stepper cho wizard
│   ├── HintBox.tsx      # Hộp hướng dẫn
│   ├── EmptyState.tsx   # Trạng thái trống
│   └── Navbar.tsx       # Thanh điều hướng
├── pages/
│   └── projects/
│       ├── List.tsx     # Danh sách projects
│       ├── Detail.tsx   # Chi tiết project
│       └── New/
│           ├── index.tsx
│           ├── StepDatabase.tsx
│           ├── StepBackend.tsx
│           ├── StepFrontend.tsx
│           └── StepSummary.tsx
├── stores/
│   └── wizard-store.ts  # Zustand store cho wizard
├── lib/
│   ├── utils.ts         # Utility functions
│   ├── mock-api.ts      # Mock API service
│   └── validators.ts    # Validators
├── types/
│   └── index.ts         # TypeScript types
├── App.tsx              # Component chính
└── main.tsx             # Entry point
```

## 🎨 Tính năng

### 1. Trang Danh sách Projects (`/projects`)
- Hiển thị danh sách projects dạng card grid
- Tìm kiếm theo tên và mô tả
- Lọc theo trạng thái (running, deploying, error, paused)
- Sắp xếp theo tên hoặc thời gian cập nhật
- Nút "Tạo Project" nổi bật

### 2. Trang Chi tiết Project (`/projects/:id`)
- Header: Tên, mô tả, trạng thái, các DNS/endpoints chính
- 5 tabs: **Tổng quan**, **Database**, **Backend**, **Frontend**, **Lịch sử triển khai**
- Mỗi thành phần hiển thị: trạng thái, DNS/Endpoint, version/tag, thời gian cập nhật
- Nút "Xem log" (mở modal) và "Redeploy" (mock)
- Copy DNS vào clipboard

### 3. Trang Tạo Project (`/projects/new`) - Wizard 4 bước

#### Bước 1: Database
- Chọn loại: MySQL hoặc MongoDB
- Chọn nguồn: "Của người dùng" (IP/Port/User/Pass) hoặc "Của hệ thống"
- Upload file ZIP dữ liệu (tùy chọn)
- Có thể thêm nhiều database
- Hộp hướng dẫn với ví dụ cấu trúc file

#### Bước 2: Backend
- Chọn technology: Spring Boot hoặc Node.js
- Nguồn mã nguồn: Upload ZIP hoặc Docker Image
- DNS (tùy chọn)
- Biến môi trường (key-value, có thể thêm/xóa)
- Build command và output directory (preset tự động)
- Hộp hướng dẫn với quy định .zip và ví dụ

#### Bước 3: Frontend
- Chọn technology: React, Vue, hoặc Angular
- Nguồn mã nguồn: Upload ZIP hoặc Docker Image
- Config build: build command, output dir (preset tự động)
- Runtime ENV: key-value (ví dụ VITE_API_BASE_URL)
- DNS/URL (tùy chọn)
- Hộp hướng dẫn với ví dụ

#### Bước 4: Tổng quan
- Hiển thị lại toàn bộ cấu hình đã nhập
- Nhập tên project và mô tả
- Checkbox xác nhận điều khoản (mock)
- Nút "Xác nhận triển khai" (gọi API mock, hiển thị toast, điều hướng)

### Tính năng khác
- **Auto-save draft**: Tự động lưu vào localStorage khi điền form
- **Dark mode**: Toggle dark/light mode
- **Animation**: Framer Motion cho transitions mượt mà
- **Responsive**: Mobile-first, tốt trên 1280px+
- **Toast notifications**: Sonner cho thông báo
- **Validation**: React Hook Form + Zod cho form validation

## 🛠️ Công nghệ Sử dụng

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **React Router DOM** - Routing
- **Zustand** - State management
- **React Hook Form + Zod** - Form validation
- **Framer Motion** - Animations
- **Lucide React** - Icons
- **Sonner** - Toast notifications

## 📊 Demo Data

Hệ thống có sẵn 3 project mẫu:
1. **E-Commerce Platform** - Đầy đủ DB/BE/FE, status: running
2. **Blog CMS** - Đầy đủ DB/BE/FE, status: deploying
3. **Portfolio Website** - Chỉ có Frontend, status: paused

## 🎯 Routing

- `/` hoặc `/projects` - Trang danh sách projects
- `/projects/:id` - Trang chi tiết project
- `/projects/new` - Trang tạo project mới (wizard)

## 📝 Validation

- **DNS**: Chỉ a-z, 0-9, '-', dài 3-63 ký tự, không bắt đầu/kết thúc bằng '-'
- **Docker Image**: Format `repo/name:tag` (ví dụ: docker.io/user/app:1.0.0)
- **ZIP File**: Chỉ nhận file .zip, tối đa 100 MB
- **IP Address**: Validate định dạng IP
- **Port**: Số từ 1 đến 65535

## 🌙 Dark Mode

Click vào icon Moon/Sun ở navbar để toggle dark mode. Preference được lưu vào localStorage.

## 📄 Ghi chú

- Tất cả API đều được mock, không cần backend thật
- Validation được thực hiện client-side
- File upload ZIP chỉ kiểm tra đuôi file (UI, chưa upload thật)
- Dữ liệu được lưu tạm trong localStorage
- Code có comment tiếng Việt ở các chỗ quan trọng

## 🔧 Development

```bash
# Lint code
pnpm lint

# Build production
pnpm build

# Preview production build
pnpm preview
```

## 📄 License

MIT
