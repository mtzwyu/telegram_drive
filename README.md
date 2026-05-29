# 🚀 Telegram Drive — Hệ Thống Lưu Trữ Đám Mây Cá Nhân Không Giới Hạn

**Telegram Drive** là một giải pháp lưu trữ đám mây cá nhân (Personal Cloud Storage) mã nguồn mở, cho phép biến tài khoản Telegram của bạn thành một kho lưu trữ dữ liệu không giới hạn dung lượng hoàn toàn miễn phí. Hệ thống kết nối trực tiếp đến máy chủ Telegram thông qua giao thức MTProto bảo mật để lưu trữ file trực tiếp trong mục **Saved Messages (Tin nhắn đã lưu)** của bạn.

---

## ✨ Tính Năng Nổi Bật

### 🔒 Bảo Mật & Xác Thực
*   **Đăng nhập không cần mật khẩu**: Hỗ trợ đăng nhập cực kỳ tiện lợi bằng cách quét **QR Code** hoặc nhận mã **OTP** gửi trực tiếp từ hệ thống Telegram.
*   **Hỗ trợ bảo mật 2 lớp (2FA)**: Đảm bảo tài khoản an toàn tuyệt đối khi đăng nhập.
*   **Mã hóa dữ liệu**: Tự động mã hóa tệp tin dưới dạng buffer nhị phân trước khi tải lên máy chủ Telegram để đảm bảo tính riêng tư của tệp tin.
*   **Không lưu thông tin đăng nhập**: Phiên hoạt động được lưu an toàn dưới dạng chuỗi Token mã hóa (`StringSession`) trên server cá nhân của bạn, không chia sẻ với bất kỳ bên thứ ba nào.

### 📁 Quản Lý Tệp Tin Trực Quan
*   **Lưu trữ không giới hạn**: Tận dụng hạ tầng đám mây miễn phí của Telegram để lưu trữ số lượng tệp tin và dung lượng không giới hạn.
*   **Tải lên hàng loạt**: Hỗ trợ chọn và upload nhiều tệp tin cùng một lúc với thanh tiến trình trực quan.
*   **Quản lý thông minh**: Xem danh sách tệp tin dạng lưới (Grid) hoặc danh sách (List), tìm kiếm nhanh theo tên file và xóa hàng loạt tệp tin đã chọn.
*   **Chế độ Sáng/Tối tự động**: Giao diện được thiết kế hiện đại, sang trọng theo phong cách tối giản, tự động chuyển đổi theme Sáng/Tối theo múi giờ Việt Nam hoặc tùy chỉnh thủ công.

---

## 🏗️ Kiến Trúc Hệ Thống

Dự án được xây dựng theo mô hình Monorepo chia làm 3 thành phần chính:

1.  **Frontend (React + Vite)**:
    *   Sử dụng **React** kết hợp **Tailwind CSS v4** cho hiệu năng cao và giao diện mượt mà.
    *   Kết nối với Backend thông qua Reverse Proxy cấu hình trên Vercel để tránh lỗi CORS.
2.  **Backend (Node.js + Express + GramJS)**:
    *   Sử dụng thư viện **GramJS** để giao tiếp trực tiếp với Telegram qua giao thức MTProto API.
    *   Hỗ trợ xử lý tải lên (upload) và tải xuống (download) trực tiếp, mã hóa/giải mã file nhị phân on-the-fly.
3.  **Database (Supabase)**:
    *   Lưu trữ metadata của file (tên file, kích thước, định dạng, ID tin nhắn Telegram) giúp truy xuất danh sách file cực nhanh mà không cần quét lại toàn bộ tin nhắn Telegram.

---

## 🚀 Hướng Dẫn Triển Khai & Cài Đặt Nhanh

Hệ thống được thiết kế để dễ dàng triển khai lên các nền tảng đám mây miễn phí:

*   **Database**: Khởi tạo trên **Supabase** (chạy script tạo bảng lưu trữ metadata).
*   **Backend**: Deploy Docker container lên **Render.com** (hoặc Railway).
*   **Frontend**: Deploy lên **Vercel** (cấu hình Reverse Proxy `/api/*` về Render).

> [!TIP]
> Để xem hướng dẫn từng bước chi tiết (kèm cấu hình các biến môi trường cần thiết), vui lòng tham khảo tài liệu:
> 👉 **[Hướng Dẫn Triển Khai Chi Tiết (walkthrough.md)](file:///C:/Users/xpaga/.gemini/antigravity/brain/bfd7febf-52b4-4be4-8af3-9d7066c81d7b/walkthrough.md)**

---

## 🗺️ Hướng Phát Triển Tương Lai (Roadmap)

Dự án định hướng phát triển thành một hệ thống lưu trữ cá nhân chuyên nghiệp với các tính năng dự kiến sau:

*   [ ] **Mã hóa đầu cuối (E2EE) phía Client**: 
    *   Tích hợp thuật toán mã hóa (như AES-GCM) trực tiếp trên trình duyệt của người dùng trước khi gửi đến Backend. Đảm bảo Backend và máy chủ Telegram đều không thể đọc được nội dung tệp tin nếu không có chìa khóa riêng của bạn.
*   [ ] **Trình Phát Đa Phương Tiện Trực Tuyến (Streaming/Web Player)**:
    *   Hỗ trợ phát trực tiếp (Stream) các tệp tin video/audio lưu trên Telegram ngay trên trình duyệt mà không cần tải toàn bộ tệp tin về máy (sử dụng chunk streaming).
*   [ ] **Quản Lý Cấu Trúc Thư Mục Thông Minh**:
    *   Cho phép người dùng tạo các thư mục con lồng nhau vô hạn cấp.
    *   Hỗ trợ kéo và thả (Drag & Drop) để di chuyển tệp tin giữa các thư mục.
    *   Gắn nhãn phân loại (Tags/Labels) bằng màu sắc để tìm kiếm nhanh chóng.
*   [ ] **Ứng Dụng Đồng Bộ Hóa Tự Động (Auto-Sync Client)**:
    *   Phát triển ứng dụng nhỏ chạy ngầm trên Máy tính (Windows/macOS) tự động đồng bộ hóa các tệp tin từ một thư mục chỉ định lên Telegram Drive của bạn giống như Google Drive Desktop.

---

## 🤝 Đóng Góp Ý Kiến & Phát Triển
Mọi đóng góp, báo lỗi (issues) hoặc yêu cầu tính năng mới đều được chào đón. Hãy fork repository này và tạo Pull Request nếu bạn có những cải tiến hữu ích cho dự án!
