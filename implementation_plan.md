# Kế hoạch & Báo cáo đề xuất dự án: Mini-app Team Connect & Skill Map

> **Kính gửi:** Ban quản lý / Trưởng bộ phận
> **Người đề xuất:** Nam (Mentor/Team Leader) & AI Assistant
> **Mục tiêu:** Giải quyết bài toán gắn kết đội ngũ, đặc biệt là nhóm thực tập sinh mới vào phòng ban, thông qua việc ứng dụng công nghệ để tự động hóa hoạt động làm quen (onboarding), tìm kiếm điểm chung (common ground) và trực quan hóa thế mạnh của team (skill map).

---

## I. BÁO CÁO NGHIÊN CỨU THỊ TRƯỜNG & ĐỀ XUẤT GIẢI PHÁP

### 1. Bối cảnh & Nỗi đau của phòng ban (Problem Statement)
*   **Thực trạng**: Khi nhóm thực tập sinh mới (gồm 8 thành viên và 1 Mentor) gia nhập phòng ban, một thành viên trong nhóm đã chủ động kêu gọi mọi người tự giới thiệu bản thân thông qua group chat với bộ câu hỏi 9 tiêu chí (Tên, Năm sinh, Vai trò, Thế mạnh, Sở thích, Kỹ năng, Mục tiêu...). Tuy nhiên, kết quả nhận lại rất thấp: **chỉ có 1/8 thành viên trả lời**.
*   **Phân tích nguyên nhân**:
    *   **Rào cản tâm lý (Gen Z)**: Các bạn thực tập sinh mới thường e ngại khi phải viết một bài giới thiệu dài và gửi tin nhắn dạng text tĩnh vào group chat chung có cả sếp/mentor.
    *   **Trôi thông tin & Khó tra cứu**: Tin nhắn giới thiệu bị trôi nhanh trên chat nhóm, không đọng lại và rất khó tra cứu sau này khi cần tìm kiếm thông tin cá nhân hoặc kỹ năng của nhau.
*   **Hậu quả**: Team thiếu sự gắn kết (bonding) trong những tuần đầu, các thành viên hoạt động cô lập, Mentor mất nhiều thời gian để nắm bắt thế mạnh của từng bạn để phân chia công việc hợp lý.

### 2. So sánh giải pháp trên thị trường với Đề xuất Mini-app

Dưới đây là bảng so sánh chi tiết giữa các giải pháp gắn kết đội ngũ phổ biến trên thị trường và đề xuất xây dựng Mini-app tích hợp trực tiếp trên nền tảng nội bộ Mushy:

| Tiêu chí so sánh | Donut (Slack App) | Deel Roots (Slack/Teams) | Notion Directory | Đề xuất: Mushy Team Connect |
| :--- | :--- | :--- | :--- | :--- |
| **Cách tiếp cận** | Kết nối ngẫu nhiên 1-1 qua tin nhắn riêng (DMs), tự động đặt câu hỏi khơi gợi trò chuyện hàng tuần. | Vẽ sơ đồ tổ chức (Org Chart), gắn tag kỹ năng của thành viên, thông báo ngày kỷ niệm. | Tạo trang profile tĩnh dạng wiki/bảng để tra cứu thủ công. | **Hồ sơ cá nhân dạng thẻ trực quan** + **Bản đồ kỹ năng (Skill Map)** + **Tự động tìm điểm chung (Common Ground)**. |
| **Độ tương tác & Gắn kết** | Cao (thúc đẩy gặp mặt trực tiếp). | Trung bình (thiên về quản lý cấu trúc). | Thấp (chỉ đọc tĩnh, ít cập nhật). | **Cao** (Tự động tính toán điểm chung để tạo chủ đề bắt chuyện, hiển thị thế mạnh trực quan). |
| **Độ phức tạp cài đặt** | Trung bình (cần tích hợp Slack workspace). | Cao (cần kết nối hệ thống nhân sự HRIS + Slack). | Thấp (dùng mẫu template có sẵn). | **Cực kỳ đơn giản** (Chạy trực tiếp dưới dạng Mini-app trên app Mushy nội bộ của công ty). |
| **Chi phí bản quyền** | Đắt ($2 - $4 / user / tháng cho bản trả phí). | Rất đắt (Chỉ đi kèm gói dịch vụ quản lý HR tổng thể của Deel). | Miễn phí hoặc Rẻ (theo gói Notion doanh nghiệp). | **0 VNĐ** (Tận dụng hạ tầng cloud Supabase & Vercel miễn phí có sẵn của Mushy). |
| **Bản đồ thế mạnh (Skill Map)** | Không hỗ trợ. | Có hỗ trợ dạng danh sách tag tĩnh trong profile. | Có hỗ trợ dạng bảng/view lọc. | **Trực quan hóa bằng biểu đồ thống kê thế mạnh**, click lọc nhanh những ai có chung kỹ năng. |
| **Độ bảo mật** | Dữ liệu đẩy qua server bên thứ ba (Donut). | Dữ liệu quản lý bởi Deel. | Nằm trên workspace Notion chung. | **An toàn tuyệt đối** (Dữ liệu nằm trong schema biệt lập `app_skill_map` của dự án). |

### 3. Đánh giá chi tiết các đối thủ chính
*   **Donut (Slack App)**: Rất mạnh trong việc kết nối ngẫu nhiên để uống cafe. Tuy nhiên, bản miễn phí của Donut bị giới hạn số lượng thành viên và số lượt ghép đôi. Để dùng cho tổ chức có phân quyền hoặc tùy biến câu hỏi thì phải mua bản Pro với chi phí khá cao ($2 - $4/user/tháng). Với quy mô phòng ban nhỏ, việc trả chi phí duy trì hàng tháng chỉ để ghép đôi cafe là không tối ưu.
*   **Deel Roots**: Phù hợp cho các doanh nghiệp lớn cần quản lý Org Chart và onboarding nhân viên quy mô lớn. Đối với một phòng ban hoặc một nhóm thực tập sinh nhỏ, công cụ này quá cồng kềnh và đắt đỏ.
*   **Notion Team Directory**: Đơn giản, dễ làm nhưng nhanh chóng bị lãng quên (bản chất là trang tĩnh "shelfware"). Theo nghiên cứu hành vi nhân sự, nhân viên thường chỉ vào điền thông tin một lần lúc Onboarding rồi không bao giờ mở lại, vì trang Notion không có cơ chế chủ động tìm điểm chung hay nhắc nhở động, khiến thông tin nhanh chóng bị lỗi thời.

### 4. Đề xuất lựa chọn: Xây dựng Mini-app "Mushy Team Connect"
Xây dựng một Mini-app nội bộ tinh giản là giải pháp tối ưu nhất cho bài toán của phòng ban vì:
*   **Chi phí phát triển và vận hành bằng 0**: Tận dụng nền tảng Mini-app Mushy sẵn có của công ty.
*   **Giảm thiểu rào cản giới thiệu**: Thay vì viết bài dài, các thành viên chỉ cần chọn nhanh các thẻ Tag (Kỹ năng, Sở thích) và Emoji đại diện.
*   **Tập trung vào giá trị thực chất**: Bỏ qua các tính năng tương tác mạng xã hội phức tạp (như thả tim, đập tay, mời cafe có thể gây loãng app), tập trung hoàn toàn vào 3 cốt lõi: **Hồ sơ thành viên đẹp đẽ**, **Bảng tìm điểm chung (Common Ground)** để tự kết nối, và **Bản đồ kỹ năng (Skill Map)** để trao đổi công việc.
*   **Hỗ trợ đắc lực cho Mentor**: Mentor dễ dàng nhìn vào "Bản đồ kỹ năng" của cả nhóm để biết được thế mạnh chung, phân chia công việc hợp lý.

### 5. Kế hoạch giải quyết rủi ro sử dụng (User Adoption Risk & Mitigation)
Để đảm bảo tất cả 8 bạn thực tập sinh đều điền thông tin trên app (thay vì phớt lờ như trên group chat), chúng tôi áp dụng các biện pháp:
*   **Trải nghiệm nhanh & trực quan**: Quy trình tạo hồ sơ thiết kế tối giản chỉ mất dưới 2 phút với các ô nhập liệu dạng Tag chọn nhanh.
*   **Mentor làm gương (Lead by Example)**: Mentor sẽ điền hồ sơ đầu tiên với những nội dung cởi mở, gần gũi, lựa chọn các sở thích ngoài công việc thú vị và emoji vui nhộn để tạo bầu không khí thoải mái cho thực tập sinh.
*   **Tích hợp vào hoạt động onboarding**: App sẽ được mở trực tiếp trong buổi họp làm quen đầu tiên (Ice-breaking session), yêu cầu mọi người dành ra 5 phút mở app Mushy để cập nhật thông tin và cùng xem điểm chung của nhau ngay lập tức.

### 6. Chỉ số đo lường hiệu quả thành công (KPIs & Success Metrics)
Mức độ hiệu quả của dự án sẽ được báo cáo định lượng qua các chỉ số:
*   **Tỷ lệ hoàn thành hồ sơ (Profile Completion Rate)**: Đạt 100% (9/9 thành viên trong workspace hoàn thành cập nhật hồ sơ cá nhân trong 3 ngày đầu triển khai).
*   **Tần suất tra cứu (Retention & Activity)**: Đạt ít nhất 2 lượt truy cập/thành viên/tuần trong giai đoạn làm quen để tìm hiểu thông tin và tìm kiếm kỹ năng đồng nghiệp.

### 7. Ước tính nguồn lực & Thời gian triển khai (Timeline & Resources)
Nhờ tinh giản tính năng tương tác thừa và tận dụng hạ tầng có sẵn của Mushy, dự án ước tính triển khai trong **2 ngày làm việc** với **1 lập trình viên**:
*   **Ngày 1**: Thiết kế & cấu trúc Database (bảng SQL), cài đặt RLS bảo mật và submit migration. Xây dựng Form nhập liệu hồ sơ thông minh (`ProfileEditModal`) và giao diện Thẻ thành viên (`MemberCard`).
*   **Ngày 2**: Phát triển bộ lọc tìm điểm chung (`CommonGround`), Tab Bản đồ kỹ năng (`SkillMapTab`), tối ưu hóa hiển thị giao diện trên điện thoại và tiến hành kiểm thử nghiệm thu.

### 8. Khả năng mở rộng & Giá trị lâu dài cho tổ chức (Scalability)
*   **Không tốn thêm chi phí**: App được thiết kế theo cấu trúc phân vùng dữ liệu theo Workspace của Mushy. Nếu chạy thử nghiệm thành công cho nhóm thực tập sinh này, chúng ta chỉ cần chuyển visibility của app sang **Public** trên Admin Portal. Bất kỳ phòng ban nào khác cũng có thể kích hoạt sử dụng ngay lập tức mà không tốn công phát triển lại.

---

## II. DANH SÁCH & Ý TƯỞNG CÁC TÍNH NĂNG TRIỂN KHAI (PRODUCT FEATURES)

Dưới đây là bảng tổng hợp phạm vi các tính năng sẽ được phát triển trong dự án để sếp dễ dàng đánh giá:

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

## V. KẾ HOẠCH XÁC THỰC (VERIFICATION PLAN)

### 1. Kiểm thử thủ công trên môi trường Local
*   **Tạo mới hồ sơ**: Mở app, bấm tạo hồ sơ cá nhân và kiểm tra dữ liệu lưu thành công vào Supabase.
*   **Giả làm thành viên**: Chạy script tạo dữ liệu mẫu (seed data) giả lập hồ sơ của 8 thực tập sinh khác để xem giao diện hiển thị danh sách thẻ.
*   **Kiểm tra điểm chung**: Xác nhận màn hình hiển thị đúng các dòng thông báo điểm chung (ví dụ: cùng sở thích, cùng kỹ năng).
*   **Kiểm tra lọc kỹ năng**: Bấm vào tab "Skill Map", click vào một kỹ năng và xem danh sách hiển thị đúng người.

### 2. Kiểm thử trên môi trường Staging/Preview
*   Push code lên branch `dev` để Vercel tự động build link Preview.
*   Bật **Chế độ phát triển (Dev Mode)** trên app Mushy trên điện thoại, truy cập mini-app và kiểm tra giao diện hiển thị mượt mà trên WebView native shell.
