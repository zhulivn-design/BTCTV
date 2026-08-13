# HƯỚNG DẪN CHI TIẾT: ĐĂNG TẢI ỨNG DỤNG LÊN GOOGLE FIREBASE HOSTING (MIỄN PHÍ)

Tài liệu này hướng dẫn từng bước cực kỳ chi tiết, dễ hiểu để bạn đưa ứng dụng **BTC Digital Signage** lên nền tảng đám mây **Google Firebase Hosting** hoàn toàn miễn phí, có chứng chỉ bảo mật SSL (https://) tự động và hỗ trợ tên miền riêng.

---

## 📋 BƯỚC 1: TẢI MÃ NGUỒN VỀ MÁY TÍNH
1. Trên giao diện thiết kế **AI Studio** này, bạn nhìn xuống góc dưới cùng bên trái sẽ thấy biểu tượng hình bánh răng ⚙️ (**Settings**).
2. Bấm vào **Settings** -> tìm đến phần **Export** ở phía dưới.
3. Chọn **Download ZIP** để tải toàn bộ mã nguồn ứng dụng về máy tính của bạn.
4. Sau khi tải xong, hãy giải nén file ZIP đó vào một thư mục trên máy tính (ví dụ: đặt tên thư mục là `btc-digital-signage`).

---

## 🛠️ BƯỚC 2: CÀI ĐẶT CÔNG CỤ CẦN THIẾT TRÊN MÁY TÍNH

Để đưa ứng dụng lên máy chủ Google, máy tính của bạn cần cài đặt **Node.js** và công cụ **Firebase CLI**.

### 1. Cài đặt Node.js:
- Truy cập trang chủ [nodejs.org](https://nodejs.org/) và tải phiên bản khuyến nghị **LTS** dành cho hệ điều hành của bạn (Windows hoặc macOS).
- Cài đặt file vừa tải xuống giống như các phần mềm thông thường khác (nhấn Next liên tục cho đến khi hoàn tất).

### 2. Cài đặt Firebase CLI (Giao diện dòng lệnh của Firebase):
- Mở chương trình **Terminal** (trên macOS/Linux) hoặc **Command Prompt / PowerShell** (trên Windows).
- Copy câu lệnh dưới đây, dán vào và nhấn Enter để cài đặt bộ công cụ của Google:
  ```bash
  npm install -g firebase-tools
  ```
- Sau khi chạy xong, hãy kiểm tra xem cài đặt đã thành công chưa bằng lệnh:
  ```bash
  firebase --version
  ```
  *(Nếu hiện ra một số phiên bản ví dụ `13.x.x` là bạn đã cài đặt thành công).*

---

## 🌐 BƯỚC 3: TẠO DỰ ÁN TRÊN TRANG CHỦ FIREBASE

1. Truy cập vào trang quản lý của Google: [Firebase Console](https://console.firebase.google.com/) và đăng nhập bằng tài khoản Gmail của bạn.
2. Bấm vào nút **Add Project** (Thêm dự án mới).
3. **Đặt tên dự án**: Nhập tên bạn muốn (ví dụ: `btc-signage-hanoi`). Firebase sẽ tự động tạo một ID dự án duy nhất cho bạn.
4. Bấm **Continue** (Tiếp tục).
5. Ở bước **Google Analytics**, bạn có thể gạt công tắc sang **Tắt (Disable)** để quá trình khởi tạo dự án diễn ra nhanh hơn và không cần cấu hình phức tạp -> Bấm **Create Project** (Tạo dự án).
6. Đợi khoảng 10 giây để Google thiết lập hệ thống, sau đó bấm **Continue** để vào giao diện quản lý dự án.

---

## 🔐 BƯỚC 4: ĐĂNG NHẬP VÀ LIÊN KẾT MÃ NGUỒN

### 1. Đăng nhập tài khoản Google trên máy tính:
- Quay lại cửa sổ dòng lệnh (Terminal/Command Prompt) trên máy tính của bạn.
- Nhập lệnh sau để liên kết máy tính với tài khoản Gmail của bạn:
  ```bash
  firebase login
  ```
- Hệ thống sẽ tự động mở một trang trình duyệt web. Hãy chọn đúng tài khoản Gmail bạn vừa dùng để tạo dự án ở Bước 3 và bấm **Allow (Cho phép)**.
- Khi màn hình web báo *"Success! Logged in as..."* là bạn có thể tắt trình duyệt và quay lại cửa sổ dòng lệnh.

### 2. Di chuyển vào thư mục mã nguồn:
- Sử dụng lệnh `cd` để di chuyển cửa sổ dòng lệnh vào thư mục chứa code bạn vừa giải nén ở Bước 1.
  - *Ví dụ trên Windows*: `cd C:\Users\Admin\Downloads\btc-digital-signage`
  - *Ví dụ trên macOS*: `cd ~/Downloads/btc-digital-signage`

### 3. Khởi tạo cấu hình Firebase cho ứng dụng:
- Tại thư mục chứa code, gõ lệnh:
  ```bash
  firebase init hosting
  ```
- Hệ thống sẽ hiển thị giao diện tương tác và hỏi bạn một số câu hỏi, hãy chọn và trả lời theo hướng dẫn dưới đây:
  1. **"Please select an option"**: Dùng phím mũi tên lên/xuống di chuyển đến dòng **`Use an existing project`** (Sử dụng dự án đã có) và nhấn Enter.
  2. **"Select a default Firebase project for this directory"**: Tìm đúng tên dự án bạn đã tạo ở Bước 3 (ví dụ: `btc-signage-hanoi`) và nhấn Enter.
  3. **"What do you want to use as your public directory?"**: Nhập chữ **`dist`** và nhấn Enter. *(Mặc định là public, nhưng ứng dụng React sau khi build sẽ nằm ở thư mục dist, nên bạn bắt buộc phải nhập `dist`)*.
  4. **"Configure as a single-page app (rewrite all urls to /index.html)?"**: Nhấn phím **`Y`** (hoặc gõ `yes`) rồi nhấn Enter. *(Rất quan trọng giúp các trang con hoạt động bình thường không bị lỗi 404)*.
  5. **"Set up automatic builds and deploys with GitHub?"**: Nhấn phím **`N`** (hoặc gõ `no`) rồi nhấn Enter.
  6. **"File dist/index.html already exists. Overwrite?"**: Nhấn phím **`N`** (hoặc gõ `no`) rồi nhấn Enter. *(Rất quan trọng để không làm mất file giao diện của bạn)*.

Sau khi hoàn tất, hệ thống sẽ tạo ra 2 file cấu hình là `.firebaserc` và `firebase.json` trong thư mục code của bạn.

---

## 🚀 BƯỚC 5: BIÊN DỊCH VÀ ĐĂNG TẢI LÊN MẠNG (DEPLOY)

Mỗi lần bạn muốn cập nhật giao diện web mới, bạn chỉ cần thực hiện 2 câu lệnh cực kỳ đơn giản dưới đây:

### 1. Biên dịch ứng dụng (Build):
- Chạy lệnh sau để tối ưu hóa và biên dịch toàn bộ code React sang các tệp tin tĩnh siêu nhẹ đặt trong thư mục `dist`:
  ```bash
  npm run build
  ```
  *(Đợi quá trình đóng gói diễn ra trong khoảng 15-30 giây).*

### 2. Đưa lên máy chủ Google (Deploy):
- Chạy lệnh cuối cùng để tải thư mục `dist` lên dịch vụ đám mây của Google:
  ```bash
  firebase deploy
  ```
- Quá trình tải lên sẽ mất khoảng vài giây. Sau khi hoàn tất, bạn sẽ nhận được thông báo thành công cùng với đường link trang web của bạn tại dòng:
  ```text
  Hosting URL: https://ten-du-an-cua-ban.web.app
  ```

🎉 **Xin chúc mừng!** Trang web của bạn hiện đã hoạt động trực tuyến 24/7 trên máy chủ đám mây của Google. Bạn chỉ cần copy đường dẫn này và dán vào Smart TV hoặc phần mềm quản lý trình chiếu của tòa nhà để hiển thị thông tin thời gian thực!

---

## 🔒 LƯU Ý PHỤ VỀ BẢO MẬT VÀ DỮ LIỆU
1. **Dữ liệu cuộc họp**: Nếu bạn đang lưu dữ liệu lịch họp trực tiếp tại file `users.json` hoặc lưu cục bộ (Local Storage), dữ liệu này sẽ được lưu trực tiếp trên thiết bị Smart TV của bạn.
2. **Cập nhật nội dung**: Khi bạn muốn thay đổi bất kỳ nội dung nào (Ví dụ: thay đổi danh sách slide, thêm ảnh mới), bạn chỉ cần chỉnh sửa code trên máy tính, chạy lại lệnh `npm run build` và `firebase deploy` là tất cả các tivi đang chạy app sẽ tự động cập nhật nội dung mới mà bạn không cần phải đến từng chiếc tivi để thao tác.
