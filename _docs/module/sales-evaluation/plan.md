# ระบบประเมินและสนับสนุนพนักงานขาย (Sales Evaluation & Enablement) — Implementation Plan

## Plan Summary

โปรเจกต์นี้ **ยังไม่ได้ scaffold เลย** (ไม่มี `package.json` / `prisma/` / `app/`) ดังนั้นก่อน Phase 1 ต้องรัน `setup` agent ก่อนเพื่อสร้างโครง Next.js (`web/`) + Express (`api/`) + Prisma + PostgreSQL + `.env` + seed ค่าเริ่มต้น (`EvaluationSetting` singleton, `ScoringWeight` 5 แถว, บัญชีผู้จัดการอย่างน้อย 2 บัญชีตามความเสี่ยงข้อ 12 ใน `design.md`) — งานนี้ไม่ได้ tag `[frontend]`/`[backend]` เพราะเป็นงานของ `setup` agent ไม่ใช่ engineer สองตัวนี้

แผนแบ่งเป็น 8 เฟส ตรงกับ module A–H ใน `design.md` เรียงตาม dependency ที่ยืนยันแล้ว: **A(setup) → B(auth) → C(import) → D(targets) → E(KPI engine) → F/G(dashboards+AI ขนานกัน) → H(reports)**. Module I (Cross-sell) ไม่อยู่ในแผนนี้เพราะรอข้อมูลสะสม 6–12 เดือน ไม่ใช่ dependency ของโค้ด

ลำดับนี้ตรงข้ามกับลำดับความสำคัญทางธุรกิจที่ผู้ใช้อยากได้ที่สุด (ชี้จุดอ่อน + coaching) แต่ผู้ใช้ยืนยันแล้วว่ายอมรับลำดับตาม dependency เพราะ KPI/coaching คำนวณไม่ได้จนกว่าจะมีข้อมูล (C) และเป้า (D) อยู่ในระบบก่อน Phase F และ G ทำขนานกันได้เพราะทั้งคู่ขึ้นกับ E เท่านั้นและไม่ขึ้นกับกันเอง — มอบให้ทั้ง frontend/backend engineer พร้อมกันได้ถ้าทรัพยากรพอ

## Phase 0: Scaffold (ไม่ใช่ frontend/backend engineer)
- [ ] [setup] รัน `setup` agent เพื่อสร้างโครงโปรเจกต์: Next.js App Router ใน `web/`, Express + TypeScript ใน `api/`, Prisma + PostgreSQL, `.env`/`.env.example`, `.gitignore`
- [ ] [setup] เขียน `prisma/schema.prisma` ตาม Data Model ใน `design.md` ทั้งหมด (17 models / 8 enums) แล้วรัน migration แรก
- [ ] [setup] Seed ข้อมูลเริ่มต้น: `EvaluationSetting` singleton (`id = "singleton"`, ค่า default ตาม schema), `ScoringWeight` ครบ 5 แถว (50/15/15/10/10), บัญชีผู้จัดการอย่างน้อย **2 บัญชี** (ความเสี่ยงข้อ 12 — ป้องกันกรณีไม่มีใครรีเซ็ตรหัสผ่านให้กันได้)

## Phase 1: Auth & User Management (Module B)
- [x] [backend] Endpoint `POST /auth/login` — ตรวจอีเมล+รหัสผ่านด้วย `bcrypt`, คืน JWT, อัปเดต `User.lastLoginAt`
- [x] [backend] Middleware ตรวจ JWT (แนบ `req.user`) และ middleware ตรวจ role (`requireRole('MANAGER')`) สำหรับ route ที่ต้องเป็นผู้จัดการเท่านั้น
- [x] [backend] Endpoint `POST /auth/change-password` — ผู้ใช้เปลี่ยนรหัสผ่านตัวเอง, เคลียร์ `mustChangePassword` เมื่อสำเร็จ
- [x] [backend] Endpoint `GET /users` (MANAGER เท่านั้น) — รายชื่อผู้ใช้ทั้งหมด
- [x] [backend] Endpoint `POST /users` (MANAGER เท่านั้น) — สร้างบัญชีใหม่ (email, displayName, role), ตั้ง `mustChangePassword = true` เริ่มต้น, สุ่ม/ตั้งรหัสผ่านชั่วคราว
- [x] [backend] Endpoint `PATCH /users/:id` (MANAGER เท่านั้น) — แก้ `isActive`, `displayName`, role, ผูก/แก้ `Salesperson.userId`
- [x] [backend] Endpoint `POST /users/:id/reset-password` (MANAGER เท่านั้น) — ผู้จัดการรีเซ็ตรหัสผ่านให้ผู้ใช้อื่น, ตั้ง `mustChangePassword = true`
- [x] [backend] Zod schemas สำหรับ body ของทุก endpoint ข้างต้น (login, change-password, create user, update user, reset password)
- [x] [frontend] หน้า Login (`/login`) — ฟอร์มอีเมล/รหัสผ่าน, เก็บ JWT ใน Zustand store + storage ฝั่ง client, redirect ตาม role หลัง login สำเร็จ
- [x] [frontend] Zustand store สำหรับ auth state (`useAuthStore`) — user ปัจจุบัน, token, login/logout actions
- [x] [frontend] Route guard/wrapper (Next.js middleware หรือ layout check) — เด้งไปหน้า login ถ้าไม่มี token ที่ valid
- [x] [frontend] หน้าบังคับเปลี่ยนรหัสผ่านครั้งแรก — แสดงเมื่อ `mustChangePassword = true`, บล็อกไม่ให้ใช้หน้าอื่นจนกว่าจะเปลี่ยน
- [x] [frontend] หน้าเปลี่ยนรหัสผ่านตัวเอง (ในหน้าตั้งค่าบัญชี)
- [x] [frontend] หน้าจัดการบัญชีผู้ใช้ (MANAGER เท่านั้น) — ตาราง list, ฟอร์มสร้างบัญชีใหม่, ปิดใช้งาน/เปิดใช้งาน, ปุ่มรีเซ็ตรหัสผ่าน, ผูกกับ `Salesperson`
- [x] [frontend] หน้า Dashboard เปล่า/placeholder เป็นหน้าแรกหลัง login (เนื้อหาจริงมาใน Phase 5) — แค่ยืนยันว่า route หลัง login ทำงานถูกต้องตาม role

## Phase 2: Excel Import & Master Data (Module C)
- [x] [backend] เพิ่ม dependency `exceljs` และ `multer`
- [x] [backend] Endpoint `POST /import` (MANAGER เท่านั้น) — รับไฟล์ผ่าน `multer`, สร้าง `ImportBatch` (`status = PROCESSING`)
- [x] [backend] Service สแกน sheet ทั้งหมดในไฟล์ — นำเข้าเฉพาะ sheet แรก, บันทึกชื่อ sheet อื่นเป็น `ImportIssue` ระดับ `WARNING` รหัส `SHEET_IGNORED`
- [x] [backend] Service หา header row ใน 10 แถวแรกของ sheet แรก (เทียบชื่อคอลัมน์แบบไม่สนตัวพิมพ์/trim) — ถ้าไม่พบ ยกเลิกทั้งไฟล์ `status = FAILED`, `ImportIssue` รหัส `HEADER_NOT_FOUND`
- [x] [backend] Service parse แต่ละแถว: แปลง Excel date serial → `Date` (`Inv Date`), map คอลัมน์ตามตาราง Column Mapping ใน `design.md`
- [x] [backend] Service validate ตามกฎครบทุก code: `MISSING_REQUIRED`, `INVALID_NUMBER`, `INVALID_DATE`, `AMOUNT_RECOMPUTED`, `TOTAL_MISMATCH`, `DATE_PERIOD_MISMATCH`, `NEGATIVE_AMOUNT`, `UNKNOWN_SALESMAN`, `NEW_HOSPITAL`
- [x] [backend] Service สร้าง `rowKey` = `"{invoiceNo}|{productName}|{lot}|{occurrenceIndex}"` พร้อมนับ `occurrenceIndex` ตามลำดับแถวภายในไฟล์เดียวกัน
- [x] [backend] Service auto-create `Hospital`/`Salesperson`/`Product`/`ProductType` ที่ยังไม่มี (พร้อม `WARNING` ตามที่กำหนด) และ denormalize `SalesLine.productTypeId` ให้ตรงกับ `Product.productTypeId` เสมอ
- [x] [backend] Service upsert `SalesLine` ตาม `rowKey` ในทรานแซกชันเดียวต่อไฟล์ทั้งหมด (rollback ทั้งชุดถ้าล้มกลางคัน, ตั้ง `status = FAILED`)
- [x] [backend] หลัง import สำเร็จ: อัปเดต `ImportBatch` (`totalRows`, `insertedRows`, `updatedRows`, `skippedRows`, `errorRows`, `periodsTouched`, `status = SUCCESS/PARTIAL`) และตั้ง `CoachingInsight.isStale = true` สำหรับทุกงวด (เดือน/ไตรมาส/ปี) ที่อยู่ใน `periodsTouched`
- [x] [backend] Endpoint `GET /import-batches` — ประวัติการนำเข้าทั้งหมด, `GET /import-batches/:id` — รายละเอียดรวมถึง `ImportIssue` ทั้งหมดของ batch นั้น
- [x] [backend] Endpoint `GET /sales-lines` — list พร้อม filter (salesperson/hospital/period/productType) + pagination ฝั่ง server
- [x] [backend] Endpoint `GET /salespeople` และ `PATCH /salespeople/:id` — ผูก `Salesperson.userId` กับบัญชี (MANAGER เท่านั้นแก้ได้)
- [x] [backend] Endpoint `GET /hospitals` และ `PATCH /hospitals/:id` — แก้ `isPreExistingCustomer` (MANAGER เท่านั้น)
- [x] [backend] Zod schemas สำหรับ query ของ `/sales-lines` filter/pagination และ body ของ PATCH endpoints
- [x] [frontend] หน้าอัปโหลดไฟล์ Excel (MANAGER เท่านั้น) — drag-drop/file picker, progress state, เรียก `POST /import`
- [x] [frontend] หน้ารายงานผลการนำเข้า — สรุปตัวเลข (insertedRows/updatedRows/skippedRows/errorRows), ตาราง `ImportIssue` รายบรรทัดพร้อม filter ตาม level
- [x] [frontend] หน้าประวัติการนำเข้า (`GET /import-batches`) — list พร้อมลิงก์ไปหน้ารายละเอียดแต่ละ batch
- [x] [frontend] หน้าตรวจดูข้อมูลการขาย (`GET /sales-lines`) — ตาราง + filter (พนักงานขาย/โรงพยาบาล/ช่วงเวลา/กลุ่มสินค้า) + pagination
- [x] [frontend] หน้าจัดการ master data — ผูกชื่อพนักงานขายกับบัญชีผู้ใช้, ติ๊ก `isPreExistingCustomer` ให้โรงพยาบาล (MANAGER เท่านั้นแก้ได้ ผู้อื่นดูได้อย่างเดียว)

## Phase 3: Targets (Module D)
- [x] [backend] Endpoint `GET /targets` — ดึงเป้าทั้งทีมทั้งปี (query ตาม year), รวม `TargetProductGroup`
- [x] [backend] Endpoint `PUT /targets/:salespersonId/:year/:month` (MANAGER เท่านั้น) — upsert เป้ารายคนรายเดือน (revenueTarget, newCustomerTarget), บันทึก `TargetRevision` (`before`/`after` snapshot, `changeType`) ทุกครั้งที่แก้
- [x] [backend] Endpoint `PUT /targets/:targetId/product-groups` (MANAGER เท่านั้น) — ตั้ง/แก้เป้ากลุ่มสินค้าเฉพาะกลุ่มที่เลือก (`TargetProductGroup`), บันทึก revision
- [x] [backend] Endpoint `POST /targets/copy` (MANAGER เท่านั้น) — คัดลอกเป้าจากเดือนก่อนหน้ามาสร้างเดือนใหม่ทั้งทีม
- [x] [backend] Endpoint `GET /targets/:targetId/revisions` — ประวัติการแก้ไขของเป้ารายการเดียว
- [x] [backend] Zod schemas สำหรับ target upsert body, product-group target body, copy-target body
- [x] [frontend] หน้าตั้งเป้าแบบตารางทั้งทีมทั้งปีในหน้าเดียว (MANAGER เท่านั้นแก้ได้ — คนอื่นดูอย่างเดียว) — แถวต่อพนักงานขาย, คอลัมน์ต่อเดือน, inline edit สำหรับ revenueTarget/newCustomerTarget
- [x] [frontend] ปุ่ม/action "คัดลอกเป้าเดือนก่อน" ในหน้าตั้งเป้า
- [x] [frontend] หน้า/modal ตั้งเป้ากลุ่มสินค้าต่อคนต่อเดือน — เลือกเฉพาะกลุ่มที่ต้องการผลักดัน
- [x] [frontend] หน้าดูประวัติการแก้ไขเป้า — แสดง before/after, ใครแก้, เมื่อไหร่

## Phase 4: KPI & Scoring Engine (Module E)
- [x] [backend] Service คำนวณ `REVENUE_VS_TARGET` ต่อคนต่องวด (เดือน/ไตรมาส/ปี) ตามนิยามใน KPI & Scoring Rules
- [x] [backend] Service คำนวณ `NEW_CUSTOMERS` — นับโรงพยาบาลที่ขายครั้งแรกในระบบตกในงวดนี้ และ `isPreExistingCustomer = false`, ให้เครดิตกับพนักงานขายที่ทำรายการแรก
- [x] [backend] Service คำนวณ `PRODUCT_GROUP` — เฉพาะกลุ่มที่ตั้งเป้าไว้ ตัดยอดเกินรายกลุ่มก่อนรวม
- [x] [backend] Service คำนวณ `RETENTION` — เทียบโรงพยาบาลงวดก่อนหน้ากับงวดนี้, ตรวจ `dataCoverageMonths >= minMonthsForChurn` ก่อนคำนวณ ไม่งั้นคืนสถานะ "คำนวณไม่ได้"
- [x] [backend] Service คำนวณ `CONSISTENCY` — coefficient of variation ของยอดรายเดือนย้อนหลัง `minMonthsForConsistency` เดือน, ตรวจ `dataCoverageMonths` ก่อนคำนวณเช่นกัน
- [x] [backend] Service คำนวณ `dataCoverageMonths` (จำนวนคู่ year/month ที่ไม่ซ้ำใน `SalesLine`)
- [x] [backend] Service renormalize คะแนนรวม — เฉลี่ยน้ำหนักใหม่เฉพาะ metric ที่คำนวณได้, คืนจำนวน "X จาก 5 เกณฑ์" พร้อมเหตุผลของเกณฑ์ที่ถูกยกเว้น, ถ้าไม่มี metric ใดคำนวณได้เลยคืนสถานะ "ไม่มีคะแนนรวม" (ห้ามคืน 0)
- [x] [backend] Service คำนวณ KPI ประกอบ (ไม่คิดคะแนน): ลูกค้า active ในงวด, ลูกค้าที่หายไป (churn ตาม `churnMonths`), product penetration, สัดส่วนยอดตามโรงพยาบาล, แนวโน้มยอดรายเดือน — ทุกตัวต้องเชื่อมกลับไปยัง `SalesLine` ที่มาได้ (คืน id ที่ใช้ query drill-down)
- [x] [backend] Endpoint `GET /kpi/:salespersonId` — คะแนนรวม+แยกราย KPI ของคนเดียว ตาม period (month/quarter/year)
- [x] [backend] Endpoint `GET /kpi/team` — คะแนนของทุกคนในทีมสำหรับ period เดียวกัน (ใช้ทำ leaderboard/team overview)
- [x] [backend] Endpoint `GET /kpi/:salespersonId/drill-down/:metric` — รายการ `SalesLine`/ข้อมูลดิบที่เป็นที่มาของตัวเลข metric นั้น
- [x] [backend] Endpoint `GET /settings/scoring-weights` และ `PUT /settings/scoring-weights` (MANAGER เท่านั้น) — บันทึก `ScoringWeightRevision` ทุกครั้งที่แก้
- [x] [backend] Endpoint `GET /settings/evaluation` และ `PATCH /settings/evaluation` (MANAGER เท่านั้น) — แก้ `churnMonths`, `minMonthsForChurn`, `minMonthsForConsistency`, `aiEnabled`, `aiAnonymize`
- [x] [backend] Zod schemas สำหรับ scoring-weight update body และ evaluation-setting update body
- [x] [frontend] หน้าตั้งค่าน้ำหนักคะแนน (MANAGER เท่านั้น) — ปรับน้ำหนัก 5 เกณฑ์, validate รวมกันครบ, แสดงประวัติการแก้
- [x] [frontend] หน้าตั้งค่าคงที่ของการประเมิน (MANAGER เท่านั้น) — `churnMonths`, `minMonthsForConsistency`, สวิตช์ `aiEnabled`/`aiAnonymize`
- [x] [frontend] Component แสดงคะแนนรวม + badge "คิดจาก X จาก 5 เกณฑ์" พร้อม tooltip/รายการเกณฑ์ที่ถูกยกเว้นและเหตุผล — ใช้ซ้ำได้ทั้ง dashboard/leaderboard/report
- [x] [frontend] Component drill-down (modal/expandable) ที่พาไปดูรายการ `SalesLine` ที่เป็นที่มาของแต่ละ KPI

## Phase 5: Dashboards & Leaderboard (Module F)
- [x] [backend] เพิ่มเติม endpoint `GET /kpi/:salespersonId/trend` — แนวโน้มยอดรายเดือนย้อนหลัง (สำหรับกราฟ) ถ้ายังไม่ครอบคลุมจาก Phase 4
- [x] [backend] Endpoint `GET /leaderboard` — รับ query `criteria` (คะแนนรวม/% ทำได้ตามเป้า/ยอดขาย/ลูกค้าใหม่) และ `period` (เดือน/ไตรมาส/ปี), คืน list เรียงลำดับพร้อมชื่อจริง
- [x] [backend] Zod schema สำหรับ query ของ `/leaderboard`
- [x] [frontend] เพิ่ม dependency `recharts`
- [x] [frontend] หน้า Dashboard ส่วนตัว — ยอดสะสมเดือน/ไตรมาส/ปีเทียบเป้า + "เหลืออีกเท่าไหร่ถึงเป้า"
- [x] [frontend] กราฟแนวโน้มยอดรายเดือนย้อนหลัง (`recharts`)
- [x] [frontend] กราฟสัดส่วนยอดตามกลุ่มสินค้า และตามโรงพยาบาล
- [x] [frontend] Component แสดง KPI แต่ละตัวเทียบเป้าและเทียบค่าเฉลี่ยทีม (reuse component คะแนน+badge จาก Phase 4)
- [x] [frontend] ตัวสลับดูมุมมองของพนักงานขายคนอื่น (dropdown เลือกคน — ทุก role เห็นได้)
- [x] [frontend] หน้า Leaderboard — ตาราง/การ์ดจัดอันดับ, ตัวสลับเกณฑ์ (4 แบบ) และช่วงเวลา (เดือน/ไตรมาส/ปี)
- [ ] [frontend] ปรับ responsive ทุกหน้า Dashboard/Leaderboard สำหรับมือถือ (Tailwind breakpoints) — ⚠️ Partial, ดู `review.md`

## Phase 6: AI Coaching Insights (Module G)
- [x] [backend] Service ประกอบ payload สรุป KPI สำหรับส่งให้ AI — ใช้เฉพาะผลสรุปเชิงตัวเลขที่คำนวณเสร็จในระบบแล้ว (ไม่ส่งข้อมูลดิบ)
- [x] [backend] Service ปิดบังชื่อ (เมื่อ `EvaluationSetting.aiAnonymize = true`) — แทนชื่อพนักงานขายด้วย "พนักงานขาย A", ชื่อโรงพยาบาลด้วย "โรงพยาบาล 1" ก่อนส่งออก
- [x] [backend] Service เรียก Gemini API พร้อม timeout, บันทึก payload จริงที่ส่งไปลง `CoachingInsight.kpiSnapshot` เพื่อให้ตรวจย้อนได้
- [x] [backend] Service fallback rule-based summary เมื่อเรียก Gemini ไม่สำเร็จ (`status = FAILED`, `errorMessage` บันทึกไว้) — หน้าจอต้องยังแสดง KPI ปกติได้
- [x] [backend] Endpoint `POST /coaching-insights/:salespersonId/generate` (MANAGER เท่านั้น หรือทั้งสอง role — ตรวจ requirement) — รับ `periodType`/`year`/`periodNumber`, สร้าง/regenerate insight (เคารพ unique constraint), เคลียร์ `isStale`
- [x] [backend] Endpoint `GET /coaching-insights/:salespersonId` — ดึง insight ล่าสุดตาม period, คืน `isStale` flag
- [x] [backend] สวิตช์ `aiEnabled` — ถ้าปิด ให้ endpoint generate คืน fallback rule-based ทันทีโดยไม่เรียก Gemini
- [x] [backend] เก็บ Gemini API key ใน `.env` (`GEMINI_API_KEY`), ห้ามหลุดไปฝั่ง client
- [x] [backend] Zod schema สำหรับ body ของ generate endpoint
- [x] [frontend] หน้า/section สรุปจุดแข็ง-จุดที่ควรพัฒนา ในหน้า Dashboard ส่วนตัว — แสดง `contentTh`, ป้าย "ข้อมูลอัปเดตแล้ว" เมื่อ `isStale = true`
- [x] [frontend] ปุ่ม "สร้างใหม่" (regenerate) เรียก `POST /coaching-insights/:salespersonId/generate`
- [x] [frontend] สถานะ loading/error ของการสร้าง insight — แสดง fallback message เมื่อ `status = FAILED` โดยไม่ให้หน้าพังหรือว่างเปล่า
- [x] [frontend] Drill-down จากข้อสรุป AI ไปยังตัวเลข KPI ที่มา (reuse component จาก Phase 4)
- [x] [frontend] หน้าตั้งค่า — สวิตช์เปิด/ปิด AI ทั้งระบบ (MANAGER เท่านั้น, ผูกกับ `EvaluationSetting.aiEnabled` ที่มี endpoint จาก Phase 4)

## Phase 7: Coaching Reports & Export (Module H)
- [x] [backend] Endpoint `GET /reports/individual/:salespersonId` — ประกอบข้อมูลรายงาน 1 หน้าต่อคนต่องวด (เป้า vs ผลจริง, KPI ทุกตัว, คะแนนรวม, จุดแข็ง/จุดที่ควรพัฒนาจาก `CoachingInsight`, เทียบงวดก่อน)
- [x] [backend] Endpoint `GET /reports/team-overview` — สรุปทั้งทีมในหน้าเดียว เรียงตามผู้ที่ควรได้รับการช่วยเหลือก่อน (เช่น เรียงตามคะแนนรวมต่ำสุด)
- [x] [backend] เพิ่ม dependency `exceljs` (ใช้ตัวเดียวกับ import) สำหรับสร้างไฟล์ export
- [x] [backend] Endpoint `GET /reports/individual/:salespersonId/export` — สร้างไฟล์ Excel รายบุคคล ส่งกลับเป็นไฟล์ดาวน์โหลด
- [x] [backend] Endpoint `GET /reports/team-overview/export` — สร้างไฟล์ Excel ภาพรวมทีม ส่งกลับเป็นไฟล์ดาวน์โหลด
- [x] [frontend] หน้ารายงานรายบุคคล — เป้า vs ผลจริง, KPI ทุกตัว, คะแนนรวม, จุดแข็ง/จุดที่ควรพัฒนา, เทียบงวดก่อน, เลือกงวดได้ (เดือน/ไตรมาส/ปี)
- [x] [frontend] หน้าภาพรวมทีมสำหรับผู้จัดการใช้ดูว่าใครควรได้รับการช่วยเหลือก่อน
- [x] [frontend] ปุ่ม Export Excel ในทั้งสองหน้า (รายบุคคล/ภาพรวมทีม) เรียก endpoint export และ trigger ดาวน์โหลดไฟล์

## Sequencing Notes

- **Phase 0 เป็น hard blocker** — ไม่มี Phase 1 ใดเริ่มได้จนกว่าโปรเจกต์จะ scaffold เสร็จ เพราะไม่มี `package.json`/`prisma/schema.prisma`/`app/` ให้แก้เลย
- **B ก่อน C**: การนำเข้าไฟล์และ master data ต้องรู้ว่าใครอัปโหลด (`ImportBatch.uploadedById`) และจำกัดสิทธิ์เฉพาะผู้จัดการ จึงต้องมี auth+role middleware ก่อน
- **C ก่อน D**: การตั้งเป้าอ้างอิง `ProductType` และรายชื่อ `Salesperson` ซึ่งถูกสร้างขึ้นตอน import เท่านั้น — ตั้งเป้าก่อนมีข้อมูลนำเข้าจะไม่มีตัวเลือกให้เลือก
- **C+D ก่อน E**: KPI engine อ่านทั้ง `SalesLine` (จาก C) และ `Target`/`TargetProductGroup` (จาก D) พร้อมกัน ขาดตัวใดตัวหนึ่งคำนวณไม่ได้
- **E ก่อน F และ G**: ทั้ง Dashboard/Leaderboard (F) และ AI coaching (G) เป็นแค่ชั้นแสดงผลของตัวเลขที่ E คำนวณไว้แล้ว — F และ G ไม่ขึ้นกับกันเอง จึงมอบให้ทำขนานกันได้ถ้ามีทรัพยากรพอ (เช่น backend engineer คนหนึ่งทำ F ต่อ อีกคนทำ G)
- **E+G ก่อน H**: รายงาน coaching ต้องมีทั้งตัวเลข KPI (E) และข้อความจุดแข็ง/จุดที่ควรพัฒนา (G) ก่อนจึงประกอบเป็นรายงาน 1 หน้าได้
- Module I (Cross-sell) ไม่อยู่ในแผนนี้เลย — เป็น dependency ของข้อมูลสะสม 6–12 เดือน ไม่ใช่ของโค้ด ให้ระบบใช้งานจริงสะสมข้อมูลไปก่อน แล้วค่อยกลับมาที่ `business-analyst`/`system-analyst` เพื่อวางแผนเมื่อข้อมูลพอ
- Module ที่ผู้ใช้ระบุว่าต้อง `security` agent ตรวจก่อน deploy จริง: Phase 1 (Auth — รหัสผ่าน/JWT/ข้อมูลส่วนบุคคล), Phase 2 (Import — รับไฟล์จากภายนอก), Phase 6 (AI Coaching — ข้อมูลออกนอกองค์กร + API key)

## Unresolved Open Questions

รายการด้านล่างไม่ block การเริ่ม Phase 0/1 — เป็นการตัดสินใจที่ทำเพิ่มได้ทีหลังโดยไม่กระทบ schema:

1. **คำสั่ง "ลบข้อมูลตามงวด"** (Open Question ข้อ 1 ใน `design.md`) — ถ้าผู้ใช้ต้องการฟีเจอร์นี้ จะเป็นงาน `[backend]` endpoint ลบ + `[frontend]` UI เพิ่มเข้า Phase 2 ภายหลัง ไม่ต้องแก้ schema
2. **ความถี่ในการนำเข้าไฟล์** — ไม่กระทบการวางแผนหรือลำดับงาน มีผลแค่ความสดของ Dashboard
3. **การให้คะแนนเมื่อทำเกินเป้า** (`achievementCapPercent`) — ยังไม่ทำใน MVP นี้ ถ้าต้องการภายหลังต้อง amend `design.md` ก่อน (เพิ่ม field ใหม่ใน `EvaluationSetting`) แล้วค่อยเพิ่ม task ใน Phase 4
4. **สิทธิ์เรียก `POST /coaching-insights/:salespersonId/generate`** — `design.md` ไม่ได้ระบุชัดว่าพนักงานขายกดสร้าง insight ของตัวเองได้ไหม หรือต้องเป็นผู้จัดการเท่านั้น ระบุไว้ใน Phase 6 ว่าต้องตรวจ `requirement.md` เพิ่มเติม — ถ้ายังไม่ชัดตอนเริ่ม Phase 6 ให้ backend-engineer ถามผู้ใช้ตรง ๆ ก่อน implement (ไม่ใช่เดา)

## Change Log

- 2026-08-14 — สร้างแผนครั้งแรกจาก `design.md` (confirmed) และ `requirement.md` แบ่งเป็น Phase 0 (setup, ไม่ใช่ frontend/backend) + Phase 1–7 ตรงกับ module B–H ตามลำดับ dependency ที่ยืนยันแล้ว (A→B→C→D→E→(F,G)→H) Module I (Cross-sell) ไม่รวมในแผนเพราะรอข้อมูลสะสม
