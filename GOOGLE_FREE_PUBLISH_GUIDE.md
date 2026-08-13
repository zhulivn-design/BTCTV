# HƯỚNG DẪN XUẤT BẢN WEBSITE LÊN GOOGLE CLOUD / FIREBASE MIỄN PHÍ

Ứng dụng **BTC Digital Signage** của bạn có thể được xuất bản trực tuyến hoàn toàn miễn phí bằng các dịch vụ đám mây của Google dưới đây. Các dịch vụ này cung cấp hạ tầng cực mạnh, bảo mật SSL tự động, và hoàn toàn miễn phí (Free Tier) cho nhu cầu sử dụng vừa và nhỏ.

---

## 🛠️ Bước Chuẩn Bị: Xuất Mã Nguồn từ AI Studio
Để xuất bản ứng dụng lên tài khoản cá nhân của bạn, trước hết bạn cần tải mã nguồn về máy tính:
1. Tại giao diện **AI Studio**, bấm vào biểu tượng bánh răng **Settings** ở góc dưới cùng bên trái.
2. Tìm mục **Export** và chọn **Download ZIP** để tải toàn bộ mã nguồn của dự án này về máy.
3. Giải nén thư mục dự án trên máy tính của bạn.

---

## 📡 PHƯƠNG PHÁP 1: Sử dụng Google Firebase Hosting (Khuyên Dùng - Đơn giản nhất)
**Firebase** (thuộc sở hữu của Google) cung cấp dịch vụ Hosting tĩnh cực kỳ chất lượng, bảo mật SSL (https) miễn phí, băng thông rộng, hỗ trợ gắn tên miền riêng miễn phí.

### 🎁 Chính sách Miễn phí (Free Tier):
- Dung lượng lưu trữ: **10 GB** (Thoải mái lưu trữ hàng ngàn slide, ảnh).
- Băng thông truyền tải: **10 GB / tháng** (Đủ cho hàng chục Smart TV trình chiếu liên tục).
- Tên miền phụ dạng `ten-cua-ban.web.app` hoặc `ten-cua-ban.firebaseapp.com` miễn phí.

### 🚀 Các bước triển khai chi tiết:

1. **Tạo tài khoản & dự án Firebase**:
   - Truy cập trang [Firebase Console](https://console.firebase.google.com/) bằng tài khoản Gmail của bạn.
   - Bấm **Add Project** -> Đặt tên cho dự án (ví dụ: `btc-digital-signage`) -> Nhấn **Continue** -> Bật/Tắt Google Analytics tùy ý -> Bấm **Create project**.

2. **Cài đặt Firebase CLI trên máy tính của bạn**:
   - Mở terminal / command prompt trên máy tính và cài đặt Node.js nếu chưa có.
   - Chạy lệnh cài đặt công cụ Firebase:
     ```bash
     npm install -g firebase-tools
     ```
   - Đăng nhập vào tài khoản Google của bạn bằng lệnh:
     ```bash
     firebase login
     ```

3. **Khởi tạo và liên kết dự án trên máy tính**:
   - Di chuyển vào thư mục code đã giải nén:
     ```bash
     cd du-an-cua-ban
     ```
   - Khởi chạy cấu hình Firebase:
     ```bash
     firebase init hosting
     ```
   - Chọn **Use an existing project** -> Chọn tên dự án bạn vừa tạo trên Firebase Console.
   - Trả lời các câu hỏi cấu hình:
     - *What do you want to use as your public directory?* Nhập: `dist` (Đây là thư mục chứa mã nguồn đã biên dịch của React).
     - *Configure as a single-page app (rewrite all urls to /index.html)?* Chọn: `Yes` (Rất quan trọng đối với ứng dụng React Router).
     - *Set up automatic builds and deploys with GitHub?* Chọn: `No` (Có thể thiết lập sau nếu muốn).
     - *File dist/index.html already exists. Overwrite?* Chọn: `No` (Không ghi đè lên file index.html hiện tại).

4. **Biên dịch và Xuất bản**:
   - Chạy lệnh build ứng dụng React:
     ```bash
     npm run build
     ```
   - Tiến hành tải trang web lên máy chủ Google Firebase:
     ```bash
     firebase deploy
     ```
   - **Thành công!** Terminal sẽ hiển thị đường dẫn dạng: `Hosting URL: https://btc-digital-signage.web.app`. Bạn chỉ cần copy link này cấu hình cho Smart TV của bạn là xong!

---

## ☁️ PHƯƠNG PHÁP 2: Sử dụng Google Cloud Run (Dành cho Full-stack có máy chủ Node.js)
Nếu ứng dụng của bạn cần chạy một máy chủ Express ở backend (ví dụ proxy ảnh từ nguồn thứ ba không bị chặn CORS, quản lý dữ liệu lưu trữ phía server nâng cao), **Google Cloud Run** là lựa chọn tuyệt vời nhất.

### 🎁 Chính sách Miễn phí (Google Cloud Free Tier):
- **2 triệu lượt yêu cầu (requests)** hoàn toàn miễn phí mỗi tháng.
- **360.000 vCPU-giây** và **180.000 GiB-giây** bộ nhớ RAM miễn phí mỗi tháng.
- Hỗ trợ tự động thu nhỏ về 0 (Scale to Zero) khi không có màn hình nào truy cập để tiết kiệm tài nguyên tuyệt đối.

### 🚀 Các bước triển khai chi tiết:

1. **Tạo tài khoản Google Cloud**:
   - Truy cập [Google Cloud Console](https://console.cloud.google.com/) và kích hoạt tài khoản bằng Gmail của bạn (Google tặng $300 dùng thử ban đầu).

2. **Cài đặt Google Cloud SDK**:
   - Tải và cài đặt công cụ [gcloud CLI](https://cloud.google.com/sdk/docs/install) trên máy tính.
   - Đăng nhập bằng lệnh:
     ```bash
     gcloud auth login
     ```

3. **Biên dịch và đưa lên Cloud Run bằng 1 câu lệnh**:
   - Chỉ cần chạy lệnh duy nhất dưới đây tại thư mục mã nguồn:
     ```bash
     gcloud run deploy btc-signage-app --source . --region asia-east1 --allow-unauthenticated
     ```
     *(Lưu ý: Thay thế vùng `asia-east1` bằng khu vực máy chủ gần Việt Nam nhất để đạt tốc độ tải trang nhanh nhất).*
   - Quá trình này sẽ tự động đóng gói ứng dụng Node.js của bạn thành Container (Docker), lưu trữ an toàn trên Google Artifact Registry và khởi chạy trên Cloud Run.
   - Sau khi hoàn tất (khoảng 2-3 phút), Google sẽ cung cấp cho bạn một URL tuyệt đối bảo mật dạng: `https://btc-signage-app-xxxxxx.a.run.app`.

---

## 🎯 So Sánh & Lời Khuyên:
| Tiêu chí | Firebase Hosting 🟢 | Google Cloud Run 🔵 |
| :--- | :--- | :--- |
| **Độ phức tạp** | Rất dễ, phù hợp cho người mới bắt đầu | Trung bình, cần tạo tài khoản Google Cloud |
| **Bảo mật** | Cực cao, hạ tầng phân phối CDN toàn cầu | Rất tốt, chạy cô lập trong môi trường container |
| **Chi phí** | 100% miễn phí trọn đời (trong giới hạn) | 100% miễn phí trọn đời dưới 2 triệu lượt truy cập/tháng |
| **Khuyên dùng** | **Tốt nhất cho BTC Signage chạy offline hoặc lấy slide tự động.** | **Tốt nhất khi bạn muốn tự triển khai máy chủ cơ sở dữ liệu riêng.** |
