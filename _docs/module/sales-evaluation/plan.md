# ระบบประเมินและสนับสนุนพนักงานขาย (Sales Evaluation & Enablement) — Implementation Plan

## Plan Summary

โปรเจกต์นี้ **ยังไม่ได้ scaffold เลย** (ไม่มี `package.json` / `prisma/` / `app/`) ดังนั้นก่อน Phase 1 ต้องรัน `setup` agent ก่อนเพื่อสร้างโครง Next.js (`web/`) + Express (`api/`) + Prisma + PostgreSQL + `.env` + seed ค่าเริ่มต้น (`EvaluationSetting` singleton, `ScoringWeight` 5 แถว, บัญชีผู้จัดการอย่างน้อย 2 บัญชีตามความเสี่ยงข้อ 12 ใน `design.md`) — งานนี้ไม่ได้ tag `[frontend]`/`[backend]` เพราะเป็นงานของ `setup` agent ไม่ใช่ engineer สองตัวนี้

แผนแบ่งเป็น 8 เฟส ตรงกับ module A–H ใน `design.md` เรียงตาม dependency ที่ยืนยันแล้ว: **A(setup) → B(auth) → C(import) → D(targets) → E(KPI engine) → F/G(dashboards+AI ขนานกัน) → H(reports)**. Module I (Cross-sell) ไม่อยู่ในแผนนี้เพราะรอข้อมูลสะสม 6–12 เดือน ไม่ใช่ dependency ของโค้ด

ลำดับนี้ตรงข้ามกับลำดับความสำคัญทางธุรกิจที่ผู้ใช้อยากได้ที่สุด (ชี้จุดอ่อน + coaching) แต่ผู้ใช้ยืนยันแล้วว่ายอมรับลำดับตาม dependency เพราะ KPI/coaching คำนวณไม่ได้จนกว่าจะมีข้อมูล (C) และเป้า (D) อยู่ในระบบก่อน Phase F และ G ทำขนานกันได้เพราะทั้งคู่ขึ้นกับ E เท่านั้นและไม่ขึ้นกับกันเอง — มอบให้ทั้ง frontend/backend engineer พร้อมกันได้ถ้าทรัพยากรพอ

**เพิ่ม 2026-08-16 — ขยายแผนด้วย Phase 8–10 (Module J/K/L)**: หลังจาก Phase 1–7 verified แล้ว `design.md`/`requirement.md` เพิ่มขอบเขตใหญ่ (แบ่งเครดิตดีล, ทะเบียนโรงพยาบาล/พื้นที่รับผิดชอบ, ตัวช่วยตั้งเป้า) ลำดับ **J → K → L ถูกล็อกโดย `system-analyst` ห้ามสลับ** เพราะ K ต้องใช้ชื่อที่สะอาดแล้วจาก J และ L ต้องใช้ทั้งพื้นที่จาก K และ Target ที่มีอยู่แล้วจาก Module D — ไม่มีการทำขนานกันระหว่าง J/K/L เหมือนที่ F/G เคยทำได้ **จุดที่ต้องระวังที่สุดคือ Module J เปลี่ยนสัญญาของ query การรวมยอดรายคนที่ Phase 4–7 ถูกสร้างและตรวจผ่านไปแล้ว** (`SalesLine.salespersonId` → `SalesLineCredit`) จึงต้องแก้ endpoint/service ของ Phase 4–7 เป็นส่วนหนึ่งของ Phase 8 เอง และให้ `qa-engineer` ตรวจตัวเลข Phase 4–7 ซ้ำทั้งหมดหลัง Phase 8 เสร็จ — ไม่ใช่งาน cleanup ที่ข้ามได้ ดู Sequencing Notes Module I (Cross-sell) ยังไม่อยู่ในแผนนี้เช่นเดิม เพราะยังรอข้อมูลสะสม

**เพิ่ม 2026-08-17 — ขยายแผนด้วย Phase 11–16 (Module M/N/O/P) หลัง `system-analyst` เพิ่มโครงสร้างเขต (Territory) + รายงาน 3 ตัว**: `design.md` ล็อกลำดับใหม่ **J → M → (N, P1, O ส่วนที่ 2) → K → (L, P2)** — **ผู้ใช้เลือกให้ Module M เริ่มขนานไปกับงานที่เหลือของ J (หน้าจอ/QA ของ Phase 8 ที่ยังค้างอยู่) แทนการรอ J ปิดรอบให้จบก่อน** (design.md การตัดสินใจแถวที่ 20 / Risks ข้อ 26) — Phase 12 (Module M) จึงเริ่มได้ทันที ไม่ต้องรอ Phase 8 verified เพียงแต่ backend ของ J (`SalesLineCredit`/`creditResolution.service.ts`) ต้องมีอยู่แล้วซึ่งมีอยู่แล้วจริง มีข้อยกเว้นหนึ่งเดียวคือ Module O ส่วนที่ 1 (ทะเบียนสินค้า) ที่ไม่ขึ้นกับเขตเลยและเริ่มขนานกับ M ได้ตั้งแต่วันแรกเช่นกัน (จัดเป็น Phase 11 นำหน้า M) **จุดที่ต้องระวังที่สุดของรอบนี้คือ `Target.salespersonId` เปลี่ยนเป็น nullable + เพิ่ม `scope`** ซึ่งทำลายสัญญาของ query ที่ Phase 3/4 verified ไปแล้ว (รูปแบบเดียวกับที่ `SalesLineCredit` เคยบังคับ Phase 4–7 ให้ตรวจซ้ำ) — งานแก้ query ของ Phase 3/4 เป็นส่วนหนึ่งของ Phase 12 (Module M) เอง และ `qa-engineer` ต้องตรวจ Phase 3/4 ซ้ำแบบ TARGETED หลัง Phase 12 เสร็จ **Phase 9 (Module K) และ Phase 10 (Module L) ที่เขียนไว้ก่อนรอบนี้ ยังคงเลขเฟสเดิมในไฟล์นี้ แต่ลำดับการ implement จริงต้องขยับไปอยู่หลัง Phase 15** (ดู Sequencing Notes) — ห้ามเริ่ม Phase 9 ก่อน Phase 12–15 เสร็จ แม้เลขเฟสจะน้อยกว่าก็ตาม

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

## Phase 8: ซ่อมข้อมูลชื่อซ้ำ และการแบ่งเครดิตดีล (Module J) 🔒 Security gate
- [ ] [backend] Migration: เพิ่ม `SalesLineCredit`, `SalesmanNameRule`, `SalesmanNameRuleMember`, `HospitalAlias`, `HospitalNameReview` + enum `NameDecisionSource`, `NameReviewStatus` + back-relations บน `SalesLine`/`Salesperson`/`User`/`Hospital` ลง `schema.prisma` ตาม Data Model ใน `design.md` ทุกตัวอักษร (ยังไม่เคย propagate ลง `schema.prisma` มาก่อน)
- [ ] [backend] สคริปต์ backfill: สร้าง `SalesLineCredit` 1 แถวต่อ 1 `SalesLine` เดิมทั้ง 846 แถว (`sharePercent = 100`, `isPrimary = true`, `salespersonId = SalesLine.salespersonId`) — ต้อง idempotent/ย้อนกลับได้
- [ ] [backend] Shared normalizer module: `thaiCore(s)`, `latinCore(s)`, `personCore(s)` ตามนิยามในหัวข้อ Import Rules — ใช้จุดเดียว ห้ามเขียนซ้ำแยกไฟล์
- [ ] [backend] แก้ import service: parse ค่าดิบคอลัมน์ `Salesman` ที่มีตัวคั่น `/ & + , และ` → แยกรายชื่อย่อย, resolve ผ่าน `SalesmanNameRule` ก่อนเสมอ, สร้างกฎใหม่สัดส่วนเท่ากันทุกคนพร้อม `WARNING` `SHARED_CREDIT_RULE_CREATED` เมื่อเจอค่าผสมใหม่, `ERROR` `UNKNOWN_SALESMAN_IN_SHARED_DEAL` + ข้ามแถวเมื่อ resolve ไม่ได้บางคน (ห้ามยกเครดิตทั้งก้อนให้คนที่ resolve ได้)
- [ ] [backend] แก้ import service: เขียน `SalesLineCredit` ให้ทุกแถวที่นำเข้า, ตรวจ `Σ sharePercent = 100.000` ในทรานแซกชันเดียวกับ import (ล้มทั้งไฟล์ถ้าไม่ครบ), คง `SalesLine.salespersonId` = คนที่ `isPrimary = true`
- [ ] [backend] แก้ import service: resolve ชื่อโรงพยาบาลผ่าน `HospitalAlias` ก่อนเสมอ — รวมอัตโนมัติเมื่อ `latinCore` ตรงกัน (เขียน `HospitalAlias` `source = AUTO`), สร้าง `HospitalNameReview` (`PENDING`) เมื่อ `thaiCore` ตรงแต่ `latinCore` ต่างกัน, ห้ามใช้ fuzzy ตั้งคำถาม
- [ ] [backend] Seed script: สร้าง `HospitalNameReview` สถานะ `KEPT_SEPARATE` ถาวรสำหรับ 10 คู่ที่ยืนยันห้ามรวม (ศิริราช/ปิยมหาราชการุณย์, บางปะกอก 1/8, เปาโล พหลโยธิน/รังสิต, ศิครินทร์/หาดใหญ่, วิภาราม/ปากเกร็ด, พิษณุเวช/อุตรดิตถ์, กรุงเทพคริสเตียน/นครปฐม, สินแพทย์ นครปฐม/ลำลูกกา, ธนบุรี 1/บำรุงเมือง, สาขา Bangkok Hospital ทุกจังหวัด) เพื่อไม่ให้ import รอบหน้าถามซ้ำ
- [ ] [backend] Endpoint `GET /hospital-name-reviews` (MANAGER) — list สถานะ `PENDING`
- [ ] [backend] Endpoint `PATCH /hospital-name-reviews/:id` (MANAGER) — ตัดสิน `MERGED` (เขียน `HospitalAlias` ให้ทั้งสองคีย์ชี้ `Hospital` เดียวกัน) หรือ `KEPT_SEPARATE`
- [ ] [backend] Endpoint `GET /salesman-name-rules` (MANAGER) — list กฎทั้งหมดรวมกฎที่ auto-create รอยืนยัน
- [ ] [backend] Endpoint `PATCH /salesman-name-rules/:id` (MANAGER) — แก้สัดส่วนสมาชิก (ต้องรวมเป็น 100 พอดี), บันทึก `decidedById`/`decidedAt`
- [ ] [backend] สคริปต์ cleanup ครั้งเดียว (รันครั้งเดียว ย้อนกลับได้): รวม 5 คู่โรงพยาบาลซ้ำที่ยืนยันแล้ว + 1 คู่พนักงานขาย (`Mr.Panyawat`/`Mr Panyawat`) ในข้อมูล 846 แถวเดิม ผ่าน `HospitalAlias`/`SalesmanNameRule`, ย้าย reference ของ `SalesLine`/`SalesLineCredit` เดิมให้ชี้ระเบียนหลักที่รวมแล้ว — **ห้ามแตะ `Miss Napatsorn  Dadphu` (ช่องว่าง 2 ครั้ง) จนกว่าจะยืนยันว่าซ้ำกับใครหรือไม่**
- [ ] [backend] แก้ query/service ของ Phase 4–7 ทุกจุดที่เคยรวมยอดผ่าน `SalesLine.salespersonId` ให้อ่านจาก `SalesLineCredit` แทน (สูตร KPI ทั้ง 5 ตัวใน `kpi.service.ts`, `GET /kpi/*`, `GET /leaderboard`, payload ที่ส่งให้ Gemini ใน `coachingInsight.service.ts`, `GET /reports/individual/*` และ `GET /reports/team-overview/*` รวมทั้งไฟล์ export) — ห้ามมี fallback ไปทาง `salespersonId` เหลืออยู่แม้แต่จุดเดียว
- [ ] [backend] Zod schemas สำหรับ body ของ `PATCH /hospital-name-reviews/:id` และ `PATCH /salesman-name-rules/:id`
- [ ] [frontend] หน้าคิวยืนยันชื่อโรงพยาบาลซ้ำ (MANAGER เท่านั้น) — list `HospitalNameReview` สถานะ `PENDING`, ปุ่ม "รวม" / "แยกถาวร"
- [ ] [frontend] หน้าคิวยืนยัน/แก้สัดส่วนดีลแชร์เครดิต (MANAGER เท่านั้น) — list `SalesmanNameRule`, inline edit สัดส่วนสมาชิก, validate รวม = 100
- [ ] [frontend] เพิ่ม badge/แสดงผล `ImportIssue` รหัสใหม่ในหน้ารายงานผลการนำเข้า: `SHARED_CREDIT_RULE_CREATED`, `UNKNOWN_SALESMAN_IN_SHARED_DEAL`

## Phase 9: ทะเบียนโรงพยาบาล ภาค และพื้นที่รับผิดชอบ (Module K) 🔒 Security gate
- [ ] [backend] Migration: เพิ่ม `Region`, `ProvinceMapping`, `ProvinceAlias`, `HospitalRegistry`, `HospitalPotentialMetric`, `HospitalRegistryLink`, `TerritoryAssignment` + enum `HospitalCategory`, `PotentialMetricKey`, `RegistryLinkStatus`, `RegistryLinkMethod`, `TerritoryAssignmentSource`, `TerritoryAssignmentStatus` + `Hospital.provinceMappingId` + back-relations ลง `schema.prisma` ตาม Data Model ใน `design.md`
- [ ] [backend] Seed script: `Region` 5 ภาค (เหนือ/อีสาน/กลาง/ใต้/กทม.), `ProvinceMapping` 77 จังหวัด — **หยุดและถามผู้ใช้ก่อน seed 4 จังหวัดที่ยังไม่เคาะ (นครสวรรค์ กำแพงเพชร พิจิตร อุทัยธานี — Open Question ข้อ 4 ใน `design.md`)** อย่าเดาเอง
- [ ] [backend] Seed script: `ProvinceAlias` จากค่าดิบ 69 ค่าที่พบจริงในข้อมูล
- [ ] [backend] Endpoint `PATCH /provinces/:id` (MANAGER) — แก้ `regionId`/canonical mapping ทีหลังได้
- [ ] [backend] Service นำเข้า `ขนาดเตียงรพ.xlsx` เข้า `HospitalRegistry` + `HospitalPotentialMetric` — ใช้ pipeline เดียวกับ Module C (header detection, validation, `ImportBatch`/`ImportIssue` รูปแบบเดียวกัน)
- [ ] [backend] Endpoint `POST /registry-import` (MANAGER เท่านั้น) — อัปโหลดไฟล์ทะเบียน (แยกช่องทางจาก `POST /import` ของ Module C)
- [ ] [backend] Service จับคู่ `Hospital` ↔ `HospitalRegistry` อัตโนมัติ (`EXACT`/`NORMALIZED` ผ่าน `thaiCore`/`latinCore` จาก Module J) → เขียน `HospitalRegistryLink` (`status = LINKED`, `method`, `confidence`)
- [ ] [backend] Endpoint `GET /hospital-registry-links` (MANAGER) — list ตาม `status` (`UNREVIEWED`/`LINKED`/`CONFIRMED_ABSENT`)
- [ ] [backend] Endpoint `PATCH /hospital-registry-links/:hospitalId` (MANAGER) — ยืนยัน/แก้ทับการจับคู่ หรือทำเครื่องหมาย `CONFIRMED_ABSENT`
- [ ] [backend] Service เดาเจ้าของพื้นที่จากประวัติการขาย (ผู้ขายส่วนใหญ่ต่อโรงพยาบาล) → เขียน `TerritoryAssignment` (`status = DRAFT`, `source = INFERRED`) ครั้งเดียว ห้ามคำนวณสดใหม่ทุกครั้งที่ import — ตีธงโรงพยาบาลที่อันดับ 2 ได้ ≥30% ของอันดับ 1 (ความเสี่ยงข้อ 16) ให้ต้องตัดสินเอง
- [ ] [backend] Endpoint `GET /territory-assignments` — list, filter ตามพนักงานขาย/ภาค/สถานะ
- [ ] [backend] Endpoint `POST /territory-assignments/:id/confirm` (MANAGER) — เปลี่ยน `DRAFT` → `ACTIVE`
- [ ] [backend] Endpoint `PUT /territory-assignments` (MANAGER) — สร้าง/ย้ายเจ้าของด้วยตัวเอง (`source = MANUAL`), ตั้ง `effectiveFrom`, ปิดรายการเดิมเป็น `SUPERSEDED` ด้วย `effectiveTo` (เก็บประวัติผู้ดูแลโดยไม่ต้องมีตารางแยก ตาม requirement 10.3)
- [ ] [backend] Endpoint `GET /hospitals/uncontactable` — คืน 2 รายการแยกกันตาม requirement 10.4 พร้อมตัวจำกัดจำนวน
- [ ] [backend] Zod schemas สำหรับ body ของ `POST /registry-import`, `PATCH /hospital-registry-links/:hospitalId`, `POST /territory-assignments/:id/confirm`, `PUT /territory-assignments`, `PATCH /provinces/:id`
- [ ] [frontend] หน้าอัปโหลดไฟล์ทะเบียนโรงพยาบาล (MANAGER เท่านั้น) — reuse UI pattern จากหน้าอัปโหลด Excel ของ Phase 2
- [ ] [frontend] หน้าคิวยืนยันการจับคู่โรงพยาบาลกับทะเบียน (MANAGER เท่านั้น) — list, ปุ่มยืนยัน/แก้ทับ/ทำเครื่องหมาย "ไม่มีในทะเบียน"
- [ ] [frontend] หน้าจัดการ จังหวัด → ภาค (MANAGER เท่านั้น) — ตาราง, แก้ `regionId` ต่อจังหวัด, ตีธง 4 จังหวัดที่ยังไม่เคาะ
- [ ] [frontend] หน้าพื้นที่รับผิดชอบ — ตารางต่อพนักงานขาย/โรงพยาบาล, ปุ่มยืนยัน `DRAFT` → `ACTIVE`, ฟอร์มย้ายเจ้าของด้วยตัวเอง, badge เมื่ออันดับ 2 ได้ ≥30% ของอันดับ 1
- [ ] [frontend] หน้ารายการโรงพยาบาลที่ยังปิดการขายไม่ได้ — 2 ชุดแยกกันตาม requirement 10.4

## Phase 10: คะแนนศักยภาพพื้นที่ และตัวช่วยตั้งเป้า (Module L)
- [ ] [backend] Migration: เพิ่ม `TierWeight` + 6 คอลัมน์ใหม่ใน `EvaluationSetting` (`potentialMetric`, `minRegionCoverage`, `targetSuggestionAlpha`, `targetLookbackMonths`, `targetOutlierThreshold`, `targetGrowthRate`) ลง `schema.prisma` ตาม Data Model ใน `design.md` (ทั้งหมดมี default)
- [ ] [backend] Service คำนวณ `potential(h) = metricValue(h, setting.potentialMetric) × tierWeight(h.tier) × h.potentialAdjustment` ตาม Territory & Potential Rules ข้อ 1 (โรงพยาบาลที่ไม่มีในทะเบียนไม่มี `potential` แยกไปนับใน coverage แทน)
- [ ] [backend] Service คำนวณ `potential(sp, region)` / `potentialShare(sp, region)` — **คำนวณแยกรายภาคเสมอ ห้ามรวมเป็นก้อนเดียวทั้งประเทศ**
- [ ] [backend] Service คำนวณ `regionCoverage(region)` / `personCoverage(sp)` ตามข้อ 3 — ภาคมีสิทธิ์ใช้ศักยภาพกับเป้าเมื่อ `regionCoverage ≥ setting.minRegionCoverage` เท่านั้น
- [ ] [backend] Service คำนวณ `penetrationIndex(sp, region)` ตามข้อ 4 — แสดงอย่างเดียวไม่เข้าคะแนน, หน่วยบาท/เตียง ห้ามแสดงเป็น %
- [ ] [backend] Service คำนวณ `historyBased(sp, region)` ตามข้อ 5.1 — window `targetLookbackMonths` เดือน, ตัด outlier ต่อ `invoiceNo` ที่เกิน `targetOutlierThreshold` ของยอดรวมทุกภาคของคนนั้น, ใช้ยอดผ่าน `SalesLineCredit` เสมอ, ห้ามตัดเงียบ (คืนรายการก่อน/หลังตัดพร้อมเลขใบกำกับที่เอากลับได้)
- [ ] [backend] Service คำนวณ `R(region, period)` ตามข้อ 5.2 — โหมด `SUGGEST` (ค่าเริ่มต้น) = `Σ historyBased` ของคนที่มี `TerritoryAssignment` `ACTIVE` ในภาคนั้น, โหมด `REBALANCE` = `Σ Target.revenueTarget` แบบ snapshot ตอนเปิดหน้าจอ เปิดใช้ได้เฉพาะเมื่อทุกคนในภาคมี `Target` ของงวดนั้นครบแล้ว
- [ ] [backend] Service คำนวณ `potentialBased(sp,region)`, `w(sp,region) = 0` ถ้าภาคไม่ผ่าน coverage มิฉะนั้น `= min(1 − targetSuggestionAlpha, personCoverage(sp))`, `suggested(sp,region)` ตามข้อ 5.3 — **ห้าม renormalize ให้ `Σ suggested = R`**
- [ ] [backend] Service คำนวณ `unmappedBase(sp)` สำหรับยอดที่มาจากโรงพยาบาลที่ยังไม่มี `provinceMappingId` — ผ่านฝั่งประวัติ 100% เสมอ ไม่เข้าสูตรศักยภาพ ไม่เข้า `R` ของภาคใด
- [ ] [backend] Service รวม `suggested(sp) = Σ suggested(sp,region) ทุกภาค + unmappedBase(sp)` ตามข้อ 5.5 (ตรวจ: เมื่อ `targetSuggestionAlpha = 1.000` ผลต้องเท่ากับ `historyBased` รวมทุกภาคพอดี)
- [ ] [backend] Endpoint `GET /target-suggestions/:year/:month` (MANAGER) — คืน `historyBased`/`potentialBased`/`suggested` ต่อคนต่อภาค, coverage badge (ภาค+คน), โหมดที่ใช้อยู่พร้อมค่า `R`, รายการดีลที่ถูกตัดพร้อมเลขใบกำกับ, `unmappedBase`, `Σ suggested − R` ของภาค
- [ ] [backend] Endpoint `POST /target-suggestions/reinstate-deal` (MANAGER) — เอาดีลที่ถูกตัดออกกลับเข้าคำนวณสำหรับ preview นี้ (ไม่บันทึกจนกว่าผู้จัดการจะรับเข้า `Target`)
- [ ] [backend] Endpoint `GET /settings/tier-weights` และ `PATCH /settings/tier-weights` (MANAGER) — แก้น้ำหนักตามระดับโรงพยาบาล ค่าเริ่มต้น 1.000 ทุกระดับ
- [ ] [backend] Endpoint `PATCH /hospital-registry/:id/potential-adjustment` (MANAGER) — ตั้งค่าปรับ/ยกเว้นรายโรงพยาบาล (requirement 10.5)
- [ ] [backend] ขยาย `PATCH /settings/evaluation` (จาก Phase 4) ให้รับ 6 ฟิลด์ใหม่ของ `EvaluationSetting`
- [ ] [backend] Zod schemas สำหรับ query ของ `/target-suggestions/:year/:month`, body ของ `reinstate-deal`, `tier-weights` update, `potential-adjustment` update
- [ ] [backend] เขียน guard/ทดสอบยืนยันว่าไม่มี path ใดใน Module L แก้ `ScoringWeight` หรือสูตรคะแนนรวมของ Phase 4
- [ ] [frontend] หน้าตัวช่วยตั้งเป้า — ตาราง `historyBased`/`potentialBased`/`suggested` เรียงคู่กันพร้อมคอลัมน์ส่วนต่าง, badge coverage (ภาค+คน), ป้ายโหมด (`SUGGEST`/`REBALANCE`) พร้อมค่า `R`, รายการดีลที่ถูกตัดพร้อมปุ่มเอากลับ, ก้อน `unmappedBase`, ค่า `Σ suggested − R`
- [ ] [frontend] ปุ่ม "รับข้อเสนอ" — เขียน `suggested(sp)` ลง `Target` ผ่าน `PUT /targets/:salespersonId/:year/:month` เดิมของ Phase 3 (ไม่สร้าง endpoint เขียนเป้าใหม่) ผู้จัดการแก้ตัวเลขก่อนบันทึกได้เสมอ
- [ ] [frontend] หน้าตั้งค่าน้ำหนักตามระดับโรงพยาบาล (`TierWeight`, MANAGER เท่านั้น)
- [ ] [frontend] ช่องแก้ `potentialAdjustment` รายโรงพยาบาลในหน้ารายละเอียดทะเบียนโรงพยาบาล (MANAGER เท่านั้น)
- [ ] [frontend] ขยายหน้าตั้งค่าคงที่ของการประเมิน (จาก Phase 4) ให้มี 6 ฟิลด์ใหม่: `potentialMetric`, `minRegionCoverage`, `targetSuggestionAlpha`, `targetLookbackMonths`, `targetOutlierThreshold`, `targetGrowthRate`
- [ ] [frontend] ป้ายกำกับบังคับบนทุกหน้าที่โชว์ศักยภาพ/penetration: "คำนวณจากโรงพยาบาลที่จับคู่ทะเบียนได้ X% ของยอดขาย" และข้อความเฉพาะของ กทม. ตามข้อ 7 — ห้ามแสดงเลข 0 เฉย ๆ

## Phase 11: ทะเบียนสินค้า (Module O ส่วนที่ 1 — Product Master)

ไม่ขึ้นกับเขตเลย เริ่มขนานไปกับ Phase 12 (Module M) ได้ตั้งแต่วันแรก — ดู Sequencing Notes

- [ ] [backend] Migration: ขยาย `Product` (`code` nullable unique, `displayName` nullable, `source` เพิ่ม enum `ProductSource` default `SALES_HISTORY`, `isActive` default true) + โมเดล `ProductAlias` (`normalizedKey` unique, `sampleRaw`, `productId`, `source: NameDecisionSource`, `decidedById`, `decidedAt`) + back-relation บน `User` (`productAliases`) ลง `schema.prisma` ตาม Data Model — ไม่ต้อง backfill ข้อมูลเพราะ `Product` มีอยู่แล้วครบและทุกคอลัมน์มี default
- [ ] [backend] Seed script: สร้าง `ProductAlias` 1 แถวต่อ `Product` ที่มีอยู่แล้วทุกแถว โดย `normalizedKey = latinCore(product.name)` (reuse `nameNormalizer.util.ts` ของ Module J ห้ามเขียน normalizer ตัวที่สอง), `sampleRaw = product.name`, `source = AUTO`
- [ ] [backend] แก้ import service: resolve ชื่อสินค้าผ่าน `ProductAlias` ก่อนเสมอเมื่อ auto-create/lookup `Product` จากคอลัมน์ `Product Name` — ชื่อใหม่ที่ไม่เจอใน alias สร้าง `Product`(`source = SALES_HISTORY`) + `ProductAlias`(`source = AUTO`) ใหม่ให้อัตโนมัติ (ยังไม่ต้องมีคิวถามผู้จัดการ — `ProductNameReview` เลื่อนไปเป็นระยะ 2 ตาม Product Master & Ranking Rules ข้อ 2 ห้าม implement ล่วงหน้า)
- [ ] [backend] Endpoint `GET /products` — list ทะเบียนสินค้า (code/displayName/name/productType/source/isActive)
- [ ] [backend] Endpoint `PATCH /products/:id` (MANAGER เท่านั้น) — แก้ `code`/`displayName`/`isActive`
- [ ] [backend] Zod schema สำหรับ body ของ `PATCH /products/:id`
- [ ] [frontend] หน้าทะเบียนสินค้า — ตาราง code (แสดง **"—"** พร้อม tooltip คำเตือนเมื่อ `code = null` ห้ามแสดงช่องว่างเปล่าหรือเอา `id` มาแทน) / ชื่อ / กลุ่มสินค้า / ที่มา (`SALES_HISTORY`/`CATALOG`) / สถานะ, ฟอร์มแก้ไข (MANAGER เท่านั้น)

## Phase 12: โครงสร้างเขต (Territory) และเป้าระดับเขต (Module M) 🔒 Security gate

**เป็น blocker ของ Phase 13–15 ทั้งหมด — ต้องเสร็จก่อนเริ่มเฟสถัดไป** ดู Sequencing Notes สำหรับเหตุผลที่เริ่มได้ทันทีแบบขนานกับงานค้างของ Phase 8

- [ ] [backend] Migration: เพิ่ม `Territory` (`name` unique, `code` unique nullable, `regionId` nullable — ป้ายอ้างอิงเท่านั้น ห้ามใช้แทน `Region` ในสูตรศักยภาพ, `sortOrder`, `isActive`, `note`), enum `TerritoryRole` (`OWNER`/`SUPERVISOR`), `TerritoryAssignment` **นิยามใหม่** (`territoryId`, `salespersonId`, `role`, `effectiveFrom`, `effectiveTo`, `assignedById`, `note`, `@@unique([territoryId, salespersonId, effectiveFrom])`), enum `TerritoryLinkSource` (`INFERRED`/`MANUAL`), `HospitalTerritoryChange` (audit อย่างเดียว ไม่มี relation ออก) ลง `schema.prisma` — **ห้ามสร้าง `TerritoryAssignment` แบบเดิมที่ Phase 9 เขียนไว้ก่อนหน้านี้ นี่คือของจริงตัวเดียวที่ implement** ดู Sequencing Notes
- [ ] [backend] Seed script: `Region` 5 แถว (เหนือ/อีสาน/กลาง/ใต้/กทม.) — ย้ายมาจาก Module K ตามที่ `design.md` ระบุ (ต้องมีก่อน `Territory.regionId` อ้างถึงได้)
- [ ] [backend] เพิ่มคอลัมน์ `Hospital.territoryId`/`territorySource` (default `INFERRED`) + back-relation `territoryAssignments` — **ยังไม่เพิ่มคอลัมน์เดียวกันบน `HospitalRegistry` ตอนนี้เพราะโมเดลนั้นยังไม่ถูกสร้าง (รอ Phase 9/Module K) — เพิ่มพร้อมกับตอนสร้าง `HospitalRegistry` แทน**
- [ ] [backend] เพิ่มคอลัมน์ `Salesperson.excludedFromTerritoryTotals` (default false) / `employmentEndedAt` (nullable) + back-relation `territoryAssignments` — ตั้ง `excludedFromTerritoryTotals = true` ให้ Mr.Sathit เพียงคนเดียวผ่านข้อมูล ห้าม hardcode logic ตามชื่อในโค้ด
- [ ] [backend] เพิ่ม back-relation `territoryAssignmentsMade` บน `User`
- [ ] [backend] **Target re-scope**: เพิ่ม enum `TargetScope` (`TERRITORY`/`SALESPERSON`), เพิ่ม `Target.scope` (default `SALESPERSON` — ทำให้แถวเดิมย้ายมาได้โดยไม่ backfill), `Target.territoryId` (nullable, relation ไป `Territory`), เปลี่ยน `Target.salespersonId` เป็น nullable, เพิ่ม `@@unique([territoryId, year, month])` คู่กับ `@@unique([salespersonId, year, month])` เดิม — `TargetProductGroup`/`TargetRevision` ไม่เปลี่ยนโครงสร้าง
- [ ] [backend] **ตรวจและแก้ทุก query/validator ของ Phase 3 ที่สมมติว่า `Target.salespersonId` ไม่เป็น null**: `GET /targets`, `PUT /targets/:salespersonId/:year/:month`, `PUT /targets/:targetId/product-groups`, `POST /targets/copy`, `GET /targets/:targetId/revisions` + Zod validators ที่เกี่ยวข้อง — ทุกจุดที่อ่าน `Target` ต้องระบุ `scope` เสมอ ห้าม query แบบไม่กรอง scope (Risks ข้อ 21)
- [ ] [backend] **ตรวจและแก้ทุกจุดใน `kpi.service.ts` (Phase 4) ที่อ่าน `Target.revenueTarget`/`newCustomerTarget`/`TargetProductGroup` เพื่อคำนวณ `REVENUE_VS_TARGET`/`PRODUCT_GROUP` รายคน** ให้ระบุ `scope = SALESPERSON` explicit เสมอ ไม่ให้หลุดไปอ่านแถว `scope = TERRITORY` ปนกัน
- [ ] [backend] เขียน assertion/guard: ทุกแถว `Target` มี `territoryId` หรือ `salespersonId` อย่างใดอย่างหนึ่งเท่านั้น (XOR) และต้องตรงกับ `scope` — บังคับในโค้ด Zod validator ของทุก endpoint ที่เขียน `Target`
- [ ] [backend] สคริปต์ bootstrap เขตให้โรงพยาบาล 141 แห่งตาม Territory KPI Rules ข้อ 9: หา salesperson ที่มียอด `SalesLineCredit` สูงสุดต่อโรงพยาบาล (ไม่รวมคนที่ `excludedFromTerritoryTotals = true`) → ถ้ามี `TerritoryAssignment` ACTIVE เขตเดียว ตั้ง `territoryId`/`territorySource = INFERRED` ให้ทันที → ถ้าดูแลหลายเขต หรืออันดับ 2 ได้ยอด ≥30% ของอันดับ 1 ปล่อย `territoryId = null` และตีธงให้ผู้จัดการตัดสิน (ห้ามเลือกให้เอง) — สคริปต์ต้อง idempotent รันซ้ำได้
- [ ] [backend] Endpoint `POST /territories` และ `PATCH /territories/:id` (MANAGER เท่านั้น) — สร้าง/แก้เขต (`name`/`code`/`regionId`/`isActive`/`note`)
- [ ] [backend] Endpoint `GET /territories` — list เขตทั้งหมดพร้อมจำนวนผู้ดูแลปัจจุบันและจำนวนโรงพยาบาลที่สังกัด
- [ ] [backend] Endpoint `GET /territory-assignments` — list, filter ตามเขต/พนักงานขาย/สถานะ (ACTIVE = `effectiveTo IS NULL หรือ ≥ วันนี้`)
- [ ] [backend] Endpoint `PUT /territory-assignments` (MANAGER เท่านั้น) 🔒 — มอบ/ถอนผู้ดูแลเขต: สร้างแถวใหม่ (`source = MANUAL`, `effectiveFrom`) และปิดแถวเดิมด้วย `effectiveTo` เมื่อถอน — ไม่มีตารางประวัติแยก
- [ ] [backend] Endpoint `PATCH /hospitals/:id/territory` (MANAGER เท่านั้น) — ย้ายโรงพยาบาลรายแห่งเข้า/ออกเขต (`territorySource = MANUAL`), เขียน `HospitalTerritoryChange` ทุกครั้ง
- [ ] [backend] Endpoint `POST /hospitals/territory/bulk-by-province` (MANAGER เท่านั้น) — กำหนดเขตยกทั้งจังหวัดในครั้งเดียว (ข้อบังคับตาม Territory KPI Rules ข้อ 9.4), เขียน `HospitalTerritoryChange` ต่อแถวที่เปลี่ยน
- [ ] [backend] Endpoint `GET /hospitals/unassigned-territory` — list โรงพยาบาลที่ `territoryId = null` พร้อมยอดรวมที่ยังค้างอยู่ใน `unassignedBucket` (Territory KPI Rules ข้อ 9.5)
- [ ] [backend] Service คำนวณ `derivedTarget(sp, งวด)` สดตาม Territory KPI Rules ข้อ 6 — **ห้ามเขียนลงตาราง `Target`**: รวมเป้าของทุกเขตที่ `sp` มี `TerritoryAssignment` ACTIVE หารด้วย `activeOwnerCount(T, งวด)` ของแต่ละเขตแล้วรวม, ถ้ามีแถว `Target(scope=SALESPERSON)` ของคนนั้นในงวดนั้น → ใช้แทนทั้งก้อน, เขตที่ `activeOwnerCount = 0` → เป้าก้อนนั้นแสดงแยกเป็น "เป้าของเขตที่ยังไม่มีผู้ดูแล" ห้ามหารเข้าคนอื่น
- [ ] [backend] Endpoint `GET /targets/derived/:salespersonId/:year/:month` — คืน `derivedTarget` พร้อมที่มา ("กรอกเอง"/"คำนวณจากเขต") และรายการเขตย่อยที่ประกอบกันเป็นก้อนนั้น
- [ ] [backend] Endpoint `PUT /targets/:territoryId/:year/:month` (MANAGER เท่านั้น) 🔒 — upsert เป้าระดับเขต (`scope = TERRITORY`, `revenueTarget`, `newCustomerTarget`) พร้อมบันทึก `TargetRevision` เหมือน endpoint เป้ารายคนเดิมของ Phase 3
- [ ] [backend] ตรวจว่า `PUT /targets/:targetId/product-groups` (Phase 3 เดิม) ใช้งานได้กับ `Target` ที่ `scope = TERRITORY` โดยไม่ต้องแก้โค้ดเพิ่ม (targetId เป็น key อยู่แล้ว) — เขียน note/comment ยืนยันไว้ในโค้ดถ้าจำเป็นต้องแก้จริง
- [ ] [backend] Zod schemas: territory create/update body, `PUT /territory-assignments` body, `PATCH /hospitals/:id/territory` body, bulk-by-province body, territory-target upsert body
- [ ] [frontend] หน้าจัดการเขต (MANAGER เท่านั้นแก้ได้) — list/สร้าง/แก้เขต, ผูกป้าย `Region` (แสดงชัดว่าเป็นป้ายอ้างอิงเท่านั้น)
- [ ] [frontend] หน้าจัดการผู้ดูแลเขต — มอบ/ถอนผู้ดูแลรายเขต พร้อมวันที่มีผล, ตารางประวัติ (คำนวณจาก `effectiveFrom`/`effectiveTo`)
- [ ] [frontend] หน้า/เครื่องมือย้ายโรงพยาบาลเข้าเขต — ย้ายรายแห่ง + เครื่องมือย้ายยกทั้งจังหวัด
- [ ] [frontend] หน้าโรงพยาบาลที่ยังไม่ผูกเขต — แสดงจำนวน + ยอด `unassignedBucket` ที่ค้างอยู่ตลอดเวลาจนกว่าจะเป็น 0, ปุ่มผูกเขตอย่างเร็ว, badge เมื่อกำกวม (อันดับ 2 ได้ ≥30% ของอันดับ 1)
- [ ] [frontend] หน้าตั้งเป้าระดับเขตแบบตาราง (คู่ขนานกับหน้าตั้งเป้ารายคนเดิมของ Phase 3, MANAGER เท่านั้นแก้ได้) — แถวต่อเขต คอลัมน์ต่อเดือน, inline edit revenueTarget/newCustomerTarget, **กรอกเป้าจริงปี 2026** (2 เขตของ Tasanee/Tanyapat ที่ยังไม่แตกตัวเลข 14M/13M จะยังกรอกไม่ได้จนกว่าจะมีตัวเลข — ดู Unresolved Open Questions)
- [ ] [frontend] Component แสดงเป้ารายคนที่ derive — ป้ายที่มา "กรอกเอง"/"คำนวณจากเขต" เสมอ + บล็อกแยก "เป้าของเขตที่ยังไม่มีผู้ดูแล" ในหน้ารวม — ใช้ซ้ำได้ทั้ง Dashboard/Leaderboard ของ Phase 5

## Phase 13: KPI รายเขต และรายงาน KPI รายเขต (Module N)

- [ ] [backend] Service คำนวณ `revenue(T, งวด)` ตาม Territory KPI Rules ข้อ 2 — `Σ SalesLine.total × SalesLineCredit.sharePercent ÷ 100` เงื่อนไข `hospital.territoryId = T`, `salesperson.excludedFromTerritoryTotals = false`, งวดตรงกัน — **ต้องผ่าน `SalesLineCredit` เสมอ ห้ามรวมผ่าน `SalesLine.salespersonId`**
- [ ] [backend] Service คำนวณ `personalBucket` และ `unassignedBucket` ตามข้อ 3 พร้อม helper รวม 3 ก้อนให้เท่ากับ `Σ SalesLine.total` ของงวดนั้น — เปิด endpoint ให้ค่าทั้ง 3 ก้อนออกมาด้วยกันเพื่อให้ `qa-engineer` ตรวจกฎ "Σ revenue(ทุกเขต) + personalBucket + unassignedBucket = Σ SalesLine.total" ได้ตรง ๆ
- [ ] [backend] Service คำนวณ KPI 5 ตัวที่ระดับเขต ตามข้อ 4 (`REVENUE_VS_TARGET`/`NEW_CUSTOMERS`/`PRODUCT_GROUP`/`RETENTION`/`CONSISTENCY`) — reuse นิยาม/เงื่อนไข "คำนวณไม่ได้" และกฎ renormalize ของ Phase 4 ทั้งดุ้น เปลี่ยนแค่หน่วยจากคนเป็นเขต **ห้ามแก้สูตรคะแนนรวมหรือ `ScoringWeight`**
- [ ] [backend] Service ป้ายกำกับเกณฑ์ตามข้อ 5: เกณฑ์ไม่มีเป้า → "ยังไม่ได้ตั้งเป้า", ข้อมูลไม่พอ → "ข้อมูลยังไม่เพียงพอ (ต้องการ 6 เดือน ปัจจุบันมี X เดือน)" — ห้ามคืน 0% หรือซ่อนเกณฑ์ทิ้ง
- [ ] [backend] Endpoint `GET /territory-kpi/:territoryId` — คะแนนรวม+แยกราย KPI ของเขตเดียว ตาม period
- [ ] [backend] Endpoint `GET /territory-kpi/team` — ทุกเขตของ period เดียวกัน (grain รายงาน: 1 แถว = 1 เขต ห้ามเป็น 1 แถวต่อคู่คน×เขต) รวม `personalBucket`/`unassignedBucket` ในผลลัพธ์
- [ ] [backend] Endpoint `GET /territory-kpi/:territoryId/drill-down/:metric` — รายการ `Product type` ที่ขายได้และรายชื่อโรงพยาบาลที่ขายให้พร้อมยอด (drill-down บังคับตามข้อ 7)
- [ ] [backend] Endpoint `GET /reports/territory-overview` — ประกอบรายงาน 1 แถว/เขต ครบทุกคอลัมน์บังคับ (เขต/ผู้ดูแล/ยอดขาย/เป้า/%ถึงเป้า/KPI5/คะแนนรวม+ป้าย) พร้อมแถว `personalBucket`/`unassignedBucket` ท้ายตาราง
- [ ] [backend] Endpoint `GET /reports/territory-overview/export` — Excel export (ใช้ `exceljs` เดิม)
- [ ] [backend] Zod schemas สำหรับ query ของ endpoint ข้างต้นทั้งหมด (period type/year/periodNumber, territoryId)
- [ ] [frontend] หน้ารายงาน KPI รายเขต — ตาราง 1 แถว/เขต, ผู้ดูแลทุกคนในช่องเดียว (หรือ "ยังไม่มีผู้ดูแล"), %ถึงเป้าเป็นตัวเลขหลัก, คะแนนรวมคนละคอลัมน์พร้อมป้าย "คิดจาก X จาก 5 เกณฑ์" เสมอ, แถว `personalBucket`/`unassignedBucket` ท้ายตาราง, ตัวเลือกช่วงเวลา (เดือน/ไตรมาส/ปี)
- [ ] [frontend] Drill-down จากแต่ละเขต — กลุ่มสินค้าที่ขายได้ + รายชื่อโรงพยาบาลที่ขายให้พร้อมยอด (reuse component drill-down จาก Phase 4)
- [ ] [frontend] ปุ่ม Export Excel ในหน้ารายงาน KPI รายเขต

## Phase 14: มุมมองรายเซลล์ ส่วนที่ 1 — โรงพยาบาลที่ขายได้แล้ว (Module P1)

- [ ] [backend] Service "โรงพยาบาลที่ขายได้แล้ว" ในเขตของพนักงานขายคนหนึ่ง — นับแบบเขต (ทุกโรงพยาบาลในเขตที่มียอดในงวดที่เลือก ไม่ใช่เฉพาะที่เขามีเครดิต) ตามหลัก "KPI เป็นก้อนเดียวที่ระดับเขต" + toggle "เฉพาะที่ฉันมีเครดิต" (กรองผ่าน `SalesLineCredit` ของคนนั้นเอง)
- [ ] [backend] Service "เคยขายได้ แต่ไม่มีในงวดที่เลือก" — reuse นิยาม churn/active เดียวกับ KPI & Scoring Rules ห้ามสร้างนิยามคู่ขนานใหม่
- [ ] [backend] Service โหมดสำรองสำหรับคนที่ไม่มีเขต (`excludedFromTerritoryTotals = true` หรือไม่มี `TerritoryAssignment` เลย) — ตกไปที่โหมด "กรองตาม `Product type` ทั่วประเทศ" อัตโนมัติ ห้ามคืนหน้าว่างเปล่า
- [ ] [backend] Endpoint `GET /my-territory-view/:salespersonId` — คืนทั้ง 2 รายการ (ขายได้แล้ว/เคยขายไม่มีในงวดนี้) + เขตที่เขาดูแล + toggle เครดิต + filter `Product type` + โหมดสำรองเมื่อไม่มีเขต
- [ ] [backend] Endpoint `GET /my-territory-view/:salespersonId/export` — Excel export
- [ ] [backend] Zod schema สำหรับ query (period, productTypeId, creditOnly)
- [ ] [frontend] หน้ามุมมองรายเซลล์ — แสดงชื่อพนักงานขาย + เขตที่ดูแล, ตาราง "โรงพยาบาลที่ขายได้แล้ว" คู่กับ "เคยขายแต่ไม่มีในงวดนี้", toggle "เฉพาะที่ฉันมีเครดิต" พร้อมข้อความบอกโหมดที่กำลังดู, filter `Product type`, banner โหมดสำรองสำหรับคนไม่มีเขต, ตัวเลือกช่วงเวลา, ปุ่ม Export

## Phase 15: อันดับสินค้าขายดี/ขายไม่ได้ รายเขต (Module O ส่วนที่ 2)

- [ ] [backend] Service จัดอันดับสินค้ารายเขต ตาม Product Master & Ranking Rules ข้อ 3 — grain 1 แถว = 1 สินค้า × 1 เขต, ยอดขายผ่าน `revenue(T)` สูตรเดียวกับ Territory KPI Rules ข้อ 2 (ผ่าน `SalesLineCredit`, ไม่รวมคนที่ถูก exclude), เรียงขายดีที่สุดไปน้อยที่สุดตาม `Total`, จัดกลุ่มตาม `Product type`
- [ ] [backend] Service ต่อท้ายรายการด้วยสินค้าที่ขายได้ 0 เรียงตามชื่อ แยก 2 ป้าย: "ยังไม่เคยขายในเขตนี้เลย" (ไม่มียอดทุกงวดที่มีข้อมูล) และ "เคยขายได้ แต่ไม่มีในงวดที่เลือก" — ห้ามซ่อน
- [ ] [backend] Service บล็อก `personalBucket` แยกสำหรับสินค้าที่ขายโดยคนที่ `excludedFromTerritoryTotals = true` (ไม่งั้นรายงานจะบอกว่าสินค้านั้นไม่เคยขายที่ไหนเลยทั้งที่ Mr.Sathit ขายได้)
- [ ] [backend] Endpoint `GET /territory-product-ranking/:territoryId` — อันดับเต็มของเขตหนึ่งตาม period, `Product.code = null` → serialize เป็น `"—"` เสมอ (ห้ามส่ง `null`/`id` ดิบให้ frontend ตัดสินใจเอง)
- [ ] [backend] Endpoint `GET /territory-product-ranking/:territoryId/export` — Excel export พร้อมคำเตือนบังคับของระยะแรกฝังอยู่ในไฟล์ด้วย
- [ ] [backend] Zod schema สำหรับ query (period, territoryId)
- [ ] [frontend] หน้าอันดับสินค้ารายเขต — คอลัมน์บังคับ: รหัสสินค้า (`"—"` พร้อม tooltip เมื่อไม่มี) · ชื่อสินค้า · `Product type` · เขต · ผู้ดูแลเขต (หรือ "ยังไม่มีผู้ดูแล") + ยอดขาย/จำนวน, สินค้าขายได้ 0 ต่อท้ายพร้อม 2 ป้ายแยกกัน, บล็อก `personalBucket`, **คำเตือนบังคับถาวร** ตาม Product Master & Ranking Rules ข้อ 4 คำต่อคำ ("ทะเบียนสินค้าปัจจุบันสร้างจากประวัติการขาย รายการนี้จึงหมายถึงสินค้าที่เขตอื่นขายได้แต่เขตนี้ยังไม่ได้ขาย ไม่ใช่ทั้งแคตตาล็อกของบริษัท") ทั้งบนหน้าจอและไฟล์ export, ตัวเลือกช่วงเวลา, ปุ่ม Export

## Phase 16: มุมมองรายเซลล์ ส่วนที่ 2 — โรงพยาบาลที่ยังไม่เคยขายเลย (Module P2)

**ขึ้นกับ Phase 9 (Module K) — ต้องมี `HospitalRegistry` และการจับคู่ทะเบียนก่อนจึงเริ่มได้** ทำขนานกับ Phase 10 (Module L) ได้ ดู Sequencing Notes

- [ ] [backend] Service "โรงพยาบาลรัฐทั่วไป (`GOVERNMENT_GENERAL`) ที่ยังไม่เคยมีรายการขายเลย" ในเขตของพนักงานขายคนหนึ่ง — จาก `HospitalRegistry` ที่ผูกเขตแล้วแต่ไม่มี `Hospital` ที่มียอดขายจริงเชื่อมอยู่
- [ ] [backend] Service จำกัดจำนวนด้วย 2 กลไกพร้อมกันเสมอ (Territory KPI Rules ข้อ 8): Top N ตามเกณฑ์ศักยภาพที่เลือก (ค่าเริ่มต้น = จำนวนเตียง) **และ** ตัวกรองรายจังหวัด — ไม่ใช่เลือกอย่างใดอย่างหนึ่ง
- [ ] [backend] Endpoint `GET /my-territory-view/:salespersonId/never-sold` — คืนรายการตามเงื่อนไขข้างต้น + filter `Product type` + Top N + จังหวัด
- [ ] [backend] Endpoint `GET /my-territory-view/:salespersonId/never-sold/export` — Excel export
- [ ] [backend] Zod schema สำหรับ query (topN, provinceMappingId, potentialMetric, productTypeId, period)
- [ ] [frontend] ขยายหน้ามุมมองรายเซลล์ (จาก Phase 14) เพิ่ม section "โรงพยาบาลรัฐที่ยังไม่เคยขายเลย" — ตัวเลือก Top N ตามเกณฑ์ศักยภาพ + ตัวกรองจังหวัดพร้อมกันเสมอ, filter `Product type` ร่วมกับ section เดิม, ปุ่ม Export

## Sequencing Notes

- **Phase 0 เป็น hard blocker** — ไม่มี Phase 1 ใดเริ่มได้จนกว่าโปรเจกต์จะ scaffold เสร็จ เพราะไม่มี `package.json`/`prisma/schema.prisma`/`app/` ให้แก้เลย
- **B ก่อน C**: การนำเข้าไฟล์และ master data ต้องรู้ว่าใครอัปโหลด (`ImportBatch.uploadedById`) และจำกัดสิทธิ์เฉพาะผู้จัดการ จึงต้องมี auth+role middleware ก่อน
- **C ก่อน D**: การตั้งเป้าอ้างอิง `ProductType` และรายชื่อ `Salesperson` ซึ่งถูกสร้างขึ้นตอน import เท่านั้น — ตั้งเป้าก่อนมีข้อมูลนำเข้าจะไม่มีตัวเลือกให้เลือก
- **C+D ก่อน E**: KPI engine อ่านทั้ง `SalesLine` (จาก C) และ `Target`/`TargetProductGroup` (จาก D) พร้อมกัน ขาดตัวใดตัวหนึ่งคำนวณไม่ได้
- **E ก่อน F และ G**: ทั้ง Dashboard/Leaderboard (F) และ AI coaching (G) เป็นแค่ชั้นแสดงผลของตัวเลขที่ E คำนวณไว้แล้ว — F และ G ไม่ขึ้นกับกันเอง จึงมอบให้ทำขนานกันได้ถ้ามีทรัพยากรพอ (เช่น backend engineer คนหนึ่งทำ F ต่อ อีกคนทำ G)
- **E+G ก่อน H**: รายงาน coaching ต้องมีทั้งตัวเลข KPI (E) และข้อความจุดแข็ง/จุดที่ควรพัฒนา (G) ก่อนจึงประกอบเป็นรายงาน 1 หน้าได้
- Module I (Cross-sell) ไม่อยู่ในแผนนี้เลย — เป็น dependency ของข้อมูลสะสม 6–12 เดือน ไม่ใช่ของโค้ด ให้ระบบใช้งานจริงสะสมข้อมูลไปก่อน แล้วค่อยกลับมาที่ `business-analyst`/`system-analyst` เพื่อวางแผนเมื่อข้อมูลพอ
- Module ที่ผู้ใช้ระบุว่าต้อง `security` agent ตรวจก่อน deploy จริง: Phase 1 (Auth — รหัสผ่าน/JWT/ข้อมูลส่วนบุคคล), Phase 2 (Import — รับไฟล์จากภายนอก), Phase 6 (AI Coaching — ข้อมูลออกนอกองค์กร + API key)

**Phase 8–10 (Module J → K → L, เพิ่ม 2026-08-16)**

- **ลำดับ J → K → L ถูกล็อกโดย `design.md` ห้ามสลับ และห้ามทำขนานกันแบบที่ F/G เคยทำได้** — K ต้องใช้ชื่อโรงพยาบาล/พนักงานขายที่สะอาดแล้วจาก J (ผ่าน `HospitalAlias`/`SalesmanNameRule`) และ L ต้องใช้ทั้งพื้นที่รับผิดชอบจาก K (`TerritoryAssignment` สถานะ `ACTIVE`) และ `Target` ที่มีอยู่แล้วจาก Module D (Phase 3)
- **Phase 8 (Module J) เปลี่ยนสัญญาของ query การรวมยอดรายคนที่ Phase 4–7 ถูกสร้างและตรวจผ่านไปแล้ว** (`SalesLine.salespersonId` → `SalesLineCredit`) — งานแก้ query ของ Phase 4–7 เป็นส่วนหนึ่งของ Phase 8 เอง ไม่ใช่ cleanup ที่ทำทีหลังได้ และ**ต้องให้ `qa-engineer` ตรวจตัวเลข Phase 4–7 ซ้ำทั้งหมดหลัง Phase 8 implement เสร็จ** โดยมีกฎตรวจอัตโนมัติ: ผลรวมของทุกคน = ยอดบริษัท
- **Phase 8 ถูกตั้ง `🔒 Security gate`** เพราะขยาย logic การนำเข้าไฟล์ (พื้นผิวรับ input จากภายนอกเดียวกับ Module C ที่เป็น required gate อยู่แล้ว) และแตะข้อมูลระบุตัวบุคคล (การรวม/แยกชื่อพนักงานขายและโรงพยาบาลที่มีผู้ตัดสิน `decidedById`)
- **Phase 9 (Module K) ถูกตั้ง `🔒 Security gate` ตามที่ `design.md` ระบุไว้ตรง ๆ** — เพิ่มช่องทางรับไฟล์ Excel จากภายนอกอีกช่องทาง (`POST /registry-import`) ต้องตรวจด้วยเกณฑ์เดียวกับ Module C
- **Phase 9 ไม่จำเป็นต้องรอให้รอบ `qa-engineer` ตรวจ Phase 4–7 ซ้ำของ Phase 8 ปิดรอบก่อนเริ่ม implement** (K ไม่ได้ขึ้นกับตัวเลข KPI ที่ถูกต้อง แค่ขึ้นกับชื่อ `Hospital`/`Salesperson` ที่สะอาดแล้ว) แต่ **`devops` ต้องไม่ deploy Phase 8 จนกว่ารอบตรวจซ้ำนั้นจะปิดสะอาด**
- **Phase 9 มีงานที่ต้องหยุดถามผู้ใช้ก่อนเริ่ม seed**: การจัดจังหวัด นครสวรรค์/กำแพงเพชร/พิจิตร/อุทัยธานี เข้าภาคไหน (Open Question ข้อ 4 ใน `design.md`) — `backend-engineer` ต้องถามก่อน ห้ามเดาเอง เพราะ seed ผิดจะกระทบสูตรศักยภาพทั้งภาคใน Phase 10
- **Phase 10 ไม่ต้องการ `security` gate** — เป็นชั้นคำนวณ/แสดงผลบนข้อมูลที่มีอยู่แล้วในระบบ ไม่มี input ใหม่จากภายนอก เหตุผลเดียวกับ Phase 4/5 ที่ไม่ถูกตั้ง gate
- **ข้อห้ามเด็ดขาดของ Phase 10**: ห้ามแก้สูตรคะแนนรวม 0–100 หรือ `ScoringWeight` ของ Phase 4 ที่ verified แล้ว, ห้ามเพิ่มฟิลด์/ตาราง "เป้าบริษัทรายปี/รายภาค", ห้าม renormalize `suggested` ให้ผลรวมของภาคเท่ากับ `R` — ศักยภาพพื้นที่มีผลต่อ KPI **ผ่านทางตัวเลขเป้าที่ผู้จัดการบันทึกเท่านั้น**
- Module I (Cross-sell) ยังไม่อยู่ในแผนนี้เช่นเดิม เพราะรอข้อมูลสะสม 6–12 เดือน

**Phase 11–16 (Module M/N/O/P, เพิ่ม 2026-08-17)**

- **ลำดับที่ `design.md` ล็อกไว้ห้ามสลับ**: J → **M** → (**N**, **P1**, **O ส่วนที่ 2** ทำขนานกันได้ทั้งสาม) → **K** → (**L**, **P2**) — ในไฟล์นี้คือ Phase 8 → **Phase 12** → (**Phase 13**, **Phase 14**, **Phase 15** ขนานกัน) → **Phase 9** → (**Phase 10**, **Phase 16** ขนานกัน) **Phase 11 (Module O ส่วนที่ 1 — ทะเบียนสินค้า) เป็นข้อยกเว้นเดียว**: ไม่ขึ้นกับเขตเลยตาม `design.md` จึงเริ่มขนานไปกับ Phase 12 ได้ตั้งแต่วันแรก ไม่ต้องรอ M เสร็จก่อน
- **Phase 12 (Module M) เริ่มได้ทันที ไม่ต้องรอ Phase 8 (Module J) ปิดรอบ QA ก่อน** — ผู้ใช้เลือกไว้ตรง ๆ (`design.md` การตัดสินใจแถวที่ 20 / Risks ข้อ 26) ให้ทำ M ขนานไปกับงานหน้าจอ/QA ที่ยังค้างของ Phase 8 แทนการรอให้ Phase 8 ปิดรอบให้จบก่อน เงื่อนไขเดียวคือ backend ของ J (`SalesLineCredit`, `creditResolution.service.ts`, `nameNormalizer.util.ts`) ต้องมีอยู่แล้วซึ่งมีอยู่แล้วจริงในโค้ดปัจจุบัน — **ความเสี่ยงที่รับไว้แล้ว**: ตัวเลขในรายงาน Phase 13–16 อาจขยับเมื่อ `qa-engineer` ตรวจ Phase 8 เสร็จและพบว่าต้องแก้การรวมชื่อซ้ำเพิ่ม เพราะ bootstrap ของ Phase 12 อิงยอดจาก `SalesLineCredit` ตรง ๆ และทุกรายงานคำนวณสดไม่มี cache จึงสะท้อนข้อมูลที่แก้แล้วทันทีโดยไม่ต้อง rebuild
- **Phase 12 (Module M) เปลี่ยนสัญญาของ query ที่ Phase 3/4 ถูกสร้างและตรวจผ่านไปแล้ว** (`Target.salespersonId` เปลี่ยนเป็น nullable + เพิ่ม `scope`) — งานแก้ query/validator ของ Phase 3 (targets CRUD) และ Phase 4 (`kpi.service.ts` อ่านเป้ารายคน) เป็นส่วนหนึ่งของ Phase 12 เอง ไม่ใช่ cleanup ที่ทำทีหลังได้ (รูปแบบเดียวกับที่ Module J เคยบังคับให้ตรวจ Phase 4–7 ซ้ำ) และ **ต้องให้ `qa-engineer` ตรวจ Phase 3 และ Phase 4 ซ้ำแบบ TARGETED (ไม่ใช่ FULL) หลัง Phase 12 implement เสร็จ** — ขอบเขตของรอบ TARGETED นั้นคือทุก endpoint ที่อ่าน/เขียน `Target` บวก blast radius ของ `kpi.service.ts` ที่อ่านเป้า บวกกฎตรวจอัตโนมัติ: ทุกแถว `Target` มี `territoryId` หรือ `salespersonId` อย่างใดอย่างหนึ่งเท่านั้น
- **Phase 12 ถูกตั้ง `🔒 Security gate`** เพราะมี endpoint แก้ตัวเลขเป้า (`PUT /territory-assignments`, `PUT /targets/:territoryId/:year/:month`) ซึ่งอยู่ในระดับความอ่อนไหวเดียวกับ endpoint ตั้งเป้าของ Module D — `security` ต้องตรวจสิทธิ์ MANAGER ให้ครบทุก endpoint ใหม่ของเฟสนี้
- **Phase 9 (Module K) และ Phase 10 (Module L) เขียนไว้ในไฟล์นี้ก่อนรอบนี้ (ยังไม่มีงานเริ่ม ไม่มี `[x]` เลย) เลขเฟสจึงยังน้อยกว่า Phase 12–15 แต่ลำดับการ implement จริงต้องขยับไปอยู่หลัง Phase 15 เสมอ** — `design.md` ล็อกลำดับใหม่ให้ K มาหลัง M/N/P1/O2 ไม่ใช่หลัง J ตรง ๆ แบบเดิม **ห้ามเริ่ม Phase 9 ก่อน Phase 12–15 เสร็จ แม้เลขเฟสจะน้อยกว่าก็ตาม** — เมื่อถึงเวลาทำ Phase 9 จริง มีจุดที่ต้องแก้ตัว task list เดิม 2 จุด (ตัว task ยังไม่ถูกแก้ในรอบนี้เพราะยังไม่ถึงคิว แต่ `backend-engineer` ต้องรู้ก่อนเริ่ม):
  1. **task แรกของ Phase 9 ที่เขียนว่าให้สร้าง `TerritoryAssignment` ตาม Data Model — ห้ามทำซ้ำ** ตารางนี้ถูกสร้างไปแล้วด้วยนิยามใหม่ตอน Phase 12 (Module M) migration ของ Phase 9 ต้อง **ข้าม** `TerritoryAssignment` ไปเลย
  2. **คอลัมน์ `territoryId`/`territorySource` บน `HospitalRegistry`** (ที่ `design.md` ระบุไว้คู่กับ `Hospital`) ยังไม่ได้เพิ่มตอน Phase 12 เพราะโมเดล `HospitalRegistry` ยังไม่มีอยู่ตอนนั้น — ต้องเพิ่ม 2 คอลัมน์นี้พร้อมกับตอนสร้าง `HospitalRegistry` เองใน migration ของ Phase 9
- **Phase 16 (Module P2) ขึ้นกับ Phase 9 (Module K) เท่านั้น ไม่ขึ้นกับ Phase 10 (Module L)** — ทำขนานกับ Phase 10 ได้ทั้งคู่หลัง Phase 9 เสร็จ (เหมือนที่ F/G เคยทำขนานกันได้)
- Module I (Cross-sell) ยังไม่อยู่ในแผนนี้เช่นเดิม เพราะรอข้อมูลสะสม 6–12 เดือน

## Unresolved Open Questions

รายการด้านล่างไม่ block การเริ่ม Phase 0/1 — เป็นการตัดสินใจที่ทำเพิ่มได้ทีหลังโดยไม่กระทบ schema:

1. **คำสั่ง "ลบข้อมูลตามงวด"** (Open Question ข้อ 1 ใน `design.md`) — ถ้าผู้ใช้ต้องการฟีเจอร์นี้ จะเป็นงาน `[backend]` endpoint ลบ + `[frontend]` UI เพิ่มเข้า Phase 2 ภายหลัง ไม่ต้องแก้ schema
2. **ความถี่ในการนำเข้าไฟล์** — ไม่กระทบการวางแผนหรือลำดับงาน มีผลแค่ความสดของ Dashboard
3. **การให้คะแนนเมื่อทำเกินเป้า** (`achievementCapPercent`) — ยังไม่ทำใน MVP นี้ ถ้าต้องการภายหลังต้อง amend `design.md` ก่อน (เพิ่ม field ใหม่ใน `EvaluationSetting`) แล้วค่อยเพิ่ม task ใน Phase 4
4. **สิทธิ์เรียก `POST /coaching-insights/:salespersonId/generate`** — `design.md` ไม่ได้ระบุชัดว่าพนักงานขายกดสร้าง insight ของตัวเองได้ไหม หรือต้องเป็นผู้จัดการเท่านั้น ระบุไว้ใน Phase 6 ว่าต้องตรวจ `requirement.md` เพิ่มเติม — ถ้ายังไม่ชัดตอนเริ่ม Phase 6 ให้ backend-engineer ถามผู้ใช้ตรง ๆ ก่อน implement (ไม่ใช่เดา)
5. **การจัด 4 จังหวัดเข้าภาค** (นครสวรรค์ กำแพงเพชร พิจิตร อุทัยธานี — Open Question ข้อ 4 ใน `design.md`) — ไม่ block การเริ่ม Phase 8 เพราะไม่กระทบ Module J แต่ **block เฉพาะขั้นตอน seed `ProvinceMapping` ใน Phase 9** ต้องถามผู้ใช้ก่อนตอนถึงงานนั้น
6. **สัดส่วนการแบ่งเครดิตดีล** (`design.md` Open Question ข้อ 3) — ออกแบบให้ค่าเริ่มต้นเป็น "แบ่งเท่ากันทุกคน" แก้รายบรรทัดได้ทีหลังผ่านหน้าคิวยืนยันใน Phase 8 ไม่ block การเริ่มงาน
7. **แหล่งที่มาของรหัสสินค้า** (`requirement.md` Open Question ข้อ 11) — ✅ ปิดแล้วใน `design.md` รอบ 2026-08-16 (รอบที่ 2): รหัสมาจากทะเบียนสินค้าในระบบ ไม่ใช่คอลัมน์ในไฟล์ Excel ดู Phase 11 — คำถามที่แตกออกมาแทนและยังค้าง: ผู้ใช้จะส่งไฟล์แคตตาล็อกสินค้าทั้งหมดของบริษัทมาเมื่อไหร่ (ระยะ 2)
8. **คำสั่ง "ลบข้อมูลตามงวด"** และ **การให้คะแนนเมื่อทำเกินเป้า** (`achievementCapPercent`) — ยังค้างจาก MVP เดิม (ดูข้อ 1 และข้อ 3 ด้านบน) ไม่กระทบ Phase 8–16
9. **การแตกตัวเลขเป้า 14M (Tasanee: กท1+ภาคตะวันตก) / 13M (Tanyapat: กท2+ภาคกลาง) เป็นรายเขต** (`design.md` Open Question ข้อ 11) — ยังไม่ได้ตัวเลขที่แตกแล้ว **ไม่ block การเริ่ม/implement Phase 12** (หน้าตั้งเป้าระดับเขตสร้างได้เลย) แต่ **block เฉพาะการกรอกเป้าจริงของ 2 เขตนี้ให้ครบ** — จนกว่าจะได้ตัวเลข เขตทั้งสองจะแสดง "ยังไม่ได้ตั้งเป้า" ตามกฎเดิมของ `REVENUE_VS_TARGET`
10. **วันที่พ้นสภาพจริงของพนักงาน 3 คนที่ลาออก** (`requirement.md` OQ20 / `design.md` Open Question ข้อ 12) — ยังไม่ได้รับคำตอบ **ไม่ block Phase 12** (ตั้ง `TerritoryAssignment.effectiveTo`/`Salesperson.employmentEndedAt` เป็น `null` แล้วแก้ทีหลังได้) แต่ตัวเลข `activeOwnerCount` ของงวดย้อนหลังใน Phase 12/13 จะยังไม่ตรงจนกว่าจะได้วันที่จริง
11. **การแยกเครดิตภายในเขตที่มีหลายคนดูแล** (`requirement.md` OQ22 / `design.md` Open Question ข้อ 13) — Phase 12 implement ด้วยกฎ "หารเท่ากันตามจำนวนผู้ดูแล" ไปก่อนตามที่ผู้ใช้เลือกและรับทราบว่าเป็นการชิงตัดสิน ถ้า OQ22 ปิดด้วยกฎอื่นภายหลัง ต้องกลับมาแก้สูตร `derivedTarget` ใน Phase 12 เท่านั้น (แก้ที่เดียว ไม่ต้อง migrate เพราะไม่มีการเขียนค่าลงฐานข้อมูล)
12. **การจัด 4 จังหวัดเข้าภาค** (นครสวรรค์/กำแพงเพชร/พิจิตร/อุทัยธานี) — ยังคงเป็น blocker เฉพาะขั้นตอน seed `ProvinceMapping` ใน Phase 9 (Module K) เหมือนเดิม (ดูข้อ 5 ด้านบน) ไม่กระทบ Phase 11–16

## Change Log

- 2026-08-14 — สร้างแผนครั้งแรกจาก `design.md` (confirmed) และ `requirement.md` แบ่งเป็น Phase 0 (setup, ไม่ใช่ frontend/backend) + Phase 1–7 ตรงกับ module B–H ตามลำดับ dependency ที่ยืนยันแล้ว (A→B→C→D→E→(F,G)→H) Module I (Cross-sell) ไม่รวมในแผนเพราะรอข้อมูลสะสม
- 2026-08-16 — เพิ่ม Phase 8 (Module J: ซ่อมข้อมูลชื่อซ้ำ + แบ่งเครดิตดีล, 🔒 Security gate), Phase 9 (Module K: ทะเบียนโรงพยาบาล/ภาค/พื้นที่รับผิดชอบ, 🔒 Security gate), Phase 10 (Module L: คะแนนศักยภาพพื้นที่ + ตัวช่วยตั้งเป้า) ต่อจาก Phase 7 ตามลำดับ dependency J→K→L ที่ `design.md` ล็อกไว้ห้ามสลับ/ห้ามขนาน แหล่งที่มา: `design.md` ส่วนขยาย 2026-08-16 (Data Model, Territory & Potential Rules, Modules J/K/L, Risks ข้อ 13–20, Open Questions ข้อ 1–5) ปิด blocker ครบทั้ง 3 ข้อแล้วก่อนจัดเฟสนี้ · เพิ่ม Sequencing Notes อธิบายเหตุผล security gate ของ Phase 8/9, จุดที่ Phase 9 ไม่ต้องรอ Phase 8's QA re-verify, และจุดที่ต้องหยุดถามผู้ใช้ก่อน seed 4 จังหวัด · เพิ่ม Open Questions ข้อ 5–8
- 2026-08-17 — เพิ่ม Phase 11 (Module O ส่วนที่ 1: ทะเบียนสินค้า, ขนานกับ Phase 12 ได้ตั้งแต่วันแรก), Phase 12 (Module M: โครงสร้างเขต + เป้าระดับเขต, 🔒 Security gate, รวมงานแก้ query Phase 3/4 ที่ `Target` re-scope ทำลายสัญญา), Phase 13 (Module N: KPI รายเขต + รายงาน), Phase 14 (Module P1: มุมมองรายเซลล์ ส่วนที่ 1 — ขายได้แล้ว), Phase 15 (Module O ส่วนที่ 2: อันดับสินค้ารายเขต), Phase 16 (Module P2: มุมมองรายเซลล์ ส่วนที่ 2 — ยังไม่เคยขายเลย ขึ้นกับ Phase 9) ตามลำดับ dependency ใหม่ที่ `design.md` ล็อกไว้ **J → M → (N, P1, O ส่วนที่ 2) → K → (L, P2)** แหล่งที่มา: `design.md` ส่วนขยาย 2026-08-16 รอบที่ 2 (Data Model ส่วนขยายเขต/ทะเบียนสินค้า, Territory KPI Rules, Product Master & Ranking Rules, Modules M/N/O/P, Risks ข้อ 21/26, Open Questions ข้อ 11–15) — ไม่มี blocker ค้างที่กันการจัดเฟสนี้ · **ไม่แก้เนื้อหา task ของ Phase 9/10 เดิม** (ยังไม่มีงานเริ่ม ไม่มี `[x]`) แต่เพิ่ม Sequencing Notes อธิบายว่าเลขเฟส 9/10 ไม่ตรงกับลำดับ implement จริงอีกต่อไป (ต้องขยับไปอยู่หลัง Phase 15) พร้อมชี้จุดที่ต้องแก้ตอนถึงคิว Phase 9 จริง (ห้ามสร้าง `TerritoryAssignment` ซ้ำ, ต้องเพิ่ม `territoryId`/`territorySource` บน `HospitalRegistry` ตอนนั้นแทน) · เพิ่ม Sequencing Notes อธิบายเหตุผลที่ Phase 12 เริ่มขนานกับงานค้างของ Phase 8 ได้ (ผู้ใช้ยืนยันแล้ว, ความเสี่ยงข้อ 26), เหตุผล security gate ของ Phase 12, และข้อกำหนด TARGETED QA re-check ของ Phase 3/4 หลัง Phase 12 · เพิ่ม Open Questions ข้อ 9–12 (แตกเป้า 14M/13M, วันที่พ้นสภาพพนักงาน, การแยกเครดิตในเขต, 4 จังหวัดยังเป็น blocker เฉพาะ seed ของ Phase 9) · ปิด Open Questions ข้อ 7 เดิม (แหล่งที่มารหัสสินค้า) ตามที่ `design.md` ปิดแล้ว
