# CICT-Hosting Service

Hệ thống triển khai ứng dụng tự động - Full-stack application với Spring Boot backend và React frontend.

## 📋 Yêu cầu Hệ thống

### Backend (Spring Boot)
- **Java 21** hoặc cao hơn
- **Maven 3.6+** (hoặc sử dụng Maven Wrapper có sẵn: `mvnw`/`mvnw.cmd`)
- **MySQL 8.0+** đã cài đặt và đang chạy
- **Kubernetes** (nếu cần triển khai - tùy chọn)

### Frontend (React)
- **Node.js >= 18**
- **npm**, **yarn**, hoặc **pnpm**

## 🗄️ Cài đặt Database

1. Đảm bảo MySQL đã được cài đặt và đang chạy trên `localhost:3306`

2. Tạo database (tùy chọn - Spring Boot sẽ tự động tạo nếu chưa có):
   ```sql
   CREATE DATABASE IF NOT EXISTS luanvan;
   ```

3. Kiểm tra cấu hình database trong `my-spring-app/src/main/resources/application.yaml`:
   - Host: `127.0.0.1:3306`
   - Database: `luanvan`
   - Username: `root`
   - Password: (để trống - nếu MySQL của bạn có password, hãy cập nhật)

## 🚀 Cách Chạy Project

### ⚠️ Lần Đầu Chạy Dự Án - Các Bước Build/Install

**Quan trọng:** Với máy lần đầu chạy dự án, bạn cần thực hiện các bước sau:

#### **Bước 1: Build/Install Backend (Spring Boot)**

Khi chạy lần đầu, Maven sẽ tự động download dependencies. Tuy nhiên, để đảm bảo mọi thứ được build đúng, bạn nên:

```bash
cd my-spring-app

# Sử dụng Maven Wrapper
.\mvnw.cmd clean install    # Windows
# hoặc
./mvnw clean install        # Linux/Mac

# Hoặc sử dụng Maven đã cài đặt
mvn clean install
```

Lệnh này sẽ:
- Download tất cả dependencies (có thể mất vài phút lần đầu)
- Compile source code
- Chạy tests (nếu có)
- Build JAR file vào thư mục `target/`

**Lưu ý:** Bước này có thể bỏ qua nếu bạn chạy trực tiếp `spring-boot:run` (Maven sẽ tự động làm), nhưng được khuyến nghị để đảm bảo không có lỗi build.

#### **Bước 2: Install Dependencies Frontend (React) - BẮT BUỘC**

```bash
cd my-react-app

# Cài đặt tất cả dependencies (BẮT BUỘC - chỉ cần làm 1 lần đầu)
npm install
# hoặc
yarn install
# hoặc
pnpm install
```

Lệnh này sẽ:
- Download tất cả npm packages vào thư mục `node_modules/`
- Có thể mất vài phút tùy vào tốc độ mạng

**Lưu ý:** Bước này là **BẮT BUỘC**, không thể chạy `npm run dev` nếu chưa chạy `npm install`.

---

### 1. Chạy Backend (Spring Boot) (Lần Sau)

Mở terminal và di chuyển đến thư mục backend:

```bash
cd my-spring-app
```

**Cách 1: Sử dụng Maven Wrapper (Khuyến nghị)**
```bash
# Trên Windows
.\mvnw.cmd spring-boot:run

# Trên Linux/Mac
./mvnw spring-boot:run
```

**Cách 2: Sử dụng Maven đã cài đặt**
```bash
mvn spring-boot:run
```

**Cách 3: Build và chạy JAR file**
```bash
mvn clean package
java -jar target/my-spring-app-0.0.1-SNAPSHOT.jar
```

Backend sẽ chạy tại: **http://localhost:8080**

### 2. Chạy Frontend (React) (Lần Sau)

Sau khi đã cài đặt dependencies (xem phần trên), mỗi lần chạy chỉ cần:

```bash
cd my-react-app
npm run dev    # hoặc yarn dev / pnpm dev
```

**Lưu ý:** Nếu chưa chạy `npm install` lần nào, xem lại phần "Lần Đầu Chạy Dự Án" ở trên.

Frontend sẽ chạy tại: **http://localhost:5173** (hoặc port khác nếu 5173 đã được sử dụng)

---

### 📋 Checklist Lần Đầu Chạy Dự Án

- [ ] MySQL đã được cài đặt và đang chạy
- [ ] Database `luanvan` đã được tạo (hoặc Spring Boot sẽ tự tạo)
- [ ] Đã cập nhật password MySQL trong `application.yaml` (nếu cần)
- [ ] **Backend:** Đã chạy `mvn clean install` (hoặc `.\mvnw.cmd clean install`)
- [ ] **Frontend:** Đã chạy `npm install` (hoặc yarn/pnpm install)
- [ ] Backend đang chạy trên port 8080
- [ ] Frontend đang chạy trên port 5173

## 📝 Lưu Ý Quan Trọng

1. **Thứ tự khởi động:**
   - Chạy **MySQL** trước
   - Sau đó chạy **Backend** (Spring Boot)
   - Cuối cùng chạy **Frontend** (React)

2. **Database:**
   - Spring Boot sử dụng `ddl-auto: update`, nên sẽ tự động tạo/update các bảng khi khởi động
   - Đảm bảo MySQL đang chạy trước khi khởi động backend

3. **Cấu hình:**
   - Nếu MySQL của bạn có password, sửa file `my-spring-app/src/main/resources/application.yaml` dòng 14:
     ```yaml
     password: your_password_here
     ```

4. **CORS:**
   - Backend đã được cấu hình CORS để cho phép frontend kết nối
   - Nếu gặp lỗi CORS, kiểm tra `SecurityConfig.java`

## 🛠️ Công nghệ Sử dụng

### Backend
- Spring Boot 3.5.7
- Java 21
- Spring Data JPA
- Spring Security
- MySQL
- Kubernetes Client (cho deployment)
- WebSocket (cho terminal real-time)
- JSch (cho SSH)

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router DOM
- Zustand (State Management)
- React Hook Form + Zod

## 📁 Cấu trúc Project

```
cict-hosting-service/
├── my-spring-app/          # Spring Boot Backend
│   ├── src/
│   │   └── main/
│   │       ├── java/       # Source code Java
│   │       └── resources/
│   │           └── application.yaml  # Cấu hình
│   └── pom.xml             # Maven dependencies
│
└── my-react-app/           # React Frontend
    ├── src/
    │   ├── apps/           # Admin & User apps
    │   ├── components/     # UI Components
    │   ├── pages/          # Pages
    │   └── lib/            # Utilities & API
    └── package.json        # NPM dependencies
```

## 🔧 Troubleshooting

### Backend không khởi động được:
- Kiểm tra MySQL đã chạy chưa
- Kiểm tra Java version: `java -version` (cần Java 21)
- Kiểm tra port 8080 có đang bị chiếm không

### Frontend không chạy được:
- Xóa `node_modules` và `package-lock.json`, sau đó chạy lại `npm install`
- Kiểm tra Node.js version: `node -v` (cần >= 18)

### Lỗi kết nối database:
- Kiểm tra MySQL đã khởi động
- Kiểm tra username/password trong `application.yaml`
- Kiểm tra database `luanvan` đã tồn tại chưa

## 📚 Tài liệu Tham khảo

- Frontend README: [my-react-app/README.md](./my-react-app/README.md)
- Spring Boot Documentation: https://spring.io/projects/spring-boot

## 📄 License

MIT
