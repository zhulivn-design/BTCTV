# HƯỚNG DẪN XUẤT BẢN ỨNG DỤNG ANDROID TV (APK)

Ứng dụng **BTC Digital Signage** (Bảng thông tin điện tử) được tối ưu hóa giao diện tỉ lệ hiển thị (16:9 / 9:16) và hỗ trợ hoàn toàn phím cứng điều hướng (D-Pad) của điều khiển TV (Remote).

Dưới đây là 2 phương pháp tối ưu nhất để đóng gói và xuất bản ứng dụng thành file **APK** cài đặt trực tiếp trên các dòng Smart TV, Android TV Box (Sony, TCL, Xiaomi Mi Box, Casper,...).

---

## 💡 Phương Pháp 1: Sử Dụng Native WebView Wrapper (Khuyên Dùng)
Đây là cách chuyên nghiệp nhất dành cho hệ thống màn hình quảng cáo (Digital Signage). Bạn sẽ tạo một dự án Android nhỏ bằng Android Studio, mục đích là tải URL web đã chạy trên Cloud Run (`https://ais-pre-bwpyr773wjdu7afuis2pde-986279175196.asia-southeast1.run.app`) ở chế độ Kiosk toàn màn hình.

### ✅ Ưu điểm:
- **Không cần cập nhật lại file APK**: Khi bạn thay đổi slide, thêm tòa nhà, chỉnh sửa cấu hình hay cập nhật giao diện web, Smart TV sẽ tự động hiển thị phiên bản mới nhất ngay lập tức mà không cần cài đặt lại ứng dụng.
- **Tận dụng tối đa server API**: Hoạt động mượt mà với tính năng proxy ảnh, API lấy cấu hình tự động (heartbeat), và giảm tải bộ nhớ cho Smart TV cấu hình yếu.
- **Bảo mật tuyệt đối**: Không lưu trữ mã nguồn nhạy cảm trên thiết bị TV đầu cuối.

### 🛠️ Các bước thực hiện bằng Android Studio:

1. **Khởi tạo dự án mới**: Mở Android Studio -> Chọn **New Project** -> Chọn **No Activity** hoặc **Empty Views Activity**.
2. **Cấu hình `AndroidManifest.xml`**:
   Thay thế nội dung file `/app/src/main/AndroidManifest.xml` để hỗ trợ hiển thị trên màn hình Android TV không cảm ứng (Leanback Mode) và tự động mở toàn màn hình (Full-Screen Kiosk):
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <manifest xmlns:android="http://schemas.android.com/apk/res/android"
       package="com.btc.digitalsignage">

       <!-- Khai báo quyền kết nối Internet -->
       <uses-permission android:name="android.permission.INTERNET" />
       <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

       <!-- Khai báo tương thích Android TV (Không yêu cầu màn hình cảm ứng) -->
       <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
       <uses-feature android:name="android.software.leanback" android:required="true" />

       <application
           android:allowBackup="true"
           android:icon="@mipmap/ic_launcher"
           android:label="BTC Signage"
           android:supportsRtl="true"
           android:theme="@style/Theme.AppCompat.NoActionBar"
           android:hardwareAccelerated="true">

           <activity
               android:name=".MainActivity"
               android:exported="true"
               android:screenOrientation="landscape"
               android:theme="@style/Theme.AppCompat.NoActionBar">
               
               <!-- Chạy ứng dụng trên màn hình chính Android TV -->
               <intent-filter>
                   <action android:name="android.intent.action.MAIN" />
                   <category android:name="android.intent.category.LAUNCHER" />
                   <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
               </intent-filter>
           </activity>
       </application>
   </manifest>
   ```

3. **Tạo Code `MainActivity.kt` (Kotlin)**:
   Mở file `/app/src/main/java/com/btc/digitalsignage/MainActivity.kt` và dán đoạn code tối ưu hóa WebView dưới đây. Code này đã được xử lý tăng tốc phần cứng, cho phép tải cookies, tự động ẩn thanh trạng thái, phóng to tối đa, và hỗ trợ nhận sự kiện các nút bấm Remote (D-Pad):
   ```kotlin
   package com.btc.digitalsignage

   import android.annotation.SuppressLint
   import android.os.Bundle
   import android.view.View
   import android.view.WindowManager
   import android.webkit.WebSettings
   import android.webkit.WebView
   import android.webkit.WebViewClient
   import androidx.appcompat.app.AppCompatActivity

   class MainActivity : AppCompatActivity() {

       private lateinit var webView: WebView
       private val SIGNAGE_URL = "https://ais-pre-bwpyr773wjdu7afuis2pde-986279175196.asia-southeast1.run.app"

       @SuppressLint("SetJavaScriptEnabled")
       override fun onCreate(savedInstanceState: Bundle?) {
           super.onCreate(savedInstanceState)
           
           // Thiết lập chế độ Kiosk Fullscreen, giữ màn hình TV luôn sáng không tắt ngủ (Keep Screen On)
           window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
           setContentView(R.layout.activity_main)

           // Kích hoạt chế độ Immersive full-screen
           window.decorView.systemUiVisibility = (
                   View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                   or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                   or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                   or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                   or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                   or View.SYSTEM_UI_FLAG_FULLSCREEN
           )

           webView = WebView(this)
           setContentView(webView)

           val settings = webView.settings
           settings.javaScriptEnabled = true
           settings.domStorageEnabled = true
           settings.useWideViewPort = true
           settings.loadWithOverviewMode = true
           settings.databaseEnabled = true
           settings.cacheMode = WebSettings.LOAD_DEFAULT
           
           // Tối ưu tốc độ dựng hình (Hardware Acceleration)
           webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

           // Ngăn chặn mở trình duyệt mặc định khi bấm link
           webView.webViewClient = object : WebViewClient() {
               override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                   view.loadUrl(url)
                   return true
               }
           }

           webView.loadUrl(SIGNAGE_URL)
       }

       // Cho phép điều hướng phím Back của Remote TV quay lại trang trước
       override fun onBackPressed() {
           if (webView.canGoBack()) {
               webView.goBack()
           } else {
               super.onBackPressed()
           }
       }
   }
   ```

4. **Biên dịch APK**:
   - Chọn **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
   - File APK đầu ra nằm ở thư mục `/app/build/outputs/apk/debug/app-debug.apk`. Bạn có thể đổi tên thành `BTCSignageTV.apk` để cài đặt.

---

## 📦 Phương Pháp 2: Đóng Gói Toàn Bộ Code Bằng Capacitor
Phương pháp này giúp chuyển đổi trực tiếp giao diện Frontend React của bạn thành một ứng dụng chạy Offline hoặc Standalone cục bộ trên TV thông qua CapacitorJS.

### 🛠️ Các bước tích hợp:

1. **Cài đặt thư viện Capacitor**:
   Chạy các lệnh sau trong thư mục gốc của ứng dụng (trên máy tính của bạn sau khi xuất mã nguồn):
   ```bash
   npm install @capacitor/core @capacitor/cli
   ```

2. **Khởi tạo cấu hình Capacitor**:
   Chạy lệnh khởi tạo:
   ```bash
   npx cap init "BTC Digital Signage" "com.btc.digitalsignage" --web-dir=dist
   ```

3. **Cài đặt nền tảng Android**:
   ```bash
   npm install @capacitor/android
   npx cap add android
   ```

4. **Định cấu hình lại API Endpoint (CỰC KỲ QUAN TRỌNG)**:
   Vì ứng dụng chạy trực tiếp từ thư mục `assets` nội bộ của Android, các đường dẫn tương đối `/api/heartbeat` sẽ bị lỗi.
   - Bạn cần mở mã nguồn và sửa các đường dẫn `fetch('/api/...')` thành URL tuyệt đối như `fetch('https://ais-pre-bwpyr773wjdu7afuis2pde-986279175196.asia-southeast1.run.app/api/...')`.
   
5. **Đồng bộ mã nguồn & Build**:
   ```bash
   npm run build
   npx cap sync
   ```

6. **Mở dự án trên Android Studio**:
   ```bash
   npx cap open android
   ```
   Từ đây, bạn cấu hình thêm thuộc tính Leanback trong file `AndroidManifest.xml` (tương tự Bước 2 ở Phương Pháp 1) rồi nhấn **Build APK** là xong!

---

## 📥 Cách Cài Đặt File APK Lên Smart TV / Android TV:
Sau khi có được file `.apk` bằng một trong 2 cách trên, bạn tiến hành cài đặt lên TV theo các bước:

1. **Bật chế độ Nhà phát triển & Cho phép nguồn không xác định** trên Smart TV:
   - Truy cập **Cài đặt (Settings)** -> **Hệ thống (System)** -> **Giới thiệu (About)**.
   - Tìm dòng **Bản dựng hệ điều hành (Android TV OS Build)** và bấm liên tục 7 lần cho đến khi xuất hiện thông báo *"Bạn đã là nhà phát triển"*.
   - Quay lại **Cài đặt** -> **Bảo mật & Hạn chế** -> Kích hoạt **Nguồn không xác định (Unknown Sources)** cho trình quản lý tệp tin.
2. **Chuyển file APK lên TV**:
   - **Cách 1**: Sao chép file APK vào USB rồi cắm trực tiếp vào Smart TV, mở ứng dụng quản lý file (như *File Commander* hoặc *AnExplorer*) trên TV để bấm cài đặt.
   - **Cách 2**: Sử dụng ứng dụng **"Send Files to TV"** trên cả điện thoại Android và Smart TV để truyền tệp APK không dây qua mạng Wifi.
3. **Mở ứng dụng**: Tìm biểu tượng ứng dụng **BTC Signage** trong danh sách ứng dụng hoặc mục Ứng dụng hệ thống của TV để khởi chạy 24/7.
