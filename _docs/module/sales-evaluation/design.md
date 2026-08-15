# ระบบประเมินและสนับสนุนพนักงานขาย (Sales Evaluation & Enablement) — Feasibility & Design

## Feasibility Summary

**ทำได้ทั้งหมดด้วย stack ปัจจุบัน (Next.js App Router + TypeScript + Tailwind + Zustand / Node + Express + PostgreSQL + Prisma + REST + JWT เขียนเอง + Zod)** ไม่มีฟีเจอร์ใดใน MVP ที่หลุดออกนอก stack ส่วนที่ต้องเพิ่ม dependency มี 4 จุดและล้วนเป็นไลบรารีมาตรฐาน ได้แก่ การอ่านไฟล์ Excel, การรับไฟล์อัปโหลด, การเรียก Gemini API และการสร้างไฟล์ Excel สำหรับ export

ความเสี่ยงจริงของโปรเจกต์นี้ไม่ได้อยู่ที่เทคโนโลยี แต่อยู่ที่ **ปริมาณข้อมูลที่มีเพียง ~1 ไตรมาส (862 แถวใน sheet แรกของไฟล์ตัวอย่าง)** ซึ่งทำให้ KPI 2 ใน 5 ตัว (การรักษาลูกค้า และความสม่ำเสมอของยอด) ยังคำนวณอย่างมีความหมายไม่ได้จนกว่าจะสะสมข้อมูลครบ 6 เดือน ระบบจึงถูกออกแบบให้ **ประกาศตรง ๆ ว่า KPI ตัวไหนยังไม่พร้อม แล้วเฉลี่ยน้ำหนักคะแนนใหม่เฉพาะเกณฑ์ที่คำนวณได้** แทนการแสดงตัวเลขที่ทำให้เข้าใจผิด

ปริมาณข้อมูลเล็กมาก (~3,500 แถว/ปี, ~10,000 แถวใน 3 ปี) จึงไม่จำเป็นต้องมีตาราง cache ผล KPI — คำนวณสดทุกครั้งเร็วพอและไม่มีปัญหาค่าค้างเมื่อผู้จัดการแก้เป้าย้อนหลัง สิ่งเดียวที่ cache คือผลลัพธ์จาก AI เพราะมีค่าใช้จ่ายต่อครั้ง

**ข้อสังเกตที่ควรรู้ล่วงหน้า**: ฟีเจอร์ที่ผู้ใช้ให้คุณค่าสูงสุด (ชี้จุดอ่อน + coaching) คือฟีเจอร์ที่พึ่งพาข้อมูลย้อนหลังมากที่สุด ในช่วง 3–6 เดือนแรกคำแนะนำจะอ้างอิงได้จริงแค่ "ยอดขาย vs เป้า" กับ "ยอดตามกลุ่มสินค้า" เท่านั้น คุณภาพของฟีเจอร์นี้จะดีขึ้นเองตามเวลาโดยไม่ต้องแก้โค้ด

---

## Feature-by-Feature Feasibility

| # | ฟีเจอร์ (MVP) | ผลประเมิน | หมายเหตุ |
|---|---|---|---|
| 1 | นำเข้าข้อมูลการขายจาก Excel | **ต้องเพิ่ม dependency** | `exceljs` (อ่าน .xlsx) + `multer` (รับไฟล์) — โครงสร้างไฟล์จริงตรวจแล้ว: ปีเป็น ค.ศ., `Inv Date` เป็น date serial ของ Excel, header อยู่แถว 2 กฎการแปลงและตรวจสอบทั้งหมดอยู่ในหัวข้อ Import Rules |
| 2 | หน้าตรวจดูข้อมูลการขายที่นำเข้าแล้ว | ตรงไปตรงมา | ตาราง + filter (พนักงานขาย / โรงพยาบาล / ช่วงเวลา / กลุ่มสินค้า) + pagination ฝั่ง server |
| 3 | ตั้งเป้าหลายมิติรายคนรายเดือน + ประวัติการแก้ไข | ตรงไปตรงมา | ใช้ตาราง audit แยก (`TargetRevision`) เก็บ snapshot ก่อน/หลัง ครบตามที่ requirement ขอ (ใครแก้ เมื่อไหร่ จากเท่าไหร่เป็นเท่าไหร่) |
| 4 | คำนวณ KPI รายเดือน/ไตรมาส/ปี | ตรงไปตรงมา | คำนวณสดด้วย Prisma aggregate/groupBy นิยามทุกตัวถูกล็อกไว้ในหัวข้อ KPI & Scoring Rules |
| 5 | Dashboard ส่วนตัวพนักงานขาย | **ต้องเพิ่ม dependency (เล็ก)** | `recharts` สำหรับกราฟแนวโน้ม/สัดส่วน |
| 6 | คะแนนรวม 0–100 + คะแนนแยก + หน้าตั้งค่าน้ำหนัก | ตรงไปตรงมา | ช่องโหว่เชิงนิยาม (KPI ที่คำนวณไม่ได้) ปิดแล้วด้วยกฎ renormalize — ดู KPI & Scoring Rules |
| 7 | Leaderboard ชื่อจริง สลับเกณฑ์/ช่วงเวลา | ตรงไปตรงมา | — |
| 8 | สรุปจุดแข็ง–จุดที่ควรพัฒนา ด้วย AI ภายนอก | **ต้องเพิ่ม dependency ภายนอก** | Gemini API — ส่งเฉพาะ KPI ที่คำนวณเสร็จแล้ว ปิดบังชื่อก่อนส่ง สร้างครั้งเดียวแล้วเก็บ มีปุ่มสร้างใหม่ และต้องมี fallback เป็นข้อความ rule-based เมื่อเรียกไม่สำเร็จ |
| 9 | รายงาน coaching + Export | **ต้องเพิ่ม dependency** | `exceljs` (ใช้ตัวเดียวกับ import) — ผู้ใช้เลือก Excel อย่างเดียว ไม่ต้องทำ PDF จึงเลี่ยงปัญหาฟอนต์ไทยและการใช้ headless browser บน Render ไปได้ทั้งหมด |
| 10 | Responsive มือถือ + เดสก์ท็อป | ตรงไปตรงมา | Tailwind |
| 11 | Login + จัดการบัญชีผู้ใช้ | ตรงไปตรงมา | JWT เขียนเอง + `bcrypt` ผู้ใช้ 15 คน ไม่ต้องมี session store ฝั่ง server |
| — | Cross-sell 3 รูปแบบ (Later) | ทำได้ แต่ยังไม่ควรทำตอนนี้ | ข้อมูล 1 ไตรมาสจะให้ข้อเสนอที่ผิดพลาดจนทำให้พนักงานขายหลงทาง เลื่อนไปเฟสหลังตามที่ requirement ระบุ |
| — | กำไรขั้นต้น (Gross Margin) | **นอกขอบเขต — ไม่มีข้อมูล** | ไฟล์ไม่มีคอลัมน์ต้นทุน ยืนยันจากไฟล์จริงแล้ว ไม่ใช่เรื่องความยากทางเทคนิค |
| — | กิจกรรมการขาย / ความแม่นของ forecast | **นอกขอบเขต — ไม่มีข้อมูล** | ต้องมีหน้าให้พนักงานขายคี่ย์เอง ตัดออกจาก MVP ตามที่ผู้ใช้ตัดสินใจ |

**การตัดสินใจที่ผู้ใช้ยืนยันแล้ว (2026-08-14)** — ใช้เป็นฐานของ design ฉบับนี้

| # | ประเด็น | ข้อสรุป |
|---|---|---|
| 1 | ปี/วันที่ในไฟล์ | `Year` เป็น ค.ศ. อยู่แล้ว, `Inv Date` เป็น date serial ของ Excel, `Month` เป็น 1-12 |
| 2 | นำเข้าไฟล์ซ้ำ | **ทับด้วยค่าใหม่ (upsert)** ตามคีย์กันซ้ำ |
| 3 | ลูกค้าใหม่ | นับ **ใหม่ต่อบริษัท** + ผู้จัดการติ๊กลูกค้าเดิมไว้ก่อนได้ (`isPreExistingCustomer`) |
| 4 | คะแนนรวมเมื่อ KPI คำนวณไม่ได้ | **เฉลี่ยน้ำหนักใหม่เฉพาะเกณฑ์ที่คำนวณได้** + แสดง "คิดจาก X/5 เกณฑ์" |
| 5 | churn | ไม่สั่ง **6 เดือน** (แก้ได้ในหน้าตั้งค่า) |
| 6 | AI | **Gemini**, สร้างครั้งเดียวเก็บไว้ + ปุ่มสร้างใหม่, **เปิดการปิดบังชื่อ** ก่อนส่ง |
| 7 | Login | ใช้ **อีเมลเป็น identifier เฉย ๆ ไม่มีการส่งอีเมลจริง** — ไม่มีฟังก์ชัน "ลืมรหัสผ่าน" ทางอีเมล ผู้จัดการเป็นคนรีเซ็ตรหัสผ่านให้ ไม่เพิ่ม dependency บริการส่งอีเมล |
| 12 | sheet ในไฟล์ Excel | นำเข้า **sheet แรกเท่านั้น** sheet อื่นข้ามทั้งหมด |
| 13 | ลืมรหัสผ่าน | ผู้จัดการรีเซ็ตให้ + บังคับเปลี่ยนรหัสครั้งแรก (`mustChangePassword`) ไม่มีตาราง token และไม่มีบริการส่งอีเมล |
| 8 | Export | **Excel อย่างเดียว** |
| 9 | ยอดติดลบ/ใบลดหนี้ | **ไม่มี** — ไม่ทำ logic พิเศษ แต่ยังขึ้นเตือนถ้าเจอ |
| 10 | น้ำหนักคะแนน | **50 / 15 / 15 / 10 / 10** ตามที่เสนอ |
| 11 | `Year`/`Month` ไม่ตรงกับ `Inv Date` | **ยึด `Year`/`Month`** เป็นงวดบัญชี แล้วขึ้นเตือน |

---

## Data Model

Prisma schema ที่ยืนยันกับผู้ใช้แล้ว — `backend-engineer` ต้อง implement ตามนี้ทุกตัวอักษร รวมถึงชื่อฟิลด์ ถ้างานใดต้องการข้อมูลที่ schema นี้ไม่มี ให้หยุดและส่งกลับมาที่ `system-analyst` ห้ามเพิ่ม/เปลี่ยนชื่อฟิลด์เอง

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------- Auth & People ----------

enum UserRole {
  MANAGER
  SALESPERSON
}

model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  passwordHash       String
  displayName        String
  role               UserRole
  isActive           Boolean   @default(true)
  mustChangePassword Boolean   @default(true)
  lastLoginAt        DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  salesperson       Salesperson?
  importBatches     ImportBatch[]
  targetRevisions   TargetRevision[]
  weightRevisions   ScoringWeightRevision[]
  settingUpdates    EvaluationSetting[]
  generatedInsights CoachingInsight[]
}

// แยกจาก User เพราะ (ก) ผู้จัดการไม่มียอดขาย (ข) ไฟล์อาจมีชื่อพนักงานขายที่ยังไม่มีบัญชี
// หรือไม่มีบัญชีแล้ว แต่ยอดเก่ายังต้องคงอยู่
model Salesperson {
  id          String   @id @default(cuid())
  nameInFile  String   @unique
  displayName String
  isActive    Boolean  @default(true)
  userId      String?  @unique
  user        User?    @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  salesLines SalesLine[]
  targets    Target[]
  insights   CoachingInsight[]
}

model Hospital {
  id                    String   @id @default(cuid())
  nameInFile            String   @unique
  displayName           String
  province              String?
  isPreExistingCustomer Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  salesLines SalesLine[]
}

// ---------- Product master ----------

model ProductType {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())

  products            Product[]
  salesLines          SalesLine[]
  targetProductGroups TargetProductGroup[]
}

model Product {
  id            String      @id @default(cuid())
  name          String
  productTypeId String
  productType   ProductType @relation(fields: [productTypeId], references: [id])
  createdAt     DateTime    @default(now())

  salesLines SalesLine[]

  @@unique([name, productTypeId])
}

// ---------- Sales fact ----------

model SalesLine {
  id              String      @id @default(cuid())
  invoiceNo       String
  poNo            String?
  invoiceDate     DateTime    @db.Date
  year            Int
  month           Int
  hospitalId      String
  hospital        Hospital    @relation(fields: [hospitalId], references: [id])
  salespersonId   String
  salesperson     Salesperson @relation(fields: [salespersonId], references: [id])
  productId       String
  product         Product     @relation(fields: [productId], references: [id])
  productTypeId   String
  productType     ProductType @relation(fields: [productTypeId], references: [id])
  lot             String?
  expiryDate      DateTime?   @db.Date
  province        String?
  qty             Decimal     @db.Decimal(14, 2)
  unitPrice       Decimal     @db.Decimal(14, 2)
  amount          Decimal     @db.Decimal(14, 2)
  vat             Decimal     @db.Decimal(14, 2)
  total           Decimal     @db.Decimal(14, 2)
  rowKey          String      @unique
  sourceSheetName String
  sourceRowNumber Int
  importBatchId   String
  importBatch     ImportBatch @relation(fields: [importBatchId], references: [id])
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([salespersonId, year, month])
  @@index([hospitalId, invoiceDate])
  @@index([productTypeId, year, month])
  @@index([year, month])
  @@index([invoiceNo])
}

// ---------- Import ----------

enum ImportStatus {
  PROCESSING
  SUCCESS
  PARTIAL
  FAILED
}

enum ImportIssueLevel {
  WARNING
  ERROR
}

model ImportBatch {
  id             String       @id @default(cuid())
  fileName       String
  fileSizeBytes  Int
  uploadedById   String
  uploadedBy     User         @relation(fields: [uploadedById], references: [id])
  startedAt      DateTime     @default(now())
  finishedAt     DateTime?
  status         ImportStatus @default(PROCESSING)
  sheetsFound    Json?
  sheetsImported Json?
  totalRows      Int          @default(0)
  insertedRows   Int          @default(0)
  updatedRows    Int          @default(0)
  skippedRows    Int          @default(0)
  errorRows      Int          @default(0)
  periodsTouched Json?
  errorMessage   String?

  salesLines SalesLine[]
  issues     ImportIssue[]
}

model ImportIssue {
  id            String           @id @default(cuid())
  importBatchId String
  importBatch   ImportBatch      @relation(fields: [importBatchId], references: [id], onDelete: Cascade)
  sheetName     String?
  rowNumber     Int?
  columnName    String?
  level         ImportIssueLevel
  code          String
  message       String
  rawRow        Json?

  @@index([importBatchId, level])
}

// ---------- Targets ----------

model Target {
  id                String      @id @default(cuid())
  salespersonId     String
  salesperson       Salesperson @relation(fields: [salespersonId], references: [id])
  year              Int
  month             Int
  revenueTarget     Decimal     @default(0) @db.Decimal(14, 2)
  newCustomerTarget Int         @default(0)
  note              String?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  productGroupTargets TargetProductGroup[]
  revisions           TargetRevision[]

  @@unique([salespersonId, year, month])
  @@index([year, month])
}

model TargetProductGroup {
  id            String      @id @default(cuid())
  targetId      String
  target        Target      @relation(fields: [targetId], references: [id], onDelete: Cascade)
  productTypeId String
  productType   ProductType @relation(fields: [productTypeId], references: [id])
  revenueTarget Decimal     @db.Decimal(14, 2)

  @@unique([targetId, productTypeId])
}

enum TargetChangeType {
  CREATE
  UPDATE
  DELETE
}

model TargetRevision {
  id          String           @id @default(cuid())
  targetId    String
  target      Target           @relation(fields: [targetId], references: [id], onDelete: Cascade)
  changeType  TargetChangeType
  before      Json?
  after       Json?
  changedById String
  changedBy   User             @relation(fields: [changedById], references: [id])
  changedAt   DateTime         @default(now())
  note        String?

  @@index([targetId, changedAt])
}

// ---------- Scoring config ----------

enum KpiMetric {
  REVENUE_VS_TARGET
  NEW_CUSTOMERS
  PRODUCT_GROUP
  RETENTION
  CONSISTENCY
}

model ScoringWeight {
  id        String    @id @default(cuid())
  metric    KpiMetric @unique
  weight    Int
  updatedAt DateTime  @updatedAt
}

model ScoringWeightRevision {
  id          String   @id @default(cuid())
  before      Json
  after       Json
  changedById String
  changedBy   User     @relation(fields: [changedById], references: [id])
  changedAt   DateTime @default(now())
  note        String?
}

model EvaluationSetting {
  id                      String   @id @default("singleton")
  churnMonths             Int      @default(6)
  minMonthsForChurn       Int      @default(6)
  minMonthsForConsistency Int      @default(6)
  aiEnabled               Boolean  @default(true)
  aiAnonymize             Boolean  @default(true)
  updatedById             String?
  updatedBy               User?    @relation(fields: [updatedById], references: [id])
  updatedAt               DateTime @updatedAt
}

// ---------- AI coaching ----------

enum PeriodType {
  MONTH
  QUARTER
  YEAR
}

enum InsightStatus {
  PENDING
  SUCCESS
  FAILED
}

model CoachingInsight {
  id            String        @id @default(cuid())
  salespersonId String
  salesperson   Salesperson   @relation(fields: [salespersonId], references: [id])
  periodType    PeriodType
  year          Int
  periodNumber  Int
  kpiSnapshot   Json
  contentTh     String?
  status        InsightStatus @default(PENDING)
  provider      String?
  model         String?
  errorMessage  String?
  isStale       Boolean       @default(false)
  generatedById String?
  generatedBy   User?         @relation(fields: [generatedById], references: [id])
  generatedAt   DateTime      @default(now())

  @@unique([salespersonId, periodType, year, periodNumber])
  @@index([year, periodType])
}
```

### หมายเหตุประกอบ schema

- **ไม่มีตาราง cache ผล KPI โดยตั้งใจ** — ข้อมูลเล็กมาก คำนวณสดเร็วพอ และไม่มีความเสี่ยงค่าค้างเมื่อผู้จัดการแก้เป้าหรือนำเข้าไฟล์แก้ไขย้อนหลัง สิ่งที่ cache มีเพียง `CoachingInsight` เพราะมีค่าใช้จ่ายต่อการเรียก
- **ไม่มีตาราง session/refresh token** — JWT เขียนเองแบบ stateless เพียงพอสำหรับผู้ใช้ 15 คน การ logout คือการลบ token ฝั่ง client
- `SalesLine.unitPrice` = คอลัมน์ `Price` ในไฟล์ ซึ่งจากไฟล์จริง **เป็นราคาต่อหน่วยที่รวม VAT แล้ว** (`Amount = ROUND(Qty*Price*100/107, 2)`) จึงได้ `Total = Qty × Price`
- `SalesLine.productTypeId` เป็นการ denormalize จาก `Product` โดยตั้งใจ เพื่อ query เป้ากลุ่มสินค้าและ penetration โดยไม่ต้อง join ทุกครั้ง — ตอน import ต้องเซ็ตให้ตรงกับ `product.productTypeId` เสมอ
- `Hospital.province` เก็บค่าล่าสุดที่พบสำหรับการ filter ส่วน `SalesLine.province` เก็บค่าดิบรายบรรทัดไว้ตรวจย้อน
- `Product` unique ที่ `[name, productTypeId]` ไม่ใช่ `name` เดี่ยว ๆ เพื่อกันการนำเข้าล้มถ้าไฟล์มีสินค้าชื่อเดียวกันในคนละกลุ่ม
- `EvaluationSetting` เป็น singleton (`id = "singleton"`) `setup`/seed ต้องสร้างแถวนี้พร้อมค่าเริ่มต้น และ seed `ScoringWeight` ครบ 5 แถวตามน้ำหนัก 50/15/15/10/10
- `CoachingInsight.periodNumber` ใช้ 1-12 เมื่อ `periodType = MONTH`, 1-4 เมื่อ `QUARTER`, และ `0` เมื่อ `YEAR`
- `CoachingInsight.kpiSnapshot` เก็บ payload ที่ส่งออกไปให้ AI จริง เพื่อให้ `security` และผู้ใช้ตรวจย้อนได้ว่าข้อมูลอะไรออกนอกองค์กรไปบ้าง

---

## Import Rules (สัญญาการนำเข้า)

กฎเหล่านี้เป็นส่วนหนึ่งของสัญญาเช่นเดียวกับ schema — `backend-engineer` implement ตามนี้ และ `qa-engineer` ตรวจตามนี้

**การเลือก sheet** — นำเข้า **sheet แรกของไฟล์เท่านั้น** (ยืนยันโดยผู้ใช้ 2026-08-14) sheet อื่นที่พบในไฟล์ให้ข้ามทั้งหมด และบันทึกชื่อไว้เป็น `WARNING` รหัส `SHEET_IGNORED` เพื่อให้ผู้จัดการเห็นว่ามีชีตอื่นที่ไม่ได้ถูกนำเข้า

**การหาแถว header** — ภายใน sheet แรก ค้นหาแถว header ใน 10 แถวแรก โดยดูว่ามีชื่อคอลัมน์ที่ต้องการครบหรือไม่ (เทียบแบบไม่สนตัวพิมพ์และตัดช่องว่างหัวท้าย) รองรับไฟล์จริงที่ header อยู่แถว 2 และข้อมูลเริ่มแถว 3 ถ้าหา header ไม่พบ → ยกเลิกทั้งไฟล์ `status = FAILED` รหัส `HEADER_NOT_FOUND` ห้ามเดาตำแหน่ง

**การจับคู่คอลัมน์**

| คอลัมน์ในไฟล์ | ฟิลด์ | การแปลง |
|---|---|---|
| Hospital Name | `Hospital.nameInFile` | trim, สร้างอัตโนมัติถ้ายังไม่มี |
| Salesman | `Salesperson.nameInFile` | trim, สร้างอัตโนมัติถ้ายังไม่มี |
| Inv Date | `SalesLine.invoiceDate` | Excel date serial → `Date` |
| Year | `SalesLine.year` | ค.ศ. อยู่แล้ว ใช้ตรง ๆ |
| Month | `SalesLine.month` | 1-12 |
| Inv No. | `SalesLine.invoiceNo` | trim |
| Po NO. | `SalesLine.poNo` | trim, ว่างได้ |
| Product type | `ProductType.name` | trim, สร้างอัตโนมัติถ้ายังไม่มี |
| Product Name | `Product.name` | trim, สร้างอัตโนมัติถ้ายังไม่มี |
| Lot / Exp | `lot` / `expiryDate` | เก็บอ้างอิง ไม่ใช้คำนวณ KPI |
| Province | `SalesLine.province` + อัปเดต `Hospital.province` | trim |
| Qty / Price / Amount / Vat / Total | ฟิลด์ชื่อเดียวกัน (`Price` → `unitPrice`) | Decimal |

**กฎการตรวจสอบ** (`code` ที่บันทึกลง `ImportIssue`)

| ระดับ | code | เงื่อนไข | การจัดการ |
|---|---|---|---|
| ERROR | `MISSING_REQUIRED` | `Hospital Name` / `Salesman` / `Inv No.` / `Product Name` / `Product type` / `Total` ว่าง | ข้ามแถว |
| ERROR | `INVALID_NUMBER` | `Qty`/`Price`/`Total` แปลงเป็นตัวเลขไม่ได้ | ข้ามแถว |
| ERROR | `INVALID_DATE` | `Inv Date` แปลงเป็นวันที่ไม่ได้ | ข้ามแถว |
| WARNING | `AMOUNT_RECOMPUTED` | `Amount` ว่าง (ไฟล์ไม่ได้ฝังค่าที่คำนวณจากสูตรไว้) | คำนวณ `ROUND(Total/1.07, 2)` แล้วนำเข้าต่อ |
| WARNING | `TOTAL_MISMATCH` | \|`Total` − (`Amount` + `Vat`)\| > 0.05 หรือ \|`Total` − `Qty` × `Price`\| > 0.05 | นำเข้าโดยยึด `Total` เป็นหลัก |
| WARNING | `DATE_PERIOD_MISMATCH` | `Year`/`Month` ไม่ตรงกับ `Inv Date` | ยึด `Year`/`Month` เป็นงวดบัญชี |
| WARNING | `NEGATIVE_AMOUNT` | `Total` < 0 | นำเข้าตามจริง (ผู้ใช้ยืนยันว่าไม่มีกรณีนี้) |
| WARNING | `UNKNOWN_SALESMAN` | ชื่อใน `Salesman` ไม่เคยพบมาก่อน | สร้าง `Salesperson` ใหม่ ผู้จัดการค่อยผูกกับบัญชีผู้ใช้ทีหลัง |
| WARNING | `NEW_HOSPITAL` | ชื่อโรงพยาบาลไม่เคยพบมาก่อน | สร้าง `Hospital` ใหม่ |
| WARNING | `SHEET_IGNORED` | ไฟล์มี sheet อื่นนอกเหนือจาก sheet แรก | ข้ามทั้ง sheet บันทึกชื่อไว้ในรายงาน |
| ERROR | `HEADER_NOT_FOUND` | หาแถว header ใน 10 แถวแรกของ sheet แรกไม่พบ | ยกเลิกทั้งไฟล์ `status = FAILED` |

**การกันข้อมูลซ้ำ** — `SalesLine.rowKey` = `"{invoiceNo}|{productName}|{lot}|{occurrenceIndex}"` โดย `occurrenceIndex` คือลำดับที่ 1, 2, 3… ของการพบชุด `invoiceNo + productName + lot` เดิมซ้ำภายในไฟล์เดียวกัน (นับเรียงตามลำดับแถว)

เหตุผล: คีย์ไม่มีตัวเลขเงินหรือจำนวนอยู่ในนั้น การอัปโหลดไฟล์ที่แก้ยอดแล้วจึงเป็นการ **อัปเดตแถวเดิม** ตามที่ผู้ใช้เลือก (ตัวเลือก B) ไม่ใช่การสร้างแถวใหม่ และการมี `occurrenceIndex` ทำให้ใบแจ้งหนี้ที่มีสินค้าชื่อเดียวกัน lot เดียวกัน 2 บรรทัดไม่ถูกตัดทิ้งไป 1 บรรทัด

**พฤติกรรมการนำเข้า** — upsert ตาม `rowKey`: พบแล้ว → อัปเดตค่าทั้งแถว (นับเป็น `updatedRows`), ยังไม่พบ → สร้างใหม่ (นับเป็น `insertedRows`) ทั้งหมดทำใน transaction เดียวต่อไฟล์ ถ้าล้มกลางคันต้อง rollback ทั้งชุดและตั้ง `status = FAILED`

**ผลข้างเคียงที่ต้องทำหลัง import สำเร็จ** — ตั้ง `CoachingInsight.isStale = true` สำหรับทุกงวดใน `periodsTouched` (รวมไตรมาสและปีที่ครอบคลุมงวดนั้น) เพื่อให้หน้าจอแจ้งว่าข้อความ coaching เก่ากว่าข้อมูล และมีปุ่มให้สร้างใหม่

**ข้อจำกัดที่รู้ตัว** — การ import ไม่ลบแถวเก่าทิ้ง ถ้าไฟล์รอบใหม่ตัดบางบรรทัดออก บรรทัดเดิมจะยังอยู่ในระบบ (ดู Open Questions ข้อ 1)

---

## KPI & Scoring Rules (สัญญาการคำนวณ)

ทุกตัวเลขคำนวณจากคอลัมน์ `Total` (รวม VAT) และแบ่งงวดตาม `SalesLine.year` / `SalesLine.month` เป้าของไตรมาส/ปี = ผลรวมของเป้ารายเดือนในช่วงนั้น

**นิยาม "เดือนที่มีข้อมูล" (`dataCoverageMonths`)** = จำนวนคู่ (`year`,`month`) ที่ไม่ซ้ำกันซึ่งมี `SalesLine` อยู่ในระบบ ใช้ตัดสินว่า KPI ที่ต้องการประวัติยาวพร้อมใช้หรือยัง

| Metric | นิยาม | คะแนน 0–100 | เงื่อนไขที่ทำให้ "คำนวณไม่ได้" |
|---|---|---|---|
| `REVENUE_VS_TARGET` | `SUM(total)` ของงวด ÷ เป้ายอดขายของงวด × 100 | `min(achievement, 100)` | ไม่ได้ตั้งเป้า หรือเป้า = 0 |
| `NEW_CUSTOMERS` | จำนวนโรงพยาบาลที่ **ขายครั้งแรกในระบบ** ตกอยู่ในงวดนี้ และ `isPreExistingCustomer = false` — ให้เครดิตกับพนักงานขายที่ทำรายการแรกนั้น | `min(actual ÷ target × 100, 100)` | `newCustomerTarget` = 0 |
| `PRODUCT_GROUP` | เฉพาะกลุ่มสินค้าที่ตั้งเป้าไว้: `Σ min(ยอดจริงรายกลุ่ม, เป้ารายกลุ่ม) ÷ Σ เป้ารายกลุ่ม × 100` (ตัดยอดเกินรายกลุ่มออกก่อน เพื่อไม่ให้กลุ่มหนึ่งไปกลบอีกกลุ่ม) | ค่าที่ได้ตรง ๆ | ไม่มี `TargetProductGroup` ในงวดนั้นเลย |
| `RETENTION` | โรงพยาบาลที่ซื้อจากพนักงานขายคนนี้ในงวดก่อนหน้า และกลับมาซื้ออีกในงวดนี้ ÷ จำนวนโรงพยาบาลที่ซื้อในงวดก่อนหน้า × 100 | ค่าที่ได้ตรง ๆ | `dataCoverageMonths < minMonthsForChurn` (ค่าเริ่มต้น 6) หรือไม่มีลูกค้าในงวดก่อนหน้า |
| `CONSISTENCY` | สัมประสิทธิ์ความผันผวนของยอดรายเดือนย้อนหลัง `minMonthsForConsistency` เดือน นับถึงเดือนสุดท้ายของงวด: `CV = ส่วนเบี่ยงเบนมาตรฐาน ÷ ค่าเฉลี่ย` | `max(0, (1 − CV)) × 100` | `dataCoverageMonths < minMonthsForConsistency` (ค่าเริ่มต้น 6) หรือค่าเฉลี่ย = 0 |

**คะแนนรวม** = `Σ(น้ำหนัก_i × คะแนน_i) ÷ Σ(น้ำหนัก_i)` โดยนับเฉพาะ metric ที่ **คำนวณได้** เท่านั้น (renormalize)
UI ต้องแสดงกำกับเสมอว่า "คิดจาก X จาก 5 เกณฑ์" และระบุว่าเกณฑ์ไหนถูกยกเว้นพร้อมเหตุผล ("ยังไม่ได้ตั้งเป้า" หรือ "ข้อมูลยังไม่เพียงพอ ต้องการ 6 เดือน ปัจจุบันมี 3 เดือน")
ถ้าไม่มี metric ใดคำนวณได้เลย → ไม่แสดงคะแนนรวม แสดงข้อความอธิบายแทน ห้ามแสดง 0

**KPI ประกอบที่แสดงแต่ไม่คิดคะแนน** — ลูกค้าที่ยัง active ในงวด, ลูกค้าที่หายไป (ไม่สั่งเกิน `churnMonths`), product penetration (จำนวน `ProductType` เฉลี่ยต่อลูกค้า 1 ราย และสัดส่วนกลุ่มสินค้าที่ขายได้), สัดส่วนยอดตามโรงพยาบาล, แนวโน้มยอดรายเดือน — ทุกตัวต้อง drill-down ไปดูรายการ `SalesLine` ที่เป็นที่มาได้

**AI coaching** — คำนวณ KPI และการเปรียบเทียบ (เทียบเป้า / เทียบค่าเฉลี่ยทีม / เทียบงวดก่อน) ให้เสร็จในระบบก่อน แล้วส่งเฉพาะ **ผลสรุปเชิงตัวเลข** ที่ปิดบังชื่อแล้ว (`aiAnonymize = true` → แทนที่ชื่อพนักงานขายด้วย "พนักงานขาย A" และชื่อโรงพยาบาลด้วย "โรงพยาบาล 1") ไปให้ Gemini เรียบเรียงเป็นภาษาไทย เก็บผลลง `CoachingInsight` ถ้าเรียกไม่สำเร็จ → `status = FAILED` และหน้าจอต้อง **แสดงตัวเลข KPI และการเปรียบเทียบตามปกติ** พร้อมข้อความสรุปแบบ rule-based สำรอง ห้ามให้หน้าพังหรือว่างเปล่า

---

## Modules

แบ่งเป็น 7 module ภายในโฟลเดอร์ `sales-evaluation` เรียงตาม dependency จริง ไม่ใช่ตามลำดับความอยากได้ (ผู้ใช้ยอมรับลำดับนี้แล้วใน requirement ข้อ 14) — การจัดเฟสจริงเป็นงานของ `project-manager`

### Module A: Setup & Scaffold
โครงโปรเจกต์ทั้งหมด: Next.js (`web/`), Express (`api/`), PostgreSQL, Prisma, `.env`, `.gitignore`, seed ค่าเริ่มต้น (`EvaluationSetting` singleton + `ScoringWeight` 5 แถว + บัญชีผู้จัดการคนแรก)
**Dependencies**: ไม่มี — ต้องทำก่อนทุก module
**Models**: ทั้งหมด (migration แรก)

### Module B: Auth & User Management
เข้าสู่ระบบด้วยอีเมล, JWT, middleware ตรวจ role, บังคับเปลี่ยนรหัสผ่านครั้งแรก, ผู้ใช้เปลี่ยนรหัสผ่านตัวเอง, ผู้จัดการสร้าง/ปิดใช้งาน/รีเซ็ตรหัสผ่านบัญชีอื่น, ผูก `User` เข้ากับ `Salesperson`, เปิด Dashboard ของผู้ที่ล็อกอินเป็นหน้าแรก
**Dependencies**: A
**Models**: `User`, `Salesperson`
**สิทธิ์**: MANAGER เท่านั้นที่จัดการบัญชีได้ — ทุก role เห็นข้อมูลธุรกิจเท่ากันหมด
**⚠️ Sensitive**: รหัสผ่าน, JWT, ข้อมูลส่วนบุคคล → `security` agent ต้องตรวจ module นี้

### Module C: Excel Import & Master Data
อัปโหลดไฟล์, สแกน sheet, parse, validate, upsert, หน้ารายงานผลการนำเข้า (นำเข้ากี่แถว อัปเดตกี่แถว ข้ามกี่แถว ปัญหารายบรรทัด), ประวัติการนำเข้า, หน้าจัดการ master data (ผูกชื่อพนักงานขายกับบัญชี, ติ๊ก `isPreExistingCustomer`), หน้าตรวจดูข้อมูลการขายพร้อม filter
**Dependencies**: A, B (ต้องรู้ว่าใครอัปโหลด และจำกัดเฉพาะผู้จัดการ)
**Models**: `ImportBatch`, `ImportIssue`, `SalesLine`, `Hospital`, `Product`, `ProductType`
**⚠️ Sensitive**: รับไฟล์จากภายนอก (ขนาดไฟล์, ชนิดไฟล์, zip bomb, สูตรใน cell, การใช้หน่วยความจำ) → `security` agent ต้องตรวจ module นี้
**หมายเหตุ**: ผู้ใช้ระบุว่าเร่งด่วนที่สุด — เป็น module ที่ควรส่งมอบให้ใช้งานจริงได้ก่อนเพื่อนหลังจาก A + B

### Module D: Targets
หน้าตั้งเป้าแบบตารางทั้งทีมทั้งปีในหน้าเดียว, คัดลอกเป้าเดือนก่อน, เป้ากลุ่มสินค้าแบบเลือกเฉพาะกลุ่มที่ต้องการผลักดัน, บันทึกประวัติการแก้ไขทุกครั้ง และหน้าดูประวัติ
**Dependencies**: A, B, C (ต้องมี `ProductType` และรายชื่อ `Salesperson` จากการ import ก่อน)
**Models**: `Target`, `TargetProductGroup`, `TargetRevision`

### Module E: KPI & Scoring Engine
บริการคำนวณ KPI ทุกตัวตามหัวข้อ KPI & Scoring Rules, ตรรกะ renormalize น้ำหนัก, การตรวจความเพียงพอของข้อมูล, endpoint สำหรับดึงผลรายคน/รายทีม/รายงวด, หน้าตั้งค่าน้ำหนักและค่าคงที่ (`churnMonths` ฯลฯ) พร้อมประวัติการแก้
**Dependencies**: C, D
**Models**: `ScoringWeight`, `ScoringWeightRevision`, `EvaluationSetting` (อ่านจาก `SalesLine` + `Target`)
**หมายเหตุ**: เป็นหัวใจของระบบและเป็นจุดที่ผิดพลาดง่ายที่สุด ควรมีหน้า drill-down ให้ตรวจย้อนได้ทุกตัวเลขตั้งแต่แรก

### Module F: Dashboards & Leaderboard
Dashboard ส่วนตัว (ยอดสะสมเดือน/ไตรมาส/ปี เทียบเป้า, เหลืออีกเท่าไหร่ถึงเป้า, แนวโน้มรายเดือน, สัดส่วนตามกลุ่มสินค้า/โรงพยาบาล, KPI แต่ละตัวเทียบเป้าและเทียบค่าเฉลี่ยทีม), สลับดูมุมมองของคนอื่นได้, Leaderboard ชื่อจริง สลับเกณฑ์ (คะแนนรวม / % ทำได้ตามเป้า / ยอดขาย / ลูกค้าใหม่) และช่วงเวลา, responsive
**Dependencies**: E
**Models**: อ่านอย่างเดียว

### Module G: AI Coaching Insights
ประกอบ payload สรุป KPI, ปิดบังชื่อ, เรียก Gemini, เก็บผลลง `CoachingInsight`, ปุ่มสร้างใหม่, ป้าย "ข้อมูลอัปเดตแล้ว" เมื่อ `isStale`, ข้อความสำรองแบบ rule-based เมื่อ AI ล่ม, สวิตช์ปิด AI ทั้งระบบ, drill-down จากทุกข้อสรุปไปยังตัวเลขที่มา
**Dependencies**: E
**Models**: `CoachingInsight`
**⚠️ Sensitive**: ข้อมูลออกนอกองค์กร + เก็บ API key + ค่าใช้จ่ายต่อการเรียก → `security` agent ต้องตรวจ module นี้ (โดยเฉพาะว่า payload ที่ส่งจริงตรงกับที่ออกแบบไว้ และ key ไม่หลุดไปฝั่ง client)

### Module H: Coaching Reports & Export
รายงานสรุปรายบุคคล 1 หน้าต่อ 1 คนต่อ 1 งวด (เป้า vs ผลจริง, KPI ทุกตัว, คะแนนรวม, จุดแข็ง/จุดที่ควรพัฒนา, เทียบงวดก่อน), หน้าภาพรวมทีมสำหรับดูว่าใครควรได้รับการช่วยเหลือก่อน, Export เป็น Excel
**Dependencies**: E, G
**Models**: อ่านอย่างเดียว

### Module I (Later): Cross-sell & Customer Follow-up
ข้อเสนอ 3 รูปแบบ (ลูกค้าคล้ายกันซื้ออะไร / ซื้อ A แต่ยังไม่ซื้อ B / ถึงรอบสั่งซ้ำแล้ว) + รายการลูกค้าที่ควรตามต่อ
**Dependencies**: C และ **ข้อมูลสะสมอย่างน้อย 6–12 เดือน** — ไม่ใช่ dependency ของโค้ด แต่เป็น dependency ของข้อมูล
**หมายเหตุ**: ยังไม่ควรเริ่มจนกว่าข้อมูลจะพอ เพราะผลลัพธ์ที่ผิดจะทำให้พนักงานขายเสียเวลาไปกับลูกค้าผิดกลุ่ม

---

## Risks & Dependencies

| # | ความเสี่ยง | ผลกระทบ | แนวทางรับมือ |
|---|---|---|---|
| 1 | **โปรเจกต์ยังไม่ scaffold เลย** ไม่มี `package.json`, `prisma/`, `app/` | เริ่ม implement ไม่ได้ | ต้องรัน `setup` agent ก่อน Phase 1 — เป็น blocker แรกสุด |
| 2 | **KPI 2 ใน 5 ตัวยังใช้จริงไม่ได้** จนกว่าจะครบ 6 เดือน (retention, consistency) | คะแนนรวมช่วงแรกคิดจาก 3 เกณฑ์ | กฎ renormalize + ป้าย "ข้อมูลยังไม่เพียงพอ" ถูกออกแบบไว้แล้ว ผู้ใช้รับทราบและยอมรับ |
| 3 | **ลูกค้าใหม่ช่วงแรกจะพองผิดปกติ** เพราะระบบเพิ่งเห็นข้อมูลครั้งแรก | ตัวเลข "ลูกค้าใหม่" เดือนแรก ๆ ไม่จริง | ผู้จัดการติ๊ก `isPreExistingCustomer` ให้ลูกค้าเดิมก่อนเริ่มใช้งาน — ต้องเป็นขั้นตอนบังคับใน onboarding ไม่ใช่ทางเลือก |
| 4 | **การจับคู่ชื่อพึ่งการสะกดตรงกัน 100%** ทั้งชื่อพนักงานขายและโรงพยาบาล | สะกดต่างแม้ช่องว่างเดียวจะกลายเป็นคนละคน/คนละโรงพยาบาล ทำให้ KPI เพี้ยนโดยไม่มีใครรู้ | trim + เทียบแบบไม่สนตัวพิมพ์, ขึ้น `WARNING` ทุกครั้งที่สร้างชื่อใหม่, มีหน้า master data ให้ผู้จัดการตรวจรายชื่อทั้งหมด ถ้าอนาคตพบปัญหาจริงค่อยทำหน้าจับคู่ชื่อ (อยู่ใน Later ของ requirement แล้ว) |
| 5 | **`Amount` ในไฟล์เป็นสูตร ไม่ใช่ค่านิ่ง** | ถ้าไฟล์ถูกสร้างโดยเครื่องมือที่ไม่ฝังค่าที่คำนวณไว้ จะอ่านได้ค่าว่าง | fallback คำนวณ `ROUND(Total/1.07, 2)` พร้อม `WARNING` — ทุก KPI ใช้ `Total` อยู่แล้วจึงไม่กระทบผลลัพธ์ |
| 6 | **นำเข้าเฉพาะ sheet แรก ตามที่ผู้ใช้ยืนยัน** | ถ้าในอนาคตมีไฟล์ที่ใส่ข้อมูลขายจริงไว้ใน sheet ที่ 2 ยอดจะขาดไปเงียบ ๆ | ขึ้น `WARNING` `SHEET_IGNORED` พร้อมชื่อ sheet ที่ถูกข้ามในรายงานการนำเข้าทุกครั้ง เพื่อให้ผู้จัดการเห็นทันทีว่ามีชีตที่ไม่ได้ถูกอ่าน + `qa-engineer` ต้องตรวจยอดรวมที่นำเข้าเทียบกับไฟล์ต้นทาง |
| 7 | **Render free tier**: ฐานข้อมูล PostgreSQL หมดอายุใน 90 วัน และ web service หลับเมื่อไม่มีคนใช้ (เปิดครั้งแรกช้า ~30 วินาที) | ข้อมูลจริงหายทั้งหมดเมื่อครบ 90 วัน ถ้าใช้แพ็กเกจฟรี | `devops` ต้องยืนยันแพ็กเกจกับผู้ใช้ก่อน deploy จริง — สำหรับข้อมูลยอดขายจริงควรใช้แพ็กเกจเสียเงิน และต้องมีแผนสำรองข้อมูล |
| 8 | **สถาปัตยกรรม 2 service** (Next.js + Express) บน Render | เสียค่า web service 2 ตัว + ต้องตั้ง CORS/URL ข้ามกัน | เป็นผลจาก stack ที่ล็อกไว้ ไม่ใช่ปัญหาเชิงเทคนิค — แจ้งให้ผู้ใช้ทราบเรื่องค่าใช้จ่ายผ่าน `devops` |
| 9 | **ค่าใช้จ่ายและความน่าเชื่อถือของ Gemini API** | หน้าค้างหรือพังถ้าเรียกไม่สำเร็จ | cache ผล + ปุ่มสร้างใหม่ + timeout + fallback rule-based + สวิตช์ `aiEnabled` ปิดได้ทั้งระบบ ปริมาณการเรียกที่ประเมินไว้ ~150–200 ครั้ง/ปี ถือว่าน้อยมาก |
| 10 | **Module E เป็นจุดที่ผิดพลาดแล้วมองไม่เห็น** | คะแนนผิดโดยไม่มีใครจับได้ กระทบความน่าเชื่อถือของทั้งระบบ | ล็อกนิยามทุกตัวไว้ในหัวข้อ KPI & Scoring Rules ให้ `qa-engineer` ตรวจตามได้ + บังคับให้มี drill-down ทุกตัวเลขตั้งแต่แรก |
| 11 | **การ import ไม่ลบแถวเก่า** | ถ้าไฟล์รอบใหม่ตัดบรรทัดออก บรรทัดเดิมยังค้างในระบบ | รับทราบเป็นข้อจำกัดของ MVP — ทางแก้คือเพิ่มคำสั่ง "ลบข้อมูลตามงวด" ให้ผู้จัดการ (Open Questions ข้อ 1) |
| 12 | **ไม่มีช่องทางรีเซ็ตรหัสผ่านด้วยตัวเอง** | ถ้าผู้จัดการลืมรหัสผ่านของตัวเองและไม่มีผู้จัดการคนที่สอง จะไม่มีใครรีเซ็ตให้ได้ | ต้องมีบัญชีผู้จัดการอย่างน้อย 2 บัญชี หรือให้ `devops` เตรียมสคริปต์รีเซ็ตรหัสผ่านจากฝั่ง server ไว้ใช้กรณีฉุกเฉิน |

**ลำดับการพัฒนาที่ dependency บังคับ**: A → B → C → D → E → (F, G) → H → (I เมื่อข้อมูลพอ)

---

## Unresolved Open Questions

คำถามที่ต้องได้คำตอบก่อนออกแบบ **ตอบครบทุกข้อแล้ว (13/13)** ที่เหลือด้านล่างเป็นเรื่องที่ยังไม่ต้องตัดสินใจตอนนี้ และไม่ block การ implement

1. **คำสั่ง "ลบข้อมูลตามงวด"** — ต้องการให้ผู้จัดการลบข้อมูลทั้งเดือน/ทั้งชุด import แล้วนำเข้าใหม่ได้ไหม (แก้ปัญหาข้อ 11 ในตารางความเสี่ยง: ถ้าไฟล์รอบใหม่ตัดบรรทัดออก บรรทัดเดิมจะค้างอยู่) ถ้าต้องการ เป็นการเพิ่ม endpoint + UI **ไม่ต้องแก้ schema**
2. **การให้คะแนนเมื่อทำเกินเป้า** — ปัจจุบันทำได้ 100% ของเป้า = คะแนนเต็มของเกณฑ์นั้น ทำเกินไม่ได้คะแนนเพิ่ม (ดูความเก่งเกินเป้าได้จาก Leaderboard โหมด "% ทำได้ตามเป้า" แทน) ถ้าภายหลังต้องการให้คนทำเกินเป้าได้คะแนนรวมสูงกว่า ต้อง amend สูตรและเพิ่มค่า `achievementCapPercent` ใน `EvaluationSetting` — เป็นการเปลี่ยนแบบเพิ่มเติมล้วน
3. **ความถี่ในการนำเข้าไฟล์** (Open Question ข้อ 8 เดิมใน `requirement.md`) — ยังไม่ตอบ แต่ไม่กระทบ design ระบบรองรับการนำเข้าบ่อยแค่ไหนก็ได้ มีผลแค่ความสดของ Dashboard
4. **การจัดเฟสและลำดับงานจริง** — เป็นงานของ `project-manager` เอกสารนี้ให้เพียง dependency ที่ห้ามสลับ

**สิ่งที่ตัดออกอย่างชัดเจนแล้ว ห้าม implement โดยไม่ amend เอกสารนี้ก่อน**
- ตาราง `PasswordResetToken` และบริการส่งอีเมล (Resend/SendGrid) — ผู้ใช้ยืนยัน 2026-08-14 ว่าใช้อีเมลเป็นแค่ username และให้ผู้จัดการรีเซ็ตรหัสผ่านให้แทน
- การอ่าน sheet ที่ 2 เป็นต้นไปของไฟล์ Excel — ผู้ใช้ยืนยัน 2026-08-14 ว่านำเข้าเฉพาะ sheet แรก

---

## Change Log

- 2026-08-14 — สร้างเอกสารครั้งแรก ประเมินความเป็นไปได้ 11 ฟีเจอร์ใน MVP + 3 รายการที่นอกขอบเขตเพราะไม่มีข้อมูล, ปิดคำถามที่ค้าง 11 ข้อกับผู้ใช้ (ปี ค.ศ./date serial, upsert ตอน import ซ้ำ, ลูกค้าใหม่ต่อบริษัท + ติ๊กลูกค้าเดิม, renormalize น้ำหนักเมื่อ KPI คำนวณไม่ได้, churn 6 เดือน, Gemini + cache + ปิดบังชื่อ, login ด้วยอีเมล, export Excel อย่างเดียว, ไม่มียอดติดลบ, น้ำหนัก 50/15/15/10/10, ยึด Year/Month เป็นงวดบัญชี), ยืนยัน Prisma schema 17 models/8 enums, ล็อกกฎการนำเข้าและกฎการคำนวณ KPI เป็นสัญญา, แบ่งเป็น 8 modules (A–H) + 1 module เฟสหลัง (I)
- 2026-08-14 — ปิดคำถามที่ค้าง 2 ข้อสุดท้าย: (ก) **นำเข้าเฉพาะ sheet แรกเท่านั้น** เปลี่ยนกฎจากการสแกนทุก sheet เป็นอ่าน sheet แรก + ขึ้น `WARNING` `SHEET_IGNORED` สำหรับ sheet ที่ถูกข้าม เพิ่ม `HEADER_NOT_FOUND` เป็น ERROR (ข) **ใช้อีเมลเป็นแค่ username ไม่มีระบบส่งอีเมลจริง** ตัดตาราง `PasswordResetToken` และบริการส่งอีเมลออกจากขอบเขตอย่างถาวรจนกว่าจะ amend ใหม่ ผู้จัดการเป็นผู้รีเซ็ตรหัสผ่านให้ — เพิ่มความเสี่ยงข้อ 12 (ต้องมีผู้จัดการ 2 บัญชีหรือมีสคริปต์รีเซ็ตฉุกเฉิน) — schema ไม่มีการเปลี่ยนแปลง คำถามครบ 13/13 ข้อ
- 2026-08-14 — ตรวจโครงสร้างไฟล์ Excel จริง (`รายละเอียดขาย มกราคม - มีนาคม 2569.xlsx`) พบว่า `Amount` เป็นสูตร `ROUND(Qty*Price*100/107,2)` แปลว่า `Price` รวม VAT แล้ว และ `Total = Qty × Price` เพิ่มกฎตรวจสอบ `TOTAL_MISMATCH` / `AMOUNT_RECOMPUTED` และออกแบบการสแกน sheet อัตโนมัติแทนการ hardcode ชื่อ sheet
