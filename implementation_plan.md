# Kế hoạch & Báo cáo đề xuất dự án: Mini-app Team Connect & Skill Map

> **Kính gửi:** Ban quản lý / Trưởng bộ phận
> **Người đề xuất:** Nam (Mentor/Team Leader) & AI Assistant
> **Mục tiêu:** Giải quyết bài toán gắn kết đội ngũ, đặc biệt là các thành viên mới/thực tập sinh gia nhập phòng ban, thông qua việc ứng dụng công nghệ để tự động hóa hoạt động làm quen (onboarding), tìm kiếm điểm chung (common ground) và trực quan hóa thế mạnh của team (skill map).

---

## I. BÁO CÁO NGHIÊN CỨU THỊ TRƯỜNG & ĐỀ XUẤT GIẢI PHÁP

### 1. Bối cảnh & Nỗi đau của phòng ban (Problem Statement)
*   **Thực trạng**: Khi các thành viên mới (thực tập sinh) gia nhập phòng ban, một thành viên trong nhóm đã chủ động kêu gọi mọi người tự giới thiệu bản thân thông qua group chat với bộ câu hỏi 9 tiêu chí (Tên, Năm sinh, Vai trò, Thế mạnh, Sở thích, Kỹ năng, Mục tiêu...). Tuy nhiên, kết quả nhận lại rất thấp: **chỉ có 1/8 thành viên trả lời**.
*   **Phân tích nguyên nhân**:
    *   **Rào cản tâm lý (Gen Z)**: Các bạn thực tập sinh mới thường e ngại khi phải viết một bài giới thiệu dài và gửi tin nhắn dạng text tĩnh vào group chat chung có cả sếp/mentor.
    *   **Trôi thông tin & Khó tra cứu**: Tin nhắn giới thiệu bị trôi nhanh trên chat nhóm, không đọng lại và rất khó tra cứu sau này khi cần tìm kiếm thông tin cá nhân hoặc kỹ năng của nhau.
*   **Hậu quả**: Team thiếu sự gắn kết (bonding) trong những tuần đầu, các thành viên hoạt động cô lập, Mentor mất nhiều thời gian để nắm bắt thế mạnh của từng bạn để phân chia công việc hợp lý.

### 2. So sánh giải pháp trên thị trường với Đề xuất Mini-app

Dưới đây là bảng so sánh chi tiết giữa các giải pháp gắn kết đội ngũ phổ biến trên thị trường và đề xuất xây dựng Mini-app tích hợp trực tiếp trên nền tảng nội bộ Mushy:

| Tiêu chí so sánh | [Donut (Slack App)](https://www.donut.ai/pricing) | [Deel Roots (Slack/Teams)](https://www.letsdeel.com/pricing) | [Notion Directory](https://www.notion.so/pricing) | Đề xuất: Mushy Team Connect |
| :--- | :--- | :--- | :--- | :--- |
| **Cách tiếp cận** | Kết nối ngẫu nhiên 1-1 qua tin nhắn riêng (DMs), tự động đặt câu hỏi khơi gợi trò chuyện hàng tuần. | Vẽ sơ đồ tổ chức (Org Chart), gắn tag kỹ năng của thành viên, thông báo ngày kỷ niệm. | Tạo trang profile tĩnh dạng wiki/bảng để tra cứu thủ công. | **Hồ sơ cá nhân dạng thẻ trực quan** + **Bản đồ kỹ năng (Skill Map)** + **Tự động tìm điểm chung (Common Ground)**. |
| **Độ tương tác & Gắn kết** | Cao (thúc đẩy gặp mặt trực tiếp). | Trung bình (thiên về quản lý cấu trúc). | Thấp (chỉ đọc tĩnh, ít cập nhật). | **Cao** (Tự động tính toán điểm chung để tạo chủ đề bắt chuyện, hiển thị thế mạnh trực quan). |
| **Độ phức tạp cài đặt** | Trung bình (cần tích hợp Slack workspace). | Cao (cần kết nối hệ thống nhân sự HRIS + Slack). | Thấp (dùng mẫu template có sẵn). | **Cực kỳ đơn giản** (Chạy trực tiếp dưới dạng Mini-app trên app Mushy nội bộ của công ty). |
| **Chi phí bản quyền** | Đắt (Bản miễn phí giới hạn ghép đôi và tính năng; bản Standard từ **$2/user/tháng**, bản Pro từ **$4/user/tháng**). | Rất đắt (Gói Deel HR có giá từ **$49/contractor/tháng** hoặc **$599/employee/năm**). | Rẻ/Miễn phí (Bản Plus doanh nghiệp từ **$8 - $10/user/tháng**; bản miễn phí bị giới hạn block và tính năng chia sẻ). | **0 VNĐ** (Tận dụng hạ tầng cloud Supabase & Vercel miễn phí có sẵn của Mushy). |
| **Bản đồ thế mạnh (Skill Map)** | Không hỗ trợ. | Có hỗ trợ dạng danh sách tag tĩnh trong profile. | Có hỗ trợ dạng bảng/view lọc. | **Trực quan hóa bằng biểu đồ thống kê thế mạnh**, click lọc nhanh những ai có chung kỹ năng. |
| **Độ bảo mật** | Dữ liệu đẩy qua server bên thứ ba (Donut). | Dữ liệu quản lý bởi Deel. | Nằm trên workspace Notion chung. | **An toàn tuyệt đối** (Dữ liệu nằm trong schema biệt lập `app_skill_map` của dự án). |

### 3. Đánh giá chi tiết các đối thủ chính
*   **Donut (Slack App)**: Rất mạnh trong việc kết nối ngẫu nhiên để uống cafe. Tuy nhiên, bản miễn phí của Donut bị giới hạn số lượng thành viên và số lượt ghép đôi. Để dùng cho tổ chức có phân quyền hoặc tùy biến câu hỏi thì phải mua bản trả phí với chi phí khá cao ($2 - $4/user/tháng). Với quy mô phòng ban nhỏ, việc trả chi phí duy trì hàng tháng chỉ để ghép đôi cafe là không tối ưu.
*   **Deel Roots**: Phù hợp cho các doanh nghiệp lớn cần quản lý Org Chart và onboarding nhân viên quy mô lớn. Đối với một phòng ban hoặc một nhóm thực tập sinh nhỏ, công cụ này quá cồng kềnh và đắt đỏ.
*   **Notion Team Directory**: Đơn giản, dễ làm nhưng nhanh chóng bị lãng quên (bản chất là trang tĩnh "shelfware"). Theo nghiên cứu hành vi nhân sự, nhân viên thường chỉ vào điền thông tin một lần lúc Onboarding rồi không bao giờ mở lại, vì trang Notion không có cơ chế chủ động tìm điểm chung hay nhắc nhở động, khiến thông tin nhanh chóng bị lỗi thời.

### 4. Đề xuất lựa chọn: Xây dựng Mini-app "Mushy Team Connect"
Xây dựng một Mini-app nội bộ tinh giản là giải pháp tối ưu nhất cho bài toán của phòng ban vì:
*   **Chi phí phát triển và vận hành bằng 0**: Tận dụng nền tảng Mini-app Mushy sẵn có của công ty.
*   **Giảm thiểu rào cản giới thiệu**: Thay vì viết bài dài, các thành viên chỉ cần chọn nhanh các thẻ Tag (Kỹ năng, Sở thích) và Emoji đại diện.
*   **Tập trung vào giá trị thực chất**: Bỏ qua các tính năng tương tác mạng xã hội phức tạp (như thả tim, đập tay, mời cafe có thể gây loãng app), tập trung hoàn toàn vào 3 cốt lõi: **Hồ sơ thành viên đẹp đẽ**, **Bảng tìm điểm chung (Common Ground)** để tự kết nối, và **Bản đồ kỹ năng (Skill Map)** để trao đổi công việc.
*   **Hỗ trợ đắc lực cho Mentor**: Mentor dễ dàng nhìn vào "Bản đồ kỹ năng" của cả nhóm để biết được thế mạnh chung, phân chia công việc hợp lý.

### 5. Kế hoạch giải quyết rủi ro sử dụng (User Adoption Risk & Mitigation)
Để đảm bảo tất cả thành viên trong nhóm (dù quy mô biến động nhiều hay ít hơn 8 bạn thực tập sinh) đều điền thông tin trên app, chúng tôi áp dụng các biện pháp phòng ngừa rủi ro sau:
*   **Trải nghiệm nhanh & trực quan**: Quy trình tạo hồ sơ thiết kế tối giản chỉ mất dưới 2 phút với các ô nhập liệu dạng Tag chọn nhanh.
*   **Lồng ghép hoạt động onboarding**: App sẽ được mở trực tiếp trong buổi họp làm quen đầu tiên (Ice-breaking session), yêu cầu mọi người dành ra 5 phút mở app Mushy để cập nhật thông tin và cùng xem điểm chung của nhau ngay lập tức.
*   **Ủy quyền làm gương linh hoạt**:
    *   *Rủi ro: Mentor bận việc đột xuất và không thể làm gương điền hồ sơ trước.*
    *   *Giải pháp khắc phục*: Trưởng nhóm (bạn) hoặc 1-2 bạn thực tập sinh năng nổ, hướng ngoại sẽ được giao nhiệm vụ điền hồ sơ mẫu trước. Ngoài ra, ngay khi người dùng đăng nhập lần đầu mà chưa có dữ liệu, app sẽ hiển thị một Banner thông báo rất bắt mắt: *"Chào bạn mới! Hãy dành 1 phút giới thiệu bản thân tại đây để bắt tay đập tay làm quen với đồng đội nhé 🖐️"* để kích thích họ tự hoàn thiện hồ sơ.
*   **Thích ứng với quy mô biến động**: Thiết kế giao diện Grid linh hoạt (CSS Grid Auto-fill) và thuật toán quét điểm chung tối ưu hóa để hiển thị tốt cho các nhóm quy mô từ nhỏ (5 thành viên) đến trung bình (30 thành viên).

### 6. Chỉ số đo lường hiệu quả thành công (KPIs & Success Metrics)
Mức độ hiệu quả của dự án sẽ được báo cáo định lượng qua 4 chỉ số tự động:
*   **Tỷ lệ hoàn thành hồ sơ (Profile Completion Rate)**: Đạt 100% (Tất cả thành viên trong workspace hoàn thành cập nhật hồ sơ cá nhân trong vòng 3 ngày đầu triển khai).
*   **Tỷ lệ gắn kết & khám phá (Discovery Rate)**: Đạt trung bình mỗi thành viên xem chi tiết ít nhất 5 hồ sơ của đồng nghiệp khác trong tuần đầu để tìm hiểu thông tin.
*   **Tỷ lệ cập nhật thông tin (Profile Update Rate)**: Đạt ít nhất 1 lần cập nhật/thành viên/tháng (ví dụ khi các bạn học được kỹ năng mới hoặc đổi mảng quan tâm).
*   **Tần suất tra cứu (Retention & Activity)**: Đạt ít nhất 2 lượt truy cập/thành viên/tuần trong giai đoạn làm quen để tìm hiểu thông tin và tìm kiếm kỹ năng đồng nghiệp.

### 7. Ước tính nguồn lực & Thời gian triển khai (Timeline & Resources)
Nhờ tinh giản tính năng tương tác thừa và tận dụng hạ tầng có sẵn của Mushy, dự án ước tính triển khai trong **3 ngày làm việc** (bao gồm 1 ngày cho việc kiểm thử và tối ưu hóa) với **1 lập trình viên**:
*   **Ngày 1 (Phát triển DB & Hồ sơ)**: Thiết kế & cấu trúc Database (bảng SQL), cài đặt RLS bảo mật và submit migration. Xây dựng Form nhập liệu hồ sơ thông minh (`ProfileEditModal`) và giao diện Thẻ thành viên (`MemberCard`).
*   **Ngày 2 (Phát triển Tính năng Cốt lõi)**: Phát triển bộ lọc tìm điểm chung (`CommonGround`), Tab Bản đồ kỹ năng (`SkillMapTab`), tích hợp logic lấy thành viên `listMembers` và Scope switcher.
*   **Ngày 3 (Kiểm thử, Fix bug & Nghiệm thu)**: Tiến hành kiểm thử chi tiết trên môi trường Local và Preview trên điện thoại. Sửa các lỗi hiển thị (CSS layout), tối ưu hóa tốc độ tải và chuẩn bị bàn giao.

### 8. Khả năng mở rộng & Giá trị lâu dài cho tổ chức (Scalability)
*   **Không tốn thêm chi phí**: App được thiết kế theo cấu trúc phân vùng dữ liệu theo Workspace của Mushy. Nếu chạy thử nghiệm thành công cho nhóm thực tập sinh này, chúng ta chỉ cần chuyển visibility của app sang **Public** trên Admin Portal. Bất kỳ phòng ban nào khác cũng có thể kích hoạt sử dụng ngay lập tức mà không tốn công phát triển lại.

---

## II. DANH SÁCH & Ý TƯỞNG CÁC TÍNH NĂNG TRIỂN KHAI (PRODUCT FEATURES)

Dưới đây là bảng tổng hợp phạm vi các tính năng cốt lõi (Core Features) sẽ được phát triển trong dự án để sếp dễ dàng đánh giá:

| STT | Tên tính năng | Mô tả chức năng chi tiết | Giá trị mang lại |
| :--- | :--- | :--- | :--- |
| **1** | **Thiết lập Hồ sơ Cá nhân** *(Interactive Profile)* | - Cho phép mỗi thành viên tự điền/sửa thông tin dựa trên 9 câu hỏi làm quen.<br>- Nhập dạng Tag chọn nhanh cho *Sở thích, Kỹ năng, Mảng quan tâm*.<br>- Chọn 1 **Emoji** đại diện cho tính cách/tâm trạng.<br>- Nhập link Facebook, GitHub, LinkedIn. | - Rút ngắn thời gian viết giới thiệu (dưới 2 phút).<br>- Tạo cảm giác thú vị, cởi mở, bớt áp lực viết lách cho các bạn Gen Z. |
| **2** | **Danh bạ Thành viên trực quan** *(Team Directory)* | - Hiển thị danh sách thành viên trong workspace dưới dạng lưới thẻ (Grid Cards).<br>- Mỗi thẻ gồm: Avatar, tên thật (lấy qua API hệ thống), vai trò, emoji và các tag kỹ năng tiêu biểu.<br>- Bấm vào thẻ sẽ mở Modal xem chi tiết toàn bộ hồ sơ của người đó. | - Giúp mọi người nhanh chóng nhớ mặt, biết tên và vai trò của từng thành viên trong nhóm. |
| **3** | **Quét Điểm chung tự động** *(Common Ground Finder)* | - Quét chéo database để tìm ra các điểm tương đồng giữa người dùng hiện tại và các thành viên khác.<br>- Hiển thị dạng thông báo gợi ý: *"Bạn và Nam đều thích đá bóng ⚽"*, *"3 người cùng muốn học Node.js"*... | - **Phá băng cực kỳ hiệu quả**: Cung cấp sẵn các chủ đề thực tế và sở thích chung để các thành viên dễ bắt chuyện với nhau. |
| **4** | **Bản đồ Kỹ năng Đội ngũ** *(Team Skill Map)* | - Thống kê tổng số lượng kỹ năng nổi bật của cả nhóm dưới dạng biểu đồ/mạng lưới tag.<br>- Cho phép click vào 1 kỹ năng (ví dụ: *React*) để lọc nhanh danh sách các thành viên giỏi kỹ năng đó. | - Giúp các thành viên tìm được người hỗ trợ (Mentor/Buddy) khi gặp bài toán khó.<br>- Giúp Mentor đánh giá thế mạnh chung của team để phân công việc. |

---

## III. THIẾT KẾ DATABASE (SUPABASE MIGRATION)

Chúng ta chỉ cần 1 bảng duy nhất trong schema `app_skill_map` (lưu ý: slug `skill-map` được chuẩn hóa thành `app_skill_map` trong database):

### Bảng `app_skill_map.member_profiles`
Lưu thông tin giới thiệu chi tiết của từng thành viên trong team.
* `id` uuid (khóa chính, mặc định `gen_random_uuid()`)
* `workspace_id` uuid (phân quyền theo workspace của Mushy, references `public.workspaces(id)` on delete cascade)
* `user_id` uuid (khóa ngoại liên kết với `auth.users(id)`, duy nhất mỗi workspace)
* `birth_year` integer (năm sinh)
* `major_role` text (chuyên ngành / vai trò)
* `interests` text[] (mảng các mảng quan tâm, ví dụ: `['AI', 'Frontend']`)
* `skills` text[] (mảng kỹ năng nổi bật, ví dụ: `['React', 'Node.js', 'Figma']`)
* `learning_goals` text (muốn học gì khi vào team)
* `strengths` text (điểm mạnh của bản thân)
* `hobbies` text[] (sở thích cá nhân, ví dụ: `['Gaming', 'Đá bóng']`)
* `social_links` jsonb (chứa `{facebook: '...', github: '...', linkedin: '...'}`)
* `emoji` text (emoji đại diện)
* `created_by` uuid (references `auth.users(id)`)
* `created_at` timestamptz (mặc định `now()`)
* `updated_at` timestamptz (mặc định `now()`)
* Ràng buộc duy nhất: `unique (workspace_id, user_id)` để đảm bảo mỗi người chỉ có 1 hồ sơ trong 1 workspace.

```sql
create table if not exists app_skill_map.member_profiles (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  birth_year    integer,
  major_role    text,
  interests     text[],
  skills        text[],
  learning_goals text,
  strengths     text,
  hobbies       text[],
  social_links  jsonb default '{}'::jsonb,
  emoji         text,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_member_profiles_workspace on app_skill_map.member_profiles (workspace_id);
create index if not exists idx_member_profiles_user      on app_skill_map.member_profiles (user_id);

grant select, insert, update, delete on app_skill_map.member_profiles to authenticated;

alter table app_skill_map.member_profiles enable row level security;

-- SELECT: member ws owner HOẶC member ws follower được share
drop policy if exists "member_profiles_select" on app_skill_map.member_profiles;
create policy "member_profiles_select" on app_skill_map.member_profiles
for select using (
  public.can_access_app_data(workspace_id, 'skill-map')
);

-- INSERT: cùng quyền với select
drop policy if exists "member_profiles_insert" on app_skill_map.member_profiles;
create policy "member_profiles_insert" on app_skill_map.member_profiles
for insert with check (
  public.can_access_app_data(workspace_id, 'skill-map')
);

-- UPDATE: cùng quyền
drop policy if exists "member_profiles_update" on app_skill_map.member_profiles;
create policy "member_profiles_update" on app_skill_map.member_profiles
for update using (
  public.can_access_app_data(workspace_id, 'skill-map')
) with check (
  public.can_access_app_data(workspace_id, 'skill-map')
);

-- DELETE: CHỈ member trực tiếp của ws owner. Follower KHÔNG xoá được.
drop policy if exists "member_profiles_delete" on app_skill_map.member_profiles;
create policy "member_profiles_delete" on app_skill_map.member_profiles
for delete using (
  public.is_owner_workspace_member(workspace_id)
);

-- ---------- Trigger updated_at ----------
create or replace function app_skill_map.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_member_profiles_updated_at on app_skill_map.member_profiles;
create trigger trg_member_profiles_updated_at
  before update on app_skill_map.member_profiles
  for each row execute function app_skill_map.set_updated_at();
```

---

## IV. KẾ HOẠCH TRIỂN KHAI PHẦN MỀM (DEVELOPMENT ROADMAP)

### Bước 1: Tạo Database & Phân Quyền RLS
*   Tạo file migration `migrations/002_create_team_connect.sql` chứa cấu trúc bảng `member_profiles` và các chính sách bảo mật RLS.
*   Submit file SQL lên Admin Portal để hệ thống tự động khởi tạo trên cả môi trường Dev và Production.

### Bước 2: Xây dựng Giao diện & Components React
*   **`MemberCard.jsx`**: Component hiển thị thông tin giới thiệu của từng thành viên dạng card, click mở full modal.
*   **`ProfileEditModal.jsx`**: Form nhập liệu thông minh cho phép người dùng tự điền hồ sơ (hỗ trợ nhập tag bằng Enter, chọn emoji).
*   **`CommonGround.jsx`**: Tính toán và hiển thị điểm chung giữa người dùng hiện tại và các thành viên khác trong workspace.
*   **`SkillMapTab.jsx`**: Tổng hợp các tag kỹ năng trong team, hiển thị số lượng người nắm giữ từng kỹ năng, cho phép click lọc danh sách.

### Bước 3: Tích hợp vào App chính (`App.jsx` & `App.css`)
*   Đọc thông tin ngữ cảnh người dùng hiện tại bằng `getContext()`.
*   Tích hợp bộ chọn Workspace `<ScopeSwitcher />` trên header để hỗ trợ chia sẻ dữ liệu chéo phòng ban.
*   Lấy danh sách thành viên thật từ hệ thống bằng `listMembers(workspaceId)` để hiển thị tên và avatar chính xác của họ.
*   Xây dựng giao diện hai tab: "Danh bạ thành viên" và "Bản đồ kỹ năng".

---

## V. KẾ HOẠCH XÁC THỰC & KỊCH BẢN KIỂM THỬ (VERIFICATION PLAN)

### 1. Kịch bản kiểm thử chi tiết (Detailed Test Cases)

Chúng tôi thiết lập quy trình kiểm thử chất lượng nghiêm ngặt trước khi bàn giao:

| STT | Kịch bản kiểm thử (Test Case) | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **TC1** | **Tạo mới & Cập nhật hồ sơ** | 1. Đăng nhập lần đầu, bấm vào banner nhắc nhở điền hồ sơ.<br>2. Nhập các thông tin hợp lệ (Birth year, Major/role, Hobbies...). Nhấn Enter để add tag.<br>3. Bấm "Lưu". | - Giao diện lưu thông tin thành công, đóng modal.<br>- Các trường dữ liệu lưu chính xác vào bảng `member_profiles`. |
| **TC2** | **Xác thực biểu mẫu (Validation)** | 1. Mở form, nhập `birth_year` vượt phạm vi hợp lý (ví dụ: `2500` hoặc `-1`).<br>2. Thử bấm "Lưu". | - Hệ thống chặn không cho submit.<br>- Hiển thị thông báo lỗi rõ ràng bên dưới ô nhập liệu. |
| **TC3** | **Danh bạ thành viên & Avatar** | 1. Truy cập tab "Danh bạ thành viên".<br>2. Kiểm tra danh sách hiển thị đúng avatar và tên thật của các thành viên. | - Avatar và tên thật được fetch chính xác thông qua `listMembers(workspaceId)`. Không có lỗi fallback màu UUID. |
| **TC4** | **Thuật toán quét Điểm chung** | 1. Tạo 2 tài liệu thành viên mẫu (Nam và Huy) có chung sở thích `Đá bóng` và chung kỹ năng `React`.<br>2. Đăng nhập bằng tài khoản Nam và kiểm tra mục "Common Ground". | - Hệ thống hiển thị dòng chữ: *"Bạn và Huy đều thích đá bóng ⚽ và biết React."* |
| **TC5** | **Biểu đồ Kỹ năng & Bộ lọc** | 1. Mở tab "Bản đồ kỹ năng".<br>2. Click chọn kỹ năng `React`. | - Đồ thị thống kê đúng số người có skill React.<br>- Khi click, giao diện tự lọc danh sách hiển thị đúng những người có kỹ năng này. |
| **TC6** | **Bảo mật RLS & Scope Switcher** | 1. Bật ScopeSwitcher để chuyển đổi giữa các Workspace (Workspace A và Workspace B). | - Data chuyển đổi tương ứng tức thì.<br>- Không bị rò rỉ dữ liệu chéo giữa các workspace (được đảm bảo bởi RLS `can_access_app_data`). |

### 2. Kiểm thử trên các môi trường

*   **Môi trường Local**:
    *   Sử dụng script tạo dữ liệu giả lập (seed data) để test khả năng co giãn giao diện CSS grid khi số lượng thành viên thay đổi (5, 9, 20 người).
*   **Môi trường Staging/Preview**:
    *   Chạy test trực tiếp trên điện thoại thông qua WebView native shell bằng cách kích hoạt Dev Mode trong ứng dụng Mushy. 
    *   Xác nhận giao diện responsive tốt, không lỗi tràn khung hình và các thao tác vuốt cuộn mượt mà.
