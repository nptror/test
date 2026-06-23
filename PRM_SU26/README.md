# SmartDine - Hệ thống Quản lý và Đặt món thông minh

Hệ thống **SmartDine** bao gồm Backend (Clean Architecture .NET Core), Web Dashboard dành cho Admin/Quản lý (React/Vite) và Ứng dụng Di động dành cho Khách hàng (Flutter).

---

## Cấu trúc Dự án (Project Structure)

```text
PRM_SU26/
├── BE/                           # Backend (ASP.NET Core 10.0 Web API)
│   ├── SmartDine.API             # API Controllers, Hubs (Realtime) & Middlewares
│   ├── SmartDine.Application     # Application Logic, Interfaces & DTOs
│   ├── SmartDine.Domain          # Entities & Domain Models
│   ├── SmartDine.Infrastructure  # Database (EF Core / PostgreSQL) & Security
│   └── SmartDine.slnx            # Solution File
└── FE/                           # Frontend
    ├── web-dashboard             # Admin/Staff Dashboard (React + Vite + Ant Design)
    └── customer-mobile           # Customer Mobile App (Flutter + Riverpod)
```

---

## Yêu cầu Hệ thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:
- [.NET SDK 10.0](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js](https://nodejs.org/) (Khuyên dùng v18+)
- [Flutter SDK](https://docs.flutter.dev/get-started/install) (v3.0.0+)
- [PostgreSQL Database Server](https://www.postgresql.org/)

---

## Hướng dẫn Cài đặt & Khởi chạy (Quick Start Guide)

### 1. Cấu hình Cơ sở dữ liệu (Database Setup)
1. Đảm bảo PostgreSQL Server của bạn đang chạy.
2. Mở file [appsettings.Development.json]và cập nhật thông tin kết nối PostgreSQL tại mục `ConnectionStrings:DefaultConnection` (nếu cần thiết):
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Host=localhost;Port=5432;Database=smartdine;Username=postgres;Password=YOUR_PASSWORD"
   }
   ```
3. Cài đặt công cụ Entity Framework Core C
LI (nếu chưa cài):
   ```bash
   dotnet tool install --global dotnet-ef
   ```
4. Chạy câu lệnh migration để tự động tạo cơ sở dữ liệu và bảng:
   ```bash
   # Di chuyển vào thư mục gốc của project (nơi chứa thư mục BE)
   dotnet ef database update --project BE/SmartDine.Infrastructure --startup-project BE/SmartDine.API
   ```

---

### 2. Khởi chạy Backend (ASP.NET Core Web API)
Chạy API ở chế độ Development:
```bash
cd BE/SmartDine.API
dotnet run
```
*Sau khi chạy, API Swagger và tài liệu API sẽ khả dụng tại địa chỉ (mặc định): `http://localhost:5000/swagger` hoặc `https://localhost:5001/swagger` (hoặc cổng cấu hình trong project).*

---

### 3. Khởi chạy Web Dashboard (FE Admin/Staff)
Ứng dụng quản trị viên hiển thị dữ liệu thời gian thực:
```bash
# Di chuyển tới thư mục web-dashboard
cd FE/web-dashboard

# Cài đặt các thư viện dependencies
npm install

# Khởi chạy dev server
npm run dev
```
*Tru cập ứng dụng tại: `http://localhost:5173` (hoặc cổng được hiển thị trong terminal).*

---

### 4. Khởi chạy Mobile App (FE Customer App)
Ứng dụng di động Flutter dành cho khách hàng đặt món:
```bash
# Di chuyển tới thư mục customer-mobile
cd FE/customer-mobile

# Tải các gói thư viện Flutter
flutter pub get

# Tạo các code generator cho Hive (nếu cần thiết)
flutter pub run build_runner build --delete-conflicting-outputs

# Khởi chạy ứng dụng (trên máy ảo hoặc thiết bị thật)
flutter run
```

---

## Thông tin Bảo mật & Môi trường
- **JWT Authentication**: Cấu hình khóa bí mật tại `Jwt:SecretKey` trong [appsettings.json](file:///e:/FPTUer/Sen8/PRM393/WEB/PRM_SU26/BE/SmartDine.API/appsettings.json). Vui lòng đổi khóa này khi triển khai thực tế (Production).
