> **Lưu trữ.** Đây là bản v1.0 của project brief, giữ nguyên văn để tham chiếu lịch sử. Bản hiện hành: [project-brief.md](../project-brief.md) (v1.1).

# PROJECT BRIEF: HỆ SINH THÁI AI COMPANION CÁ NHÂN HÓA DỰA TRÊN TRI THỨC TỬ VI

**Mã dự án (dự kiến):** ASTRO-COMPANION (hoặc tên thương mại do bạn chọn)
**Phiên bản:** 1.0
**Ngày lập:** 2026

---

## 1. VISION (Tầm nhìn)

**Tầm nhìn:** Kiến tạo một hệ thống AI Companion **chủ động, thấu hiểu và tôn trọng quyền riêng tư**, đóng vai trò là "người bạn đồng hành tri thức" của mỗi cá nhân. Hệ thống không chỉ phản ứng với câu hỏi (reactive) mà còn **tự cảm nhận trạng thái, chủ động đưa ra lời khuyên và hỗ trợ ra quyết định** trong các khía cạnh thiết yếu của đời sống (sức khỏe, sự nghiệp, các mối quan hệ).

**Sứ mệnh:** Kết hợp sức mạnh của **trí tuệ nhân tạo hiện đại (LLM, Agentic AI)** với **tri thức tiên nghiệm hàng trăm năm của hệ thống Tử vi** để tạo ra một giải pháp cá nhân hóa **không xâm phạm quyền riêng tư** (privacy-by-default), giải quyết bài toán cold-start mà các hệ thống AI thuần túy dữ liệu đang gặp phải.

**Giá trị cốt lõi:**
- **Chủ động (Proactive):** Không chờ người dùng hỏi, mà chủ động phát hiện và hỗ trợ dựa trên chu kỳ và trạng thái.
- **Tối giản dữ liệu (Minimal-Data):** Ưu tiên vận hành với dữ liệu tối thiểu (ngày giờ sinh + prior), chỉ mở rộng thu thập khi người dùng cho phép.
- **Minh bạch và có thể kiểm soát (Transparent & Controllable):** Người dùng hiểu rõ AI đang dựa trên cơ sở nào để đưa ra gợi ý, và có quyền ghi đè, thu hồi.
- **Bản địa hóa (Localized):** Tận dụng hệ tri thức Tử vi Việt Nam làm nền tảng prior, tạo sự khác biệt so với các sản phẩm quốc tế.

---

## 2. REQUIREMENTS (Yêu cầu)

### 2.1. Yêu cầu chức năng (Functional Requirements)

| STT | Yêu cầu | Mô tả chi tiết | Độ ưu tiên |
|-----|---------|----------------|-------------|
| F1 | **Thu thập dữ liệu tối thiểu** | Người dùng cung cấp ngày, giờ, giới tính (hoặc thông tin cần thiết để lập lá số). Hệ thống tạo lá số tự động. | Bắt buộc (P0) |
| F2 | ** viXây dựng "Lớp Prior" (Tử Ontology)** | Hệ thống hóa tri thức tử vi thành cấu trúc dữ liệu có thể truy vấn (cung, sao, chu kỳ, tương tác). | Bắt buộc (P0) |
| F3 | **Chế độ Minimal-Data Companion** | AI đưa ra gợi ý, nhận định dựa trên prior (lá số) và một vài câu hỏi làm quen ban đầu. | Bắt buộc (P0) |
| F4 | **Cơ chế cập nhật Bayesian** | Hành vi, phản hồi thực tế của người dùng sẽ điều chỉnh dần "chân dung" AI có về họ (vượt qua prior). | Quan trọng (P1) |
| F5 | **Chủ động can thiệp theo ngữ cảnh** | AI tự phát hiện thời điểm phù hợp (dựa trên chu kỳ tử vi + dữ liệu hành vi) để chủ động hỏi thăm, nhắc nhở, hoặc gợi ý. | Quan trọng (P1) |
| F6 | **Phân tầng dữ liệu (Data Tiers)** | Cho phép người dùng chọn mức độ: Minimal (chỉ prior) → Hybrid (prior + hành vi) → Full-context (thêm sinh lý, quan hệ). | Quan trọng (P1) |
| F7 | **Báo cáo và Giải thích** | Khi AI đưa ra gợi ý, có thể giải thích ngắn gọn: "Dựa trên chu kỳ vận hạn của bạn, giai đoạn này phù hợp để..." | Bắt buộc (P0) |
| F8 | **Quản lý quyền riêng tư** | Người dùng có thể xem, sửa, xóa dữ liệu. Có nhật ký kiểm toán (audit log) các lần AI chủ động can thiệp. | Bắt buộc (P0) |

### 2.2. Yêu cầu phi chức năng (Non-Functional Requirements)

| STT | Yêu cầu | Mô tả chi tiết |
|-----|---------|----------------|
| NF1 | **Bảo mật & Quyền riêng tư** | Mã hóa dữ liệu end-to-end. Tuân thủ các quy định về bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP tại Việt Nam, tham chiếu GDPR). |
| NF2 | **Hiệu năng** | Thời gian phản hồi của AI Companion < 2 giây cho các tác vụ thông thường. |
| NF3 | **Khả năng mở rộng** | Kiến trúc microservices, cho phép tích hợp thêm các module (sức khỏe, tài chính) sau này. |
| NF4 | **Tính minh bạch** | Không sử dụng ngôn ngữ khẳng định tuyệt đối ("bạn sẽ..."). Luôn dùng ngôn ngữ xác suất, trao quyền quyết định cho người dùng. |
| NF5 | **Khả năng tiếp cận** | Giao diện thân thiện, hỗ trợ tiếng Việt là ngôn ngữ chính. |

---

## 3. KEY COMPONENTS (Thành phần chính)

Hệ thống được thiết kế theo kiến trúc **3 lớp + 1 lõi**:

### 3.1. Lõi Tri thức (Knowledge Core) — "Bộ não Prior"
- **Tử vi Ontology Engine:** Cơ sở dữ liệu có cấu trúc về các cung, sao, can chi, ngũ hành, và các quy tắc tương tác. Đây là nơi số hóa tri thức trăm năm.
- **Astro-Calculation Module:** Module tính toán lá số từ ngày/giờ sinh, xác định các chu kỳ vận hạn.
- **Prior Generator:** Chuyển đổi lá số thành các "giả thuyết" về tính cách, xu hướng, thời điểm nhạy cảm — làm đầu vào cho AI.

### 3.2. Lõi AI (AI Core) — "Bộ não Động"
- **LLM Integration Layer:** Kết nối với mô hình ngôn ngữ lớn (có thể là API bên thứ ba hoặc mô hình tự huấn luyện).
- **Bayesian Update Engine:** Cơ chế cập nhật niềm tin: Prior (tử vi) + Likelihood (hành vi thực) → Posterior (chân dung cập nhật).
- **Proactive Decision Engine:** Dựa trên khung 6A (UIUC/Google), quyết định "có nên can thiệp không, khi nào, bằng cách nào".
- **Explanation Module:** Sinh ra lời giải thích ngắn gọn, dễ hiểu cho mỗi gợi ý.

### 3.3. Lớp Tương tác (Interaction Layer) — "Giao diện Người dùng"
- **Conversational UI:** Giao diện chat tự nhiên (mobile app, web app).
- **Proactive Notification System:** Hệ thống thông báo thông minh (không spam, có ngữ cảnh).
- **Privacy Dashboard:** Nơi người dùng xem, kiểm soát dữ liệu và mức độ can thiệp của AI.

### 3.4. Lớp Dữ liệu & Hạ tầng (Data & Infrastructure)
- **Secure Data Vault:** Lưu trữ dữ liệu mã hóa, phân quyền truy cập.
- **Audit Log System:** Ghi lại mọi lần AI chủ động can thiệp để người dùng có thể tra cứu.
- **API Gateway:** Cho phép tích hợp với các dịch vụ bên thứ ba (trong tương lai).

---

## 4. SCOPE (Phạm vi)

### 4.1. Trong phạm vi (In-Scope) — Giai đoạn 1 (Năm đầu tiên 2026-2027)

- **Nghiên cứu và số hóa:** Xây dựng Tử vi Ontology cho hệ tri thức Tử vi Việt Nam (ưu tiên các trường phái phổ biến, có tính chuẩn hóa cao).
- **Phát triển Nguyên mẫu (Prototype):**
    - Ứng dụng mobile cơ bản (iOS/Android) hoặc web app.
    - Tính năng: Nhập ngày giờ sinh → Nhận lá số → Chat với AI Companion ở chế độ Minimal-Data.
    - AI đưa ra các nhận định ban đầu về tính cách, xu hướng, và 1-2 gợi ý hành động dựa trên prior.
- **Xây dựng Khung Đạo đức & Pháp lý:**
    - Bộ nguyên tắc đạo đức (Ethical Guidelines).
    - Khung ngôn ngữ (không khẳng định tuyệt đối, định vị tử vi là "khung tham chiếu văn hóa").
    - Đánh giá rủi ro pháp lý theo Nghị định 13/2023/NĐ-CP.
- **Kiểm chứng giả thuyết:** Đo lường cảm nhận "được hiểu" của người dùng so với chatbot thông thường.

### 4.2. Ngoài phạm vi (Out-of-Scope) — Giai đoạn 1

- **Chưa tích hợp dữ liệu sinh trắc học** (nhịp tim, giấc ngủ) từ thiết bị đeo.
- **Chưa có tính năng "hành động thay mặt"** (proxy) — ví dụ: tự động đặt lịch, đàm phán hợp đồng.
- **Chưa mở rộng ra thị trường quốc tế** (chỉ tập trung thị trường Việt Nam và cộng đồng người Việt hải ngoại).
- **Chưa xây dựng mô hình LLM riêng** (sử dụng API của bên thứ ba ở giai đoạn này).

### 4.3. Lộ trình mở rộng (Roadmap)

| Giai đoạn | Thời gian | Mục tiêu chính | Phạm vi mở rộng |
|-----------|-----------|----------------|-----------------|
| **Giai đoạn 1** | 2026-2027 | Nghiên cứu & Nguyên mẫu | Minimal-Data Companion, Tử vi Ontology cơ bản |
| **Giai đoạn 2** | 2028-2032 | Thử nghiệm & Tích hợp | Bayesian Update, Chủ động can thiệp, Chế độ Hybrid, Thử nghiệm trên 1 kịch bản giá trị cao (ví dụ: Quan hệ) |
| **Giai đoạn 3** | 2033-2044 | Phổ cập & Tiến hóa | Full-context (thêm sinh lý, quan hệ), Hành động thay mặt có ủy quyền, Mở rộng quốc tế |

---

## 5. RỦI RO VÀ BIỆN PHÁP GIẢM THIỂU (Risks & Mitigations)

| Rủi ro | Mức độ | Biện pháp giảm thiểu |
|--------|--------|---------------------|
| **Rủi ro pháp lý:** Bị coi là "dự đoán khoa học không có căn cứ" | Cao | Định vị rõ là "khung tham chiếu văn hóa"; sử dụng ngôn ngữ xác suất; tham vấn luật sư về Nghị định 13. |
| **Rủi ro đạo đức:** AI áp đặt bản sắc cố định lên người dùng | Trung bình | Thiết kế cơ chế "prior có thể ghi đè"; người dùng luôn có quyền phủ định gợi ý. |
| **Rủi ro kỹ thuật:** Số hóa tử vi gặp mâu thuẫn giữa các trường phái | Trung bình | Chọn 1-2 trường phái chính làm chuẩn; ghi rõ nguồn gốc; xây dựng cơ chế "phiên bản" cho ontology. |
| **Rủi ro thị trường:** Người dùng không tin tưởng vì yếu tố tâm linh | Trung bình | Định vị là "công cụ tự khám phá bản thân" (self-discovery tool) kết hợp AI; tập trung vào giá trị trải nghiệm, không phải "bói toán". |
| **Rủi ro cạnh tranh:** Các ông lớn (Meta, OpenAI) tung ra sản phẩm tương tự | Cao | Lợi thế cạnh tranh nằm ở **tính bản địa hóa (Tử vi Việt Nam)** và **kiến trúc minimal-data** — điều các sản phẩm toàn cầu khó làm. |

---

## 6. CHỈ SỐ THÀNH CÔNG (KPIs) — Giai đoạn 1

- **KPI1:** Hoàn thành số hóa Tử vi Ontology với tối thiểu 80% các khái niệm cốt lõi.
- **KPI2:** Nguyên mẫu đạt được 100 người dùng thử nghiệm, với điểm "cảm nhận được hiểu" (Perceived Understanding) ≥ 4/5.
- **KPI3:** 100% các gợi ý của AI có Explanation Module đi kèm.
- **KPI4:** Khung đạo đức và pháp lý được thông qua bởi ít nhất 1 chuyên gia độc lập.

---

## 7. ĐỘI NGŨ VÀ NGUỒN LỰC (Team & Resources)

- **Nhân sự chủ chốt:**
    - 01 Project Lead / Product Owner.
    - 01 Chuyên gia về Tử vi / Văn hóa học (để số hóa tri thức).
    - 01-02 Kỹ sư AI/ML (LLM, Bayesian).
    - 01 Kỹ sư Backend / Data Engineer.
    - 01 Chuyên gia về Đạo đức AI / Pháp lý.
    - 01 UI/UX Designer.
- **Nguồn lực công nghệ:** API LLM (OpenAI/Anthropic/Google), Cloud infrastructure (AWS/GCP/Azure), Database (PostgreSQL + Vector DB).

---

*Tài liệu này là bản nháp đầu tiên (Draft 1.0). Các mục cần được thảo luận và tinh chỉnh thêm với các bên liên quan trước khi chuyển sang giai đoạn lập kế hoạch chi tiết (Detailed Planning).*
