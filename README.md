THAT Clinic — Web đặt khám tại nhà (Mô tả ngắn)

Mã nguồn này là một ứng dụng web cho dịch vụ khám bác sĩ tại nhà. Ứng dụng gồm frontend tĩnh (HTML/CSS/Vanilla JS) và backend Node.js (Express) cùng MySQL làm cơ sở dữ liệu. Hệ thống hỗ trợ luồng đặt lịch, thanh toán mô phỏng (VNPAY sandbox), quản lý bác sĩ và quản trị.

## Công nghệ chính

- Frontend: HTML, CSS, Vanilla JavaScript (thư mục user/, doctor/, admin/, guest/, assets/).
- Backend: Node.js + Express (backend/server.js, backend/package.json).
- Database: MySQL (schema: schema.sql), driver Node: mysql2 (xem backend/db.js).
- Cấu hình: dotenv + .env / .env.example (PORT, MYSQL_*, VNPAY_*).
- Thanh toán: VNPAY mô phỏng (endpoints POST /api/payment/vnpay/create, GET /api/payment/vnpay/simulate, GET /api/payment/vnpay/return).

## Quick start (local)

1. Cài dependencies cho backend:

   cd backend
   npm install

2. Thiết lập biến môi trường: copy .env.example → .env và điền thông số (MySQL, VNPAY). Nếu chỉ muốn chạy mà không có MySQL, set MYSQL_DISABLED=true.

3. Khởi động server:

   node server.js
   # or
   npm start

4. Mở trình duyệt: http://localhost:3000 và duyệt các trang tĩnh (ví dụ user/doctors.html).

## Database

- Tập lệnh tạo schema: schema.sql (các bảng users, doctors, appointments, payments, refunds, ...).
- Nếu MYSQL_DISABLED=false, backend sẽ tạo/kiểm tra một số bảng khi khởi động (xem backend/db.js).

## Thanh toán (VNPAY sandbox)

- Ứng dụng cung cấp mô phỏng cổng VNPAY để test luồng thanh toán mà không phát sinh giao dịch thật.
- Quy trình: frontend gọi POST /api/payment/vnpay/create → backend trả redirectUrl/transactionId → mở trang mô phỏng (/api/payment/vnpay/simulate) → chọn thành công/thất bại → backend xử lý callback và cập nhật bảng payments + trạng thái appointments.
- Thông tin merchant/secret cấu hình trong .env (VNPAY_TMN_CODE, VNPAY_HASH_SECRET).

## Tài liệu API

- Có mô tả OpenAPI tạm thời tại backend/openapi.js (dùng để tham khảo endpoint chính và request/response mẫu).

## Ghi chú

- Frontend tĩnh có thể chạy ở chế độ giới hạn khi backend bị tắt, nhưng nhiều chức năng (đăng nhập, tạo lịch, thanh toán) yêu cầu API hoạt động.
- Thiết kế hướng tới dễ chuyển sang tích hợp cổng thanh toán thật: thay lớp mô phỏng bằng client VNPAY/verification thực.

---
