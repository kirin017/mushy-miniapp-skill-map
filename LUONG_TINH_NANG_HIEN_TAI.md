# Luồng tính năng hiện tại của Skill Map

Tài liệu này mô tả các luồng chính của mini-app Skill Map theo cách dễ hiểu, tập trung vào người dùng và vận hành sản phẩm, không đi sâu vào code.

## 1. Mở app và tải dữ liệu

Khi người dùng mở Skill Map từ Mushy, app sẽ nhận thông tin người dùng, workspace hiện tại và quyền truy cập.

Luồng hoạt động:

1. App kiểm tra người dùng đang mở từ Mushy hay đang chạy local để test.
2. App xác định workspace mà người dùng đang thao tác.
3. Nếu workspace có cấu hình mặc định, app tự mở đúng workspace đó.
4. App tải danh sách kỹ năng, thành viên và kỹ năng cá nhân của người dùng.
5. Trong lúc tải, app hiển thị trạng thái đang đồng bộ.
6. Nếu không tải được dữ liệu, app hiển thị lỗi để người dùng biết cần kiểm tra cấu hình hoặc migration.

Kết quả người dùng thấy:

- Danh sách kỹ năng team đang theo dõi.
- Danh sách thành viên trong workspace.
- Hồ sơ kỹ năng cá nhân.
- Bức tranh coverage của team.

## 2. Chọn workspace hoặc dữ liệu được chia sẻ

Skill Map có thể làm việc với dữ liệu của workspace hiện tại hoặc dữ liệu từ workspace khác đã chia sẻ quyền.

Luồng chọn workspace:

1. Người dùng mở menu chọn workspace ở đầu màn hình.
2. App hiển thị các workspace mà người dùng có quyền thao tác.
3. Người dùng chọn workspace muốn xem.
4. App tải lại toàn bộ Skill Map theo workspace vừa chọn.
5. Lựa chọn này được lưu lại để lần sau người dùng mở app vẫn vào đúng workspace đã chọn.

Các loại workspace có thể xuất hiện:

- Workspace của người dùng.
- Workspace khác đã chia sẻ dữ liệu sang workspace của người dùng.

## 3. Quản lý chia sẻ dữ liệu giữa workspace

Tính năng này dành cho owner hoặc admin workspace.

### Tạo mã chia sẻ

Mục đích: cho workspace khác quyền đọc và ghi dữ liệu Skill Map của workspace mình.

Luồng:

1. Admin mở phần quản lý chia sẻ.
2. Chọn workspace nguồn.
3. Chọn thời hạn mã chia sẻ.
4. App tạo mã chia sẻ 6 ký tự.
5. Admin gửi mã này cho admin workspace khác.

### Nhận mã chia sẻ

Mục đích: nhận quyền truy cập dữ liệu Skill Map từ workspace khác.

Luồng:

1. Admin mở phần nhận mã.
2. Chọn workspace sẽ nhận quyền.
3. Nhập mã chia sẻ.
4. Sau khi xác nhận, workspace nhận có thể đọc và ghi dữ liệu từ workspace nguồn.
5. Người dùng có thể đổi sang workspace được chia sẻ trong menu chọn workspace.

### Thu hồi chia sẻ

Mục đích: dừng quyền truy cập đã cấp hoặc đã nhận.

Luồng:

1. Admin mở danh sách chia sẻ hiện tại.
2. App hiển thị workspace đang chia sẻ ra ngoài và workspace đang nhận chia sẻ.
3. Admin chọn thu hồi.
4. App yêu cầu xác nhận.
5. Sau khi thu hồi, workspace kia mất quyền truy cập ngay.

### Đặt workspace mặc định

Mục đích: khi thành viên mở app, họ tự động vào đúng workspace dữ liệu mà admin muốn.

Luồng:

1. Admin chọn workspace mặc định.
2. App lưu lựa chọn này cho toàn workspace.
3. Thành viên chưa từng tự đổi workspace sẽ được đưa vào workspace mặc định khi mở app.
4. Nếu một thành viên đã tự chọn workspace khác, lựa chọn cá nhân của họ được ưu tiên.

### Ẩn workspace khỏi danh sách chọn

Mục đích: giảm rối khi workspace có nhiều nguồn dữ liệu.

Luồng:

1. Admin mở phần ẩn workspace.
2. Chọn workspace muốn ẩn khỏi menu.
3. Workspace đó không còn hiện trong danh sách chọn.
4. Quyền chia sẻ vẫn còn, chỉ ẩn khỏi giao diện.
5. Workspace đang là mặc định không thể ẩn cho đến khi đổi mặc định sang workspace khác.

## 4. Màn tổng quan Skill Map

Màn tổng quan là nơi người dùng nhìn nhanh năng lực hiện tại của team.

Người dùng thấy:

- Các kỹ năng team đang theo dõi.
- Các lối tắt để vào coverage, hồ sơ cá nhân và AI Coach.
- Bảng Team Coverage.
- Danh sách hành động ưu tiên.
- Tóm tắt hồ sơ kỹ năng cá nhân.
- Hàng chờ duyệt skill mới nếu người dùng là admin.

Luồng sử dụng:

1. Người dùng mở app và vào màn tổng quan.
2. App hiển thị tình trạng coverage theo từng nhóm kỹ năng.
3. Người dùng có thể tìm theo tên kỹ năng, nhóm kỹ năng hoặc tên thành viên.
4. Người dùng có thể lọc theo:
   - Tất cả kỹ năng theo nhóm.
   - Kỹ năng cần xử lý.
   - Kỹ năng đang có người muốn phát triển.
5. Người dùng bấm vào kỹ năng hoặc hành động ưu tiên để tập trung vào kỹ năng đó.

## 5. Team Coverage

Team Coverage cho biết mỗi kỹ năng trong team đang có đủ người phụ trách hay chưa.

Các trạng thái chính:

- Khỏe: có người phụ trách chính và có người dự phòng.
- Mỏng: có người phụ trách chính nhưng chưa có người dự phòng.
- Đang phát triển: chưa có người phụ trách chính nhưng có người đang học hoặc muốn nhận task.
- Thiếu: chưa có người phụ trách chính và cũng chưa có người đang phát triển kỹ năng đó.

Cách app hiểu vai trò trong từng kỹ năng:

- Người phụ trách chính: người có mức kỹ năng đủ mạnh để nhận trách nhiệm chính.
- Mentor: người có mức kỹ năng cao nhất, có thể dẫn dắt người khác.
- Backup: người có thể hỗ trợ hoặc thay thế khi cần.
- Trainee: người đang học hoặc có mức quan tâm cao với kỹ năng đó.

Kết quả của flow này là danh sách các khoảng trống năng lực mà team nên xử lý.

## 6. Cập nhật hồ sơ kỹ năng cá nhân

Mục đích: mỗi người tự cập nhật năng lực và mức độ quan tâm của mình.

### Thêm kỹ năng có sẵn

Luồng:

1. Người dùng vào màn Cá nhân.
2. Bấm thêm kỹ năng.
3. Chọn một kỹ năng có sẵn trong catalog.
4. Chọn mức độ kỹ năng.
5. Chọn mức độ quan tâm.
6. Thêm ghi chú nếu cần.
7. Bấm lưu.
8. App cập nhật lại hồ sơ và Team Coverage.

### Đề xuất kỹ năng mới

Luồng:

1. Người dùng vào màn Cá nhân.
2. Bấm thêm kỹ năng.
3. Chọn đề xuất skill.
4. Nhập tên kỹ năng mới và nhóm kỹ năng.
5. Chọn level, mức quan tâm và ghi chú.
6. Bấm lưu.
7. Skill mới được đưa vào trạng thái chờ duyệt.
8. Skill này xuất hiện trong hồ sơ của người đề xuất nhưng chưa được đưa vào catalog chính cho đến khi admin duyệt.

### Sửa kỹ năng

Luồng:

1. Người dùng bấm sửa trên một kỹ năng trong hồ sơ.
2. Cập nhật level, mức quan tâm hoặc ghi chú.
3. Bấm lưu.
4. App cập nhật lại hồ sơ và ảnh hưởng đến coverage của team.

### Xóa kỹ năng

Luồng:

1. Người dùng bấm xóa trên kỹ năng.
2. App hỏi xác nhận.
3. Người dùng xác nhận.
4. Kỹ năng được xóa khỏi hồ sơ cá nhân.
5. Team Coverage được tính lại.

## 7. Gợi ý kỹ năng theo role

Mục đích: giúp người dùng thêm nhanh các kỹ năng phù hợp với vai trò công việc.

Luồng:

1. Người dùng mở form thêm kỹ năng trong màn Cá nhân.
2. Nhập role, ví dụ: AI Engineer, Frontend Engineer, Backend Engineer, DevOps Engineer hoặc Product Designer.
3. App gửi yêu cầu gợi ý skill.
4. AI trả về danh sách kỹ năng phù hợp trong catalog hiện có.
5. App chỉ hiển thị các kỹ năng mà người dùng chưa có.
6. Người dùng chọn một gợi ý.
7. Skill đó được đưa vào form thêm kỹ năng.
8. Người dùng chọn level, mức quan tâm và lưu.

Nếu AI chưa sẵn sàng, app sẽ dùng danh sách gợi ý mặc định theo role phổ biến.

## 8. Admin duyệt kỹ năng đang chờ

Mục đích: chuẩn hóa các kỹ năng mới do thành viên đề xuất.

Điều kiện hiển thị:

- Người dùng là owner hoặc admin của workspace.
- Workspace có kỹ năng đang chờ duyệt.

### Duyệt kỹ năng

Luồng:

1. Admin thấy skill đang chờ trong màn tổng quan.
2. Bấm duyệt.
3. Skill trở thành kỹ năng chính thức của workspace.
4. Skill được đưa vào catalog và Team Coverage.

### Gộp kỹ năng

Mục đích: tránh trùng kỹ năng do đặt tên khác nhau.

Luồng:

1. Admin thấy skill đang chờ.
2. Bấm gộp vào một skill đã có.
3. Những hồ sơ đang dùng skill mới sẽ được chuyển về skill chuẩn.
4. Skill đề xuất được đánh dấu là đã gộp.
5. Coverage được tính theo skill chuẩn.

### Từ chối kỹ năng

Luồng:

1. Admin thấy skill đang chờ.
2. Bấm từ chối.
3. Skill không được đưa vào catalog chính.
4. Skill không còn xuất hiện trong các flow chính.

## 9. Báo cáo ưu tiên coverage

Mục đích: gom các vấn đề quan trọng nhất để team xử lý.

Luồng:

1. Người dùng mở tab Ưu tiên hoặc bấm xem hàng đợi từ màn tổng quan.
2. App gom các vấn đề coverage thành ba nhóm:
   - Thiếu người phụ trách chính.
   - Thiếu người dự phòng.
   - Có người muốn học nhưng chưa có mentor.
3. Mỗi mục hiển thị kỹ năng, nhóm kỹ năng, người phụ trách hiện tại, số backup và số trainee.
4. Người dùng dùng danh sách này để quyết định cần phân công, đào tạo hoặc tìm backup cho kỹ năng nào.

Nếu không có mục ưu tiên, app hiển thị rằng coverage hiện đang ổn.

## 10. AI Coach nâng level

Mục đích: giúp người dùng tạo kế hoạch phát triển kỹ năng cá nhân.

Điều kiện:

- Người dùng cần có ít nhất một kỹ năng trong hồ sơ.
- Người dùng cần nhập mục tiêu muốn đạt được.

Luồng:

1. Người dùng mở tab Coach.
2. App tải lịch sử các lần coach gần nhất của người dùng.
3. Người dùng nhập mục tiêu, ví dụ muốn lên Middle Frontend hoặc muốn cải thiện Docker.
4. Người dùng bấm tạo kế hoạch.
5. AI đọc mục tiêu và danh sách kỹ năng cá nhân hiện tại.
6. AI tạo kế hoạch gồm:
   - Tóm tắt định hướng.
   - Kỹ năng nên nâng cấp.
   - Level hiện tại.
   - Level mục tiêu.
   - Lý do nên tập trung vào kỹ năng đó.
   - Bước tiếp theo cụ thể.
7. App hiển thị kế hoạch mới.
8. App lưu kế hoạch vào lịch sử.
9. Người dùng có thể bấm lại các phiên cũ trong phần lịch sử coach.

Nếu người dùng chưa có kỹ năng cá nhân, app sẽ nhắc mở hồ sơ để thêm kỹ năng trước.

Nếu AI tạo được kế hoạch nhưng lưu lịch sử bị lỗi, app vẫn hiển thị kế hoạch và báo rõ phần lịch sử chưa lưu được.

## 11. Điều hướng trong app

App hiện có bốn tab chính:

- Map: xem tổng quan Skill Map và Team Coverage.
- Cá nhân: cập nhật hồ sơ kỹ năng của bản thân.
- Coach: tạo kế hoạch phát triển kỹ năng bằng AI.
- Ưu tiên: xem các vấn đề coverage cần xử lý.

Từ màn tổng quan, người dùng cũng có thể đi nhanh vào:

- Team Coverage.
- Cập nhật hồ sơ cá nhân.
- AI Coach.

## 12. Các nhóm dữ liệu chính

App đang quản lý ba nhóm dữ liệu chính.

### Kỹ năng

Lưu danh sách kỹ năng của workspace.

Bao gồm:

- Kỹ năng chuẩn trong catalog.
- Kỹ năng do thành viên đề xuất.
- Trạng thái duyệt của kỹ năng.
- Thông tin gộp kỹ năng nếu có.

### Kỹ năng của thành viên

Lưu kỹ năng từng người đang có.

Bao gồm:

- Người sở hữu kỹ năng.
- Kỹ năng tương ứng.
- Level.
- Mức quan tâm.
- Ghi chú cá nhân.

### Lịch sử AI Coach

Lưu các kế hoạch phát triển kỹ năng cá nhân.

Bao gồm:

- Mục tiêu người dùng nhập.
- Tóm tắt kế hoạch.
- Danh sách hành động AI đề xuất.
- Thời điểm tạo.

## 13. Quyền truy cập dữ liệu

Nguyên tắc chính:

- Người dùng chỉ thao tác trong workspace mà họ có quyền.
- Nếu workspace khác chia sẻ dữ liệu, người dùng có thể thao tác trên dữ liệu được chia sẻ đó.
- Thành viên thường có thể cập nhật kỹ năng của chính mình.
- Owner hoặc admin có thêm quyền duyệt, gộp, từ chối kỹ năng và quản lý chia sẻ.
- Lịch sử AI Coach là dữ liệu cá nhân, người dùng chỉ xem lịch sử của chính mình.

## 14. Tóm tắt luồng sử dụng khuyến nghị

Một team có thể dùng Skill Map theo thứ tự sau:

1. Mỗi thành viên cập nhật hồ sơ kỹ năng cá nhân.
2. Admin duyệt hoặc gộp các kỹ năng mới được đề xuất.
3. Team xem màn tổng quan để hiểu coverage hiện tại.
4. Team mở báo cáo ưu tiên để xử lý kỹ năng thiếu owner, thiếu backup hoặc thiếu mentor.
5. Mỗi thành viên dùng AI Coach để tạo kế hoạch nâng level.
6. Team cập nhật lại hồ sơ theo thời gian để coverage luôn phản ánh năng lực thật.

