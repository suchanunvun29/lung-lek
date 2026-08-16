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

**การตัดสินใจที่ผู้ใช้ยืนยันแล้ว (2026-08-16)** — รอบขยาย: แบ่งเครดิตดีล, ทะเบียนโรงพยาบาล/พื้นที่, ตัวช่วยตั้งเป้า · **ปิด blocker ครบทุกข้อแล้ว**

| # | ประเด็น | ข้อสรุปที่ผู้ใช้เลือก | สิ่งที่ถูกตัดออกด้วยการเลือกนี้ |
|---|---|---|---|
| 14 | ดีลที่แชร์เครดิตระหว่างพนักงานขาย | **เกิดขึ้นประจำ → รองรับใน schema** `SalesLineCredit` เป็นแหล่งเดียวของการรวมยอดรายคน | ตัดการรวมยอดผ่าน `SalesLine.salespersonId` ออกถาวร ห้ามมี fallback 2 ทาง |
| 15 | รวมชื่อโรงพยาบาลที่สะกดต่างกัน | normalize อัตโนมัติเมื่อชื่ออังกฤษตรง + เข้าคิวให้ผู้จัดการตัดสินเมื่อคลุมเครือ · ศิริราช กับ ศิริราช ปิยมหาราชการุณย์ = **คนละราย ห้ามรวม** | ตัดการรวมอัตโนมัติด้วยความคล้าย (fuzzy) ออก — ใช้การตรงกันแบบเป๊ะเท่านั้น |
| 16 | สูตรศักยภาพพื้นที่ | เตียง × น้ำหนักระดับ (เริ่มต้น 1.000) × ค่าปรับรายแห่ง **คำนวณแยกรายภาคเสมอ** + เกณฑ์ `minRegionCoverage` 0.50 | ตัดการคำนวณศักยภาพเป็นก้อนเดียวทั้งประเทศออก และตัด กทม. ออกจากการกระจายเป้าโดยอัตโนมัติ (registry ไม่มีกรุงเทพ) |
| 17 | **ลูกค้าใหม่ที่ปิดด้วยดีลแชร์เครดิต นับให้ใคร** (`requirement.md` ข้อ 18) | **ตามสัดส่วนเครดิตของบรรทัดแรกนั้น** — ดีล 50/50 = คนละ 0.5 ราย | ตัดทางเลือก "ทั้งคู่ได้เต็มคนละ 1 ราย" ออก · ได้กฎตรวจอัตโนมัติแลกมา: ผลรวมรายคน = จำนวนลูกค้าใหม่จริงของบริษัทพอดี |
| 18 | **พารามิเตอร์ตัวช่วยตั้งเป้า** (`requirement.md` ข้อ 10) | ย้อนหลัง **3 เดือน** · ดีลที่เกิน **40%** ของยอดคนนั้นในช่วงนั้น = ก้อนใหญ่ผิดปกติ ให้ตัดออกก่อนเฉลี่ย **พร้อมตีธงและเอากลับได้** · อัตราเติบโตเริ่มต้น 1.000 ผู้จัดการกรอกเอง | ตัดการฝังอัตราเติบโตที่ไม่มีใครยืนยันไว้ในระบบ · ตัดการตัด outlier แบบเงียบ ๆ ออก (ต้องแสดงรายการที่ตัดเสมอ) |
| 19 | **เป้าอ้างอิงรายภาคของสูตร `potentialBased`** | ใช้ **ผลรวมตัวเลขรายคนในภาคนั้น ไม่เพิ่มช่องกรอกเป้าบริษัท** · แก้การอ้างวนด้วยการนิยาม `R = Σ historyBased` ในโหมด SUGGEST และ `Σ Target` แบบ snapshot เฉพาะโหมด REBALANCE ที่ทุกคนมีเป้าครบแล้ว | ตัดฟิลด์/ตาราง "เป้าบริษัทรายปีรายภาค" ออกถาวร · ตัดการใช้ `Σ Target` สด ๆ เป็นตัวตั้งออก (อ้างวน — เหตุผลเต็มอยู่ใน Territory & Potential Rules ข้อ 5.2) |

**การประเมินรอบรายงาน 3 ตัว + โครงสร้างเขต (2026-08-16 รอบที่ 2)** — ครอบคลุม `requirement.md` 9.1, 10.2.0, 10.6, 10.7 และมุมมองรายเซลล์ของ 10.4

| ฟีเจอร์ | ผลประเมิน | หมายเหตุ |
|---|---|---|
| `Territory` / `TerritoryAssignment` (คน↔เขต N:N, เขตไม่มีเจ้าของได้, เขตเป็นชั้นซ้อนบนภาค) | ตรงไปตรงมา | ตาราง join ธรรมดา + ช่วงเวลามีผล · **ตารางนี้ยังไม่เคยถูกสร้างจริงใน `schema.prisma`** จึงนิยามใหม่ได้โดยไม่ต้อง migrate ข้อมูล |
| `Target` ผูกกับเขต โดยยังรองรับเป้าส่วนตัวที่ไม่ผูกเขต (Mr.Sathit) | ตรงไปตรงมา แต่ **ทำลายสัญญาของ query เดิม** | `salespersonId` เปลี่ยนเป็น nullable + เพิ่ม `scope` — ข้อมูลปลอดภัย แต่ทุก query/validator ของ Phase 3/4 ที่สมมติว่า `salespersonId` ไม่เป็น null ต้องแก้ ดู Risks ข้อ 21 |
| 10.7 KPI ครบ 5 ตัว + คะแนนรวม 0–100 ที่ระดับเขต | ตรงไปตรงมา | เป็นการ **เปลี่ยนหน่วยที่ป้อนเข้าสูตรเดิม ไม่ใช่เปลี่ยนสูตร** — ไม่แตะสูตรคะแนนของ Phase 4 · ด้วยข้อมูลจริงวันนี้คำนวณได้จริง **1 ใน 5 เกณฑ์** ดู Territory KPI Rules ข้อ 5 |
| 9.1 ทะเบียนสินค้า (Product master) + รหัสสินค้า | ตรงไปตรงมา | `Product` มีอยู่แล้ว ขยาย 4 คอลัมน์ + `ProductAlias` · **รหัสสินค้าจะว่างทั้งหมดในระยะแรก** เพราะประวัติการขายไม่มีคอลัมน์รหัส |
| 9.1 อันดับสินค้าขายดี/ขายไม่ได้ รายเขต | ตรงไปตรงมา | ขึ้นกับเขต · ระยะแรก "ขายไม่ได้เลย" เป็นช่องว่างเชิงเปรียบเทียบ ต้องติดคำเตือนถาวรบนหน้าจอและไฟล์ export |
| 10.4 มุมมองรายเซลล์ | **ต้องแยกส่ง 2 รอบ** | "รพ.ที่ขายได้แล้ว" ทำได้ทันทีที่มีเขต · "รพ.ที่ยังไม่เคยขาย" ต้องรอทะเบียนโรงพยาบาล (Module K) เพราะระบบยังไม่รู้ว่าในเขตมีโรงพยาบาลอะไรบ้างที่ยังไม่เคยซื้อ |
| ทำรายงาน 3 ตัว "ก่อนโครงสร้างเขต" | **เป็นไปไม่ได้ทางเทคนิค** | ทั้ง 3 รายงานจัดกลุ่ม/กรองด้วยเขตทั้งหมด · สิ่งที่ทำก่อนได้จริงคือ **ทะเบียนสินค้า** ซึ่งไม่ขึ้นกับเขต ดูการตัดสินใจแถวที่ 20 |

**การตัดสินใจที่ผู้ใช้ยืนยันแล้ว (2026-08-16 รอบที่ 2)** — รอบรายงาน 3 ตัว + โครงสร้างเขต

| # | ประเด็น | ข้อสรุปที่ผู้ใช้เลือก | สิ่งที่ถูกตัดออกด้วยการเลือกนี้ |
|---|---|---|---|
| 20 | **ลำดับงาน** (`requirement.md` Scope ทักท้วงไว้) | ทำ **โครงสร้างเขต + เป้าระดับเขต ขนานไปกับรายงาน 3 ตัว** เร่งที่สุด · ไม่รอให้ `qa-engineer` ปิด Module J ก่อน · ส่วนทะเบียนสินค้าเริ่มได้ทันทีเพราะไม่ขึ้นกับเขต | ตัดทางเลือก "ปิดข้อ 0 ให้จบก่อน" ออก — **แลกมาด้วยความเสี่ยงที่รับไว้แล้ว**: ตัวเลขในรายงานอาจขยับเมื่อ Module J ถูกตรวจรับ ดู Risks ข้อ 26 |
| 21 | **เป้าของ 2 เขตที่ให้มาเป็นก้อนรวม** (Tasanee 14M = กท1+ภาคตะวันตก · Tanyapat 13M = กท2+ภาคกลาง) | **แตกเป็นตัวเลขรายเขต 1 แถวต่อ 1 เขต** ให้ตรงกับ grain ของ 10.7 | **ตัดโครงสร้าง "กลุ่มเขต" (target ผูกหลายเขต) ออกถาวร** ห้าม `backend-engineer` เพิ่มเอง · แลกมาด้วยงานข้อมูลฝั่งผู้ใช้: ต้องแตกตัวเลข 14M/13M ก่อนกรอก |
| 22 | **คะแนนรวม 0–100 ของเขต ตอนที่คำนวณได้แค่ 1 ใน 5 เกณฑ์** | **%ถึงเป้าเป็นตัวเลขหลัก · คะแนนรวมอยู่คนละคอลัมน์ พร้อมป้าย "คิดจาก X จาก 5 เกณฑ์" เสมอ** | ตัดทางเลือก "ซ่อนคะแนนรวมจนกว่าจะมี ≥ 2 เกณฑ์" ออก และตัดการแสดงคะแนนรวมโดยไม่มีป้ายกำกับออก |
| 23 | **เป้ารายคนหลังเป้าย้ายไปผูกเขต** | **derive อัตโนมัติ = เป้าของเขต ÷ จำนวนผู้ดูแล ACTIVE ของเขตนั้น** แล้วรวมทุกเขตที่คนนั้นดูแล | ตัดทางเลือก "ได้คนละเต็มจำนวน" และ "ไม่ derive เลย" ออก · **ชิงตัดสิน `requirement.md` OQ22 ไปก่อนโดยผู้ใช้รับทราบ** — ถ้า OQ22 ปิดด้วยกฎแบ่งแบบอื่นต้องกลับมาแก้ข้อนี้ ดู Territory KPI Rules ข้อ 6 |
| 24 | **รหัสสินค้าที่ยังว่างในระยะแรก** (`requirement.md` OQ11) | ทะเบียนสินค้าสร้างจากประวัติการขาย → `Product.code` ว่าง แสดง **"—" พร้อมคำเตือน** จนกว่าจะนำเข้าแคตตาล็อกจริงในระยะ 2 · รอบนี้ทำ `ProductAlias` (normalize + จำคำตัดสิน) | **เลื่อนคิวถามผู้จัดการเรื่องชื่อสินค้า (`ProductNameReview`) ไประยะ 2** — ระยะแรกไม่จำเป็นเพราะทะเบียนสร้างจากไฟล์เดียวกับที่ใช้จับคู่ จึงตรงกันเป๊ะโดยนิยาม |

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

### ส่วนขยาย 2026-08-16 — แบ่งเครดิตดีล, การจับคู่ชื่อ, ทะเบียนโรงพยาบาล และพื้นที่รับผิดชอบ

**สถานะการเปลี่ยนแปลงต่อของเดิม** — อ่านตารางนี้ก่อนลงมือ

| การเปลี่ยนแปลง | ชนิด | ผลต่อข้อมูล 846 แถวที่ verified แล้ว |
|---|---|---|
| ตารางใหม่ทั้ง 12 ตาราง | **เพิ่มล้วน** | ไม่กระทบ |
| `Hospital.provinceMappingId` (คอลัมน์ใหม่ nullable) | **เพิ่มล้วน** | ไม่กระทบ ค่าเดิมในคอลัมน์ `province` ยังอยู่ครบ |
| `EvaluationSetting` เพิ่ม 6 คอลัมน์ (มี default ทุกตัว — 3 ตัวแรกรอบศักยภาพ + 3 ตัวหลังรอบตัวช่วยตั้งเป้า 2026-08-16) | **เพิ่มล้วน** | ไม่กระทบ |
| back-relation บน `Hospital` / `Salesperson` / `SalesLine` / `User` | **เพิ่มล้วน** | ไม่สร้างคอลัมน์ใหม่ ไม่มี migration บนตารางนั้น |
| **`SalesLineCredit` กลายเป็นแหล่งเดียวของการรวมยอดรายคน** | **ไม่ทำลายข้อมูล แต่ทำลายสัญญาของ query เดิม** | ต้อง backfill 1 แถวต่อ 1 `SalesLine` ที่ `sharePercent = 100` แล้ว **แก้ทุก query ของ Phase 4 ที่รวมยอดผ่าน `SalesLine.salespersonId`** และให้ `qa-engineer` ตรวจตัวเลข Phase 4–7 ซ้ำทั้งหมด |

`SalesLine.salespersonId` **ไม่ถูกลบและยังคง required** — เปลี่ยนความหมายเป็น "ผู้บันทึก/เจ้าของหลักของรายการ" ใช้สำหรับแสดงผลและตรวจย้อนไฟล์ต้นทางเท่านั้น **ห้ามใช้คำนวณ KPI อีกต่อไป** เหตุผลที่ไม่ทำให้ `SalesLineCredit` เป็นทางเลือก (มีก็ใช้ ไม่มีก็ตกกลับไปใช้ `salespersonId`) คือมันจะสร้างทางเดินโค้ด 2 ทางในทุกจุดที่รวมยอด ซึ่งเป็นชนิดของความพลาดที่ทำให้เกิดบั๊กเงียบแบบเดียวกับที่เพิ่งเจอ — บังคับให้มีทางเดียวเสมอ แล้ว backfill ให้ครบ ปลอดภัยกว่า

```prisma
// ---------- การแบ่งเครดิตดีลระหว่างพนักงานขาย ----------

model SalesLineCredit {
  id            String      @id @default(cuid())
  salesLineId   String
  salesLine     SalesLine   @relation(fields: [salesLineId], references: [id], onDelete: Cascade)
  salespersonId String
  salesperson   Salesperson @relation(fields: [salespersonId], references: [id])
  sharePercent  Decimal     @db.Decimal(6, 3)   // ผลรวมของทุกแถวใน 1 salesLine ต้องเท่ากับ 100.000 เสมอ
  isPrimary     Boolean     @default(false)
  createdAt     DateTime    @default(now())

  @@unique([salesLineId, salespersonId])
  @@index([salespersonId])
}

// ค่าดิบในคอลัมน์ Salesman ที่แทนคนมากกว่า 1 คน เก็บเป็นกฎไว้ ไม่ต้องให้ผู้จัดการตอบซ้ำทุกเดือน
model SalesmanNameRule {
  id            String   @id @default(cuid())
  normalizedRaw String   @unique          // ค่าดิบที่ยุบแล้ว เช่น "CHOKECHAITANGSANGKHAROM/CHIDCHANOKSEETHONG"
  sampleRaw     String
  decidedById   String?
  decidedBy     User?    @relation(fields: [decidedById], references: [id])
  decidedAt     DateTime?
  createdAt     DateTime @default(now())

  members SalesmanNameRuleMember[]
}

model SalesmanNameRuleMember {
  id            String           @id @default(cuid())
  ruleId        String
  rule          SalesmanNameRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  salespersonId String
  salesperson   Salesperson      @relation(fields: [salespersonId], references: [id])
  sharePercent  Decimal          @db.Decimal(6, 3)

  @@unique([ruleId, salespersonId])
}

// ---------- การจับคู่/รวมชื่อโรงพยาบาล (แทน "หน้าจับคู่ชื่อ" ที่เคยถูกตัดออก) ----------

enum NameDecisionSource { AUTO MANAGER }

// ทางลัดตอน import: ชื่อดิบที่ยุบแล้ว -> Hospital ตัวจริง (การรวมแสดงด้วยหลายคีย์ชี้ Hospital เดียวกัน)
model HospitalAlias {
  id            String             @id @default(cuid())
  normalizedKey String             @unique
  sampleRaw     String
  hospitalId    String
  hospital      Hospital           @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  source        NameDecisionSource
  decidedById   String?
  decidedBy     User?              @relation(fields: [decidedById], references: [id])
  decidedAt     DateTime?
  createdAt     DateTime           @default(now())

  @@index([hospitalId])
}

enum NameReviewStatus { PENDING MERGED KEPT_SEPARATE }

// คิวให้ผู้จัดการตัดสิน + บันทึก "ห้ามรวมถาวร" เพื่อไม่ให้ระบบถามซ้ำ
model HospitalNameReview {
  id             String           @id @default(cuid())
  normalizedKeyA String
  normalizedKeyB String
  sampleRawA     String
  sampleRawB     String
  similarity     Decimal?         @db.Decimal(5, 4)
  status         NameReviewStatus @default(PENDING)
  mergedIntoId   String?
  mergedInto     Hospital?        @relation(fields: [mergedIntoId], references: [id])
  decidedById    String?
  decidedBy      User?            @relation(fields: [decidedById], references: [id])
  decidedAt      DateTime?
  note           String?
  createdAt      DateTime         @default(now())

  @@unique([normalizedKeyA, normalizedKeyB])
  @@index([status])
}

// ---------- จังหวัดมาตรฐานและภาค ----------

model Region {
  id        String   @id @default(cuid())
  name      String   @unique          // เหนือ · อีสาน · กลาง · ใต้ · กทม.
  sortOrder Int
  createdAt DateTime @default(now())

  provinces         ProvinceMapping[]
  registryHospitals HospitalRegistry[]
}

model ProvinceMapping {
  id            String   @id @default(cuid())
  canonicalName String   @unique       // ชื่อไทยมาตรฐาน 77 จังหวัด
  regionId      String
  region        Region   @relation(fields: [regionId], references: [id])
  createdAt     DateTime @default(now())

  aliases           ProvinceAlias[]
  hospitals         Hospital[]
  registryHospitals HospitalRegistry[]
}

model ProvinceAlias {
  id                String          @id @default(cuid())
  normalizedAlias   String          @unique   // ยุบเป็นตัวพิมพ์ใหญ่ไม่มีอักขระพิเศษ เช่น "CHAINGMAI"
  sampleRaw         String
  provinceMappingId String
  provinceMapping   ProvinceMapping @relation(fields: [provinceMappingId], references: [id])
  isDistrictLevel   Boolean         @default(false)   // เช่น HAT YAI, Phanom Sarakham
  createdAt         DateTime        @default(now())
}

// ---------- ทะเบียนโรงพยาบาล ----------

enum HospitalCategory {
  GOVERNMENT_GENERAL   // รัฐทั่วไป สังกัด สธ. — กลุ่มเดียวที่มีข้อมูลในรอบนี้
  UNIVERSITY
  PRIVATE
  OTHER                // กรมการแพทย์ ทหาร องค์การมหาชน สถาบันเฉพาะทาง
}

model HospitalRegistry {
  id                  String           @id @default(cuid())
  sourceCode          String?          @unique       // "รหัส ร.พ." จากไฟล์
  nameInFile          String
  displayName         String
  provinceMappingId   String?
  provinceMapping     ProvinceMapping? @relation(fields: [provinceMappingId], references: [id])
  provinceRaw         String
  regionId            String?
  region              Region?          @relation(fields: [regionId], references: [id])
  healthZone          String?                        // "เขต" ของกระทรวง — คนละแกนกับ region
  tier                String?                        // A/S/M1/M2/F1/F2/F3 — มีเฉพาะ GOVERNMENT_GENERAL
  category            HospitalCategory @default(GOVERNMENT_GENERAL)
  potentialAdjustment Decimal          @default(1.000) @db.Decimal(6, 3)  // ผู้จัดการปรับ/ยกเว้นรายแห่ง (requirement 10.5)
  isActive            Boolean          @default(true)
  sourceFile          String?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  metrics     HospitalPotentialMetric[]
  links       HospitalRegistryLink[]
  assignments TerritoryAssignment[]

  @@unique([nameInFile, provinceRaw])
  @@index([regionId])
  @@index([category, tier])
}

enum PotentialMetricKey {
  BEDS
  CMI
  SUM_ADJ_RW
  OCCUPANCY_RATE
  PATIENTS
  VISITS
}

// เก็บเป็นแถว ไม่ใช่คอลัมน์ตายตัว — requirement 10.2 ต้องสลับเกณฑ์เรียงลำดับได้ 5 แบบ
// และไฟล์ `งบ รพ.xlsx` (จำนวนผู้ป่วย/ครั้ง รายเดือน) จะเพิ่มเข้ามาได้โดยไม่ต้อง migrate ใหม่
model HospitalPotentialMetric {
  id                 String             @id @default(cuid())
  hospitalRegistryId String
  hospitalRegistry   HospitalRegistry   @relation(fields: [hospitalRegistryId], references: [id], onDelete: Cascade)
  metric             PotentialMetricKey
  value              Decimal            @db.Decimal(16, 4)
  periodYear         Int?                              // null = ค่าที่ไม่ผูกกับงวด เช่น จำนวนเตียง
  periodMonth        Int?
  sourceFile         String?
  createdAt          DateTime           @default(now())

  @@unique([hospitalRegistryId, metric, periodYear, periodMonth])
}

enum RegistryLinkStatus {
  UNREVIEWED
  LINKED
  CONFIRMED_ABSENT   // ยืนยันแล้วว่าไม่มีในทะเบียน — ต่างจาก "ยังไม่ได้ตรวจ"
}

enum RegistryLinkMethod {
  EXACT
  NORMALIZED
  FUZZY
  MANUAL
}

model HospitalRegistryLink {
  id                 String              @id @default(cuid())
  hospitalId         String              @unique
  hospital           Hospital            @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  hospitalRegistryId String?
  hospitalRegistry   HospitalRegistry?   @relation(fields: [hospitalRegistryId], references: [id])
  status             RegistryLinkStatus  @default(UNREVIEWED)
  method             RegistryLinkMethod?
  confidence         Decimal?            @db.Decimal(5, 4)
  reviewedById       String?
  reviewedBy         User?               @relation(fields: [reviewedById], references: [id])
  reviewedAt         DateTime?
  note               String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  @@index([status])
}

// ---------- พื้นที่รับผิดชอบ ----------

enum TerritoryAssignmentSource { INFERRED MANUAL }
enum TerritoryAssignmentStatus { DRAFT ACTIVE SUPERSEDED }

// ผูกได้ทั้งโรงพยาบาลในทะเบียน (ยังไม่เคยขาย) และลูกค้าจริงที่ไม่มีในทะเบียน (เช่น รพ.ในกรุงเทพ)
// ต้องมีค่า hospitalRegistryId หรือ hospitalId อย่างใดอย่างหนึ่งเท่านั้น — บังคับในโค้ด Prisma แสดงเป็น constraint ไม่ได้
model TerritoryAssignment {
  id                 String                    @id @default(cuid())
  hospitalRegistryId String?
  hospitalRegistry   HospitalRegistry?         @relation(fields: [hospitalRegistryId], references: [id])
  hospitalId         String?
  hospital           Hospital?                 @relation(fields: [hospitalId], references: [id])
  salespersonId      String
  salesperson        Salesperson               @relation(fields: [salespersonId], references: [id])
  source             TerritoryAssignmentSource
  status             TerritoryAssignmentStatus @default(DRAFT)
  effectiveFrom      DateTime                  @db.Date
  effectiveTo        DateTime?                 @db.Date   // null = ยังมีผลอยู่ — ให้ประวัติผู้ดูแลตาม requirement 10.3 โดยไม่ต้องมีตารางประวัติแยก
  assignedById       String?
  assignedBy         User?                     @relation(fields: [assignedById], references: [id])
  note               String?
  createdAt          DateTime                  @default(now())

  @@index([salespersonId, status, effectiveTo])
  @@index([hospitalRegistryId, status])
  @@index([hospitalId, status])
}

// น้ำหนักตามระดับโรงพยาบาล — ค่าเริ่มต้นทุกระดับ = 1.000 (พฤติกรรมเท่ากับ "ใช้จำนวนเตียงดิบ")
model TierWeight {
  id        String   @id @default(cuid())
  tier      String   @unique          // A · S · M1 · M2 · F1 · F2 · F3
  weight    Decimal  @default(1.000) @db.Decimal(6, 3)
  updatedAt DateTime @updatedAt
}
```

**ฟิลด์ที่เพิ่มเข้าโมเดลเดิม**

```prisma
// Hospital — เพิ่ม 2 ฟิลด์ (คอลัมน์ใหม่ 1 ตัว nullable, ที่เหลือเป็น back-relation)
  provinceMappingId String?          // จังหวัดมาตรฐานที่ผู้จัดการแก้ทับได้ — คอลัมน์ province เดิมคงค่าดิบไว้เหมือนเดิม
  provinceMapping   ProvinceMapping? @relation(fields: [provinceMappingId], references: [id])
  registryLink      HospitalRegistryLink?
  aliases           HospitalAlias[]
  nameReviews       HospitalNameReview[]
  territoryAssignments TerritoryAssignment[]

// SalesLine — back-relation อย่างเดียว ไม่มีคอลัมน์ใหม่
  credits SalesLineCredit[]

// Salesperson — back-relation อย่างเดียว
  credits             SalesLineCredit[]
  nameRuleMemberships SalesmanNameRuleMember[]
  territoryAssignments TerritoryAssignment[]

// User — back-relation อย่างเดียว
  salesmanNameRules   SalesmanNameRule[]
  hospitalAliases     HospitalAlias[]
  hospitalNameReviews HospitalNameReview[]
  registryLinkReviews HospitalRegistryLink[]
  territoryAssignments TerritoryAssignment[]

// EvaluationSetting — เพิ่ม 6 คอลัมน์ (มี default ทั้งหมด)
  potentialMetric        PotentialMetricKey @default(BEDS)
  minRegionCoverage      Decimal            @default(0.50) @db.Decimal(5, 4)  // ภาคที่ coverage ต่ำกว่านี้ ไม่นำศักยภาพไปใช้กับเป้า
  targetSuggestionAlpha  Decimal            @default(1.000) @db.Decimal(6, 3) // 1.000 = ใช้ประวัติยอดขายล้วน
  // --- พารามิเตอร์ตัวช่วยตั้งเป้า ยืนยัน 2026-08-16 (ปิด Open Question ข้อ 10 ของ requirement.md) ---
  targetLookbackMonths   Int                @default(3)                       // จำนวนเดือนย้อนหลังที่ใช้เป็นฐานของ historyBased
  targetOutlierThreshold Decimal            @default(0.40) @db.Decimal(5, 4)  // ดีล (1 invoiceNo) ที่เกินสัดส่วนนี้ของยอดคนนั้นในช่วงย้อนหลัง = ก้อนใหญ่ผิดปกติ
  targetGrowthRate       Decimal            @default(1.000) @db.Decimal(6, 3) // 1.000 = ไม่บวกการเติบโต ผู้จัดการปรับเองต่อรอบการตั้งเป้าได้
```

**ทั้ง 3 คอลัมน์ท้ายเป็นการเพิ่มล้วน** (`EvaluationSetting` เป็น singleton แถวเดียวที่มีอยู่จริงแล้วในฐานข้อมูล ทุกคอลัมน์มี default จึง migrate ได้โดยไม่ต้อง backfill และไม่กระทบ Phase 1–7 ที่ verified แล้ว) · `targetGrowthRate` เป็นค่าเริ่มต้นของหน้าจอเท่านั้น ผู้จัดการแก้ตัวเลขในหน้าตัวช่วยตั้งเป้าได้ทุกครั้งโดยไม่ต้องบันทึกกลับมาที่ setting

### ส่วนขยาย 2026-08-16 (รอบที่ 2) — เขต (Territory), เป้าระดับเขต และทะเบียนสินค้า

**สถานะการเปลี่ยนแปลงต่อของเดิม** — อ่านตารางนี้ก่อนลงมือ

| การเปลี่ยนแปลง | ชนิด | ผลต่อข้อมูลจริงที่มีอยู่ |
|---|---|---|
| `Territory`, `TerritoryAssignment`, `HospitalTerritoryChange`, `ProductAlias` (4 ตารางใหม่ + 3 enum) | **เพิ่มล้วน** | ไม่กระทบ |
| คอลัมน์ใหม่บน `Hospital`, `HospitalRegistry`, `Salesperson`, `Product` | **เพิ่มล้วน** (nullable หรือมี default ทุกตัว) | ไม่กระทบ 846 แถวที่ verified แล้ว |
| **นิยาม `TerritoryAssignment` ใหม่: จาก "โรงพยาบาล ↔ คน" เป็น "เขต ↔ คน"** | **breaking เชิงเอกสาร แต่ไม่กระทบข้อมูล** | ตรวจ `schema.prisma` จริงแล้ว — ตารางนี้ **ยังไม่เคยถูกสร้าง** (Module K ยังไม่ implement) จึงไม่มีอะไรต้อง migrate · จำเป็นต้องเปลี่ยนเพราะ `requirement.md` 10.3 ฉบับแก้ไขกำหนดลำดับใหม่: โรงพยาบาล → สังกัดเขต → เขตมีผู้ดูแล 0 คนขึ้นไป การผูกโรงพยาบาลกับ *คน* โดยตรงทำให้เขตที่เจ้าของลาออกได้ยอด 0 |
| **`Target`: `salespersonId` เปลี่ยนเป็น nullable + เพิ่ม `scope` + เพิ่ม `territoryId`** | **⚠️ ไม่ทำลายข้อมูล แต่ทำลายสัญญาของ query เดิม** | การผ่อน NOT NULL และคอลัมน์ใหม่ที่มี default ไม่ทำลายแถวเดิม (แถวที่มีอยู่กลายเป็น `scope = SALESPERSON` โดยอัตโนมัติ) **แต่ทุก query/validator ของ Phase 3 (targets CRUD) และ Phase 4 (`kpi.service.ts`) ที่สมมติว่า `salespersonId` ไม่เป็น null ต้องแก้** และ `qa-engineer` ต้องตรวจ Phase 3/4 ซ้ำ — รูปแบบเดียวกับ `SalesLineCredit` รอบที่แล้ว ดู Risks ข้อ 21 |
| `Region` (seed 5 แถว) ย้ายจาก Module K มาอยู่ใน Module M | ลำดับงาน ไม่ใช่ schema | `Territory.regionId` อ้าง `Region` จึงต้องมีตาราง `Region` ก่อน — `ProvinceMapping` / `ProvinceAlias` / ทะเบียนโรงพยาบาล ยังอยู่ที่ Module K เหมือนเดิม |

```prisma
// ---------- เขต (Territory) — ชั้นซ้อนบนภาค กำหนดเองได้ ----------
// requirement 10.2.0: 1 ภาคมีหลายเขตได้ · มีเขตที่ไม่ตรงกับภาค 5 ค่าเลย (ภาคตะวันตก/ภาคตะวันออก)
// · ต้องรองรับเขตพิเศษข้ามจังหวัด ("เขาใหญ่") ได้ตั้งแต่แรกแม้ยังไม่ implement
// ห้ามเขียนรายชื่อเขตตายในโค้ด และห้ามสมมติว่าเขต ↔ ภาค เป็น 1:1

model Territory {
  id        String   @id @default(cuid())
  name      String   @unique          // "กท1" · "ภาคตะวันตก" · "เขาใหญ่"
  code      String?  @unique
  regionId  String?                   // ป้ายอ้างอิงเท่านั้น — ห้ามใช้แทน Region ในสูตรศักยภาพ และปล่อยว่างได้เสมอ
  region    Region?  @relation(fields: [regionId], references: [id])
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assignments       TerritoryAssignment[]
  hospitals         Hospital[]
  registryHospitals HospitalRegistry[]
  targets           Target[]
}

enum TerritoryRole {
  OWNER
  SUPERVISOR          // เช่น Mr.Chokechai ที่ดูแลเขตภาคตะวันออกร่วมกับ Chidchanok
}

// คน ↔ เขต แบบหลายต่อหลาย · เขตที่ไม่มีแถวเลย = "ยังไม่มีผู้ดูแล" และยังคำนวณ KPI ตามปกติ
model TerritoryAssignment {
  id            String        @id @default(cuid())
  territoryId   String
  territory     Territory     @relation(fields: [territoryId], references: [id], onDelete: Cascade)
  salespersonId String
  salesperson   Salesperson   @relation(fields: [salespersonId], references: [id])
  role          TerritoryRole @default(OWNER)
  effectiveFrom DateTime      @db.Date
  effectiveTo   DateTime?     @db.Date   // null = ยังดูแลอยู่ — ให้ประวัติผู้ดูแลโดยไม่ต้องมีตารางแยก
  assignedById  String?
  assignedBy    User?         @relation(fields: [assignedById], references: [id])
  note          String?
  createdAt     DateTime      @default(now())

  @@unique([territoryId, salespersonId, effectiveFrom])
  @@index([territoryId, effectiveTo])
  @@index([salespersonId, effectiveTo])
}

enum TerritoryLinkSource {
  INFERRED            // ระบบเดาจากประวัติการขาย
  MANUAL              // ผู้จัดการกำหนด/แก้ทับ
}

// ประวัติการย้ายเขตของโรงพยาบาล — requirement 10.3 "ยังไม่ต้องทำหน้าจอ แต่ออกแบบรองรับไว้"
// เก็บเป็น audit อย่างเดียว (ไม่มี relation ออกไป) เพื่อไม่ให้ query ของรายงานต้อง join เพิ่ม
model HospitalTerritoryChange {
  id              String   @id @default(cuid())
  hospitalId      String?
  registryId      String?
  fromTerritoryId String?
  toTerritoryId   String?
  changedById     String?
  changedAt       DateTime @default(now())
  note            String?

  @@index([hospitalId, changedAt])
  @@index([registryId, changedAt])
}

// ---------- ทะเบียนสินค้า (ปิด requirement Open Question ข้อ 11) ----------

enum ProductSource {
  SALES_HISTORY       // ระยะแรก: สร้างจากสินค้าที่เคยปรากฏในประวัติการขาย
  CATALOG             // ระยะหลัง: นำเข้าจากรายการสินค้าทั้งหมดของบริษัท
}

model ProductAlias {
  id            String             @id @default(cuid())
  normalizedKey String             @unique
  sampleRaw     String
  productId     String
  product       Product            @relation(fields: [productId], references: [id], onDelete: Cascade)
  source        NameDecisionSource
  decidedById   String?
  decidedBy     User?              @relation(fields: [decidedById], references: [id])
  decidedAt     DateTime?
  createdAt     DateTime           @default(now())

  @@index([productId])
}
```

**ฟิลด์ที่เพิ่ม/เปลี่ยนในโมเดลเดิม**

```prisma
// Hospital — เพิ่ม 2 คอลัมน์ (nullable/มี default) + back-relation
  territoryId     String?
  territory       Territory?          @relation(fields: [territoryId], references: [id])
  territorySource TerritoryLinkSource @default(INFERRED)

// HospitalRegistry — เพิ่มคู่เดียวกัน (จำเป็นสำหรับ "รพ.ที่ยังไม่เคยขายในเขตนี้" ของ 10.4)
  territoryId     String?
  territory       Territory?          @relation(fields: [territoryId], references: [id])
  territorySource TerritoryLinkSource @default(INFERRED)

// Salesperson — เพิ่ม 2 คอลัมน์ + back-relation
  excludedFromTerritoryTotals Boolean   @default(false)   // Mr.Sathit = true · ห้าม hardcode ชื่อคนในโค้ด
  employmentEndedAt           DateTime? @db.Date          // ป้าย "ลาออกแล้ว" + ไม่ต้องตั้งเป้ารอบต่อไป (รอ requirement OQ20)
  territoryAssignments        TerritoryAssignment[]

// Product — เพิ่ม 4 คอลัมน์ + back-relation · @@unique([name, productTypeId]) เดิมคงไว้
  code        String?       @unique    // ระยะแรกเป็น null ทั้งหมด — ประวัติการขายไม่มีคอลัมน์รหัส
  displayName String?                  // ชื่อทางการจากแคตตาล็อก (ต่างจาก name ที่มาจากไฟล์ยอดขาย)
  source      ProductSource @default(SALES_HISTORY)
  isActive    Boolean       @default(true)
  aliases     ProductAlias[]

// User — back-relation อย่างเดียว
  territoryAssignmentsMade TerritoryAssignment[]
  productAliases           ProductAlias[]

// Territory ต้องเพิ่ม back-relation บน Region
// Region:
  territories Territory[]
```

**`Target` — โมเดลที่เปลี่ยนรูป (ส่วนที่ไม่ได้เขียนถึงคงเดิมทุกตัวอักษร)**

```prisma
enum TargetScope {
  TERRITORY           // เป้าของเขต — เป็นค่าปกติของเป้าปี 2026 ทั้งชุด
  SALESPERSON         // เป้าส่วนตัวที่ไม่ผูกเขต — กรณี Mr.Sathit
}

model Target {
  id                String       @id @default(cuid())
  scope             TargetScope  @default(SALESPERSON)   // default ทำให้แถวเดิมย้ายมาได้โดยไม่ต้อง backfill
  territoryId       String?
  territory         Territory?   @relation(fields: [territoryId], references: [id])
  salespersonId     String?                              // เดิม required → nullable
  salesperson       Salesperson? @relation(fields: [salespersonId], references: [id])
  year              Int
  month             Int
  revenueTarget     Decimal      @default(0) @db.Decimal(14, 2)
  newCustomerTarget Int          @default(0)
  note              String?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  productGroupTargets TargetProductGroup[]
  revisions           TargetRevision[]

  @@unique([territoryId, year, month])
  @@unique([salespersonId, year, month])
  @@index([year, month])
}
```

- **เงื่อนไข XOR**: ต้องมี `territoryId` หรือ `salespersonId` อย่างใดอย่างหนึ่งเท่านั้น และต้องตรงกับ `scope` — Prisma แสดงเป็น constraint ไม่ได้ **บังคับในโค้ดและใน Zod validator** (precedent เดียวกับที่ `TerritoryAssignment` เดิมเคยใช้)
- ใน PostgreSQL ค่า `NULL` ไม่ชนกันใน unique index ทั้งสอง `@@unique` จึงอยู่ร่วมกันได้จริง
- `TargetProductGroup` และ `TargetRevision` **ไม่เปลี่ยนโครงสร้างเลย** — เป้ากลุ่มสินค้าและประวัติการแก้ไขของเขตใช้ตารางเดิมทั้งดุ้น

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

**ตัวแปลงชื่อมาตรฐาน (normalizer)** — เพิ่ม 2026-08-16 · ต้องใช้ฟังก์ชันชุดเดียวกันทุกที่ที่เทียบชื่อ ห้ามเขียนซ้ำแยกไฟล์

| ฟังก์ชัน | นิยาม | ใช้ทำอะไร |
|---|---|---|
| `thaiCore(s)` | เก็บเฉพาะอักษรไทยและตัวเลข ทิ้งอย่างอื่นทั้งหมด แล้วตัดคำนำหน้า `โรงพยาบาลส่งเสริมสุขภาพตำบล` / `รพสต` / `โรงพยาบาล` / `รพ` ออกจากหัวสตริงจนหมด | ส่วนชื่อไทย |
| `latinCore(s)` | เก็บเฉพาะ `A-Z0-9` แล้วแปลงเป็นตัวพิมพ์ใหญ่ | ส่วนชื่ออังกฤษ/ชื่อสาขา |
| `personCore(s)` | ตัดคำนำหน้า `Mr/Mrs/Miss/Ms/Dr/K/Khun` ตัดอักขระที่ไม่ใช่ตัวอักษร แล้วต่อกันเป็นตัวพิมพ์ใหญ่ | ชื่อพนักงานขาย |

การเก็บเฉพาะอักษรไทยแทนการ "ตัดวงเล็บ" ด้วย regex เป็นเรื่องตั้งใจ เพราะข้อมูลจริงมีวงเล็บที่ไม่ปิด (`"โรงพยาบาลเซนต์เมรี่ (SAINT MARY'S HOSPITAL"`) และวงเล็บเต็มความกว้าง `（）` ปนกับครึ่งความกว้าง

**กฎรวมชื่อโรงพยาบาล** (ยืนยันกับ `business-analyst` 2026-08-16)

1. **รวมอัตโนมัติเมื่อ `latinCore` ตรงกัน** — พิสูจน์กับข้อมูลจริงแล้วว่าจับได้ครบทั้ง 5 คู่ที่ซ้ำจริง รวมถึงคู่ที่ชื่อไทยไม่ตรงกัน (`บริษัท โรงพยาบาลกรุงเทพอุดร จำกัด (UDON BANGKOK HOSPITAL )` กับ `โรงพยาบาลกรุงเทพอุดร (UDON BANGKOK HOSPITAL )`) → บันทึกลง `HospitalAlias` (`source = AUTO`)
2. **`thaiCore` ตรงกันแต่ `latinCore` ต่างกัน → ห้ามรวมอัตโนมัติเด็ดขาด** ให้สร้าง `HospitalNameReview` สถานะ `PENDING` ให้ผู้จัดการตัดสิน เหตุผล: ชื่อกลุ่มโรงพยาบาลเอกชนมีรูปแบบ `บริษัท X จำกัด (ชื่อสาขาอังกฤษ)` ซึ่งข้อมูลที่แยกสาขาอยู่ในส่วนอังกฤษล้วน — `บางปะกอก 1` กับ `บางปะกอก 8` มีชื่อไทยเหมือนกันเป๊ะแต่เป็นคนละโรงพยาบาล
3. **ตัดสินแล้วต้องไม่ถามซ้ำ** — `MERGED` เขียน `HospitalAlias` ให้คีย์ทั้งสองชี้ `Hospital` เดียวกัน · `KEPT_SEPARATE` คงแถวไว้ถาวรเพื่อกันไม่ให้ import รอบหน้าตั้งคำถามเดิมอีก
4. **รายการห้ามรวมถาวรที่ยืนยันแล้ว (seed เป็น `KEPT_SEPARATE` ตั้งแต่แรก)**: ศิริราช vs ศิริราช ปิยมหาราชการุณย์ · บางปะกอก 1 vs บางปะกอก 8 · เปาโล พหลโยธิน vs เปาโล รังสิต · ศิครินทร์ vs ศิครินทร์ หาดใหญ่ · วิภาราม vs วิภาราม-ปากเกร็ด · พิษณุเวช vs พิษณุเวช อุตรดิตถ์ · กรุงเทพคริสเตียน vs กรุงเทพคริสเตียน นครปฐม · สินแพทย์ นครปฐม vs สินแพทย์ ลำลูกกา · สาขาของ Bangkok Hospital ทุกจังหวัด · ธนบุรี 1 vs ธนบุรี บำรุงเมือง
5. ตอน import ให้ resolve ชื่อดิบผ่าน `HospitalAlias` ก่อนเสมอ ถ้าไม่พบจึงสร้าง `Hospital` ใหม่พร้อม alias แถวแรก
6. **เกณฑ์ความคล้ายที่จะให้ระบบถาม** (ปิด `requirement.md` Open Question ข้อ 19 ด้วยการวัดจริง) — ใช้ **การตรงกันแบบเป๊ะของคีย์เท่านั้น ไม่ใช้ fuzzy ในการตั้งคำถาม** เพราะวัดกับข้อมูลจริง 846 แถว/146 โรงพยาบาลแล้วได้ผลดังนี้: รวมอัตโนมัติ 5 คู่ถูกต้องทั้งหมด และเข้าคิวให้ผู้จัดการตอบ **0 คำถาม** ซึ่งตอบโจทย์ "ไม่ให้ถามจนน่ารำคาญ" ได้โดยไม่ต้องตั้งเลขเกณฑ์ที่เดาเอา
   - ถ้าภายหลังต้องการให้จับคู่ที่สะกดต่างกันจริง ๆ (ไม่ใช่แค่ต่างที่วงเล็บ) ด้วย ต้องเพิ่มชั้น fuzzy บน `thaiCore` **แต่ห้ามตั้งเลขเกณฑ์โดยไม่วัดก่อน** — ต้องรันทดลองนับจำนวนคำถามที่จะเกิดขึ้นที่เกณฑ์ต่าง ๆ (เช่น 0.80 / 0.85 / 0.90) กับข้อมูลจริงแล้วให้ผู้ใช้เลือกจากจำนวนคำถามที่ยอมรับได้ ไม่ใช่จากตัวเลขความคล้ายลอย ๆ

**กฎชื่อพนักงานขายและการแบ่งเครดิตดีล** (เพิ่ม 2026-08-16 — ผู้ใช้ยืนยันว่าดีลที่แชร์เครดิตเกิดขึ้นประจำ)

1. เทียบด้วย `personCore` → `Mr.Panyawat Siribanchachi` กับ `Mr Panyawat Siribanchachi` เป็นคนเดียวกัน
2. ค่าดิบที่มีตัวคั่น `/` `&` `+` `,` หรือคำว่า `และ` = **ดีลที่แชร์เครดิต** ให้แยกเป็นรายชื่อย่อยแล้ว resolve ทีละคน
3. resolve ผ่าน `SalesmanNameRule` ก่อน ถ้าเคยตัดสินไว้แล้วให้ใช้สัดส่วนเดิมทันที ไม่ถามซ้ำ
4. ถ้าเป็นค่าดิบผสมที่ไม่เคยเจอ → สร้าง `SalesmanNameRule` ใหม่ด้วย **สัดส่วนเท่ากันทุกคน** (2 คน = 50/50) พร้อม `WARNING` code `SHARED_CREDIT_RULE_CREATED` ให้ผู้จัดการเข้าไปยืนยัน/แก้สัดส่วนได้
5. ถ้ามีชื่อย่อยใดที่ resolve ไม่ได้เลย → `ERROR` code `UNKNOWN_SALESMAN_IN_SHARED_DEAL` และข้ามแถว **ห้ามยกเครดิตทั้งก้อนให้คนที่ resolve ได้**
6. ทุก `SalesLine` ต้องมี `SalesLineCredit` อย่างน้อย 1 แถว และผลรวม `sharePercent` ต้องเท่ากับ 100.000 พอดี (ตรวจในทรานแซกชันเดียวกับการ import ถ้าไม่ครบให้ล้มทั้งไฟล์)
7. `SalesLine.salespersonId` ให้เก็บคนที่ `isPrimary = true` (คนแรกในสตริง) ไว้เพื่อแสดงผลและตรวจย้อนไฟล์ต้นทาง

**การกันข้อมูลซ้ำ** — `SalesLine.rowKey` = `"{invoiceNo}|{productName}|{lot}|{occurrenceIndex}"` โดย `occurrenceIndex` คือลำดับที่ 1, 2, 3… ของการพบชุด `invoiceNo + productName + lot` เดิมซ้ำภายในไฟล์เดียวกัน (นับเรียงตามลำดับแถว)

เหตุผล: คีย์ไม่มีตัวเลขเงินหรือจำนวนอยู่ในนั้น การอัปโหลดไฟล์ที่แก้ยอดแล้วจึงเป็นการ **อัปเดตแถวเดิม** ตามที่ผู้ใช้เลือก (ตัวเลือก B) ไม่ใช่การสร้างแถวใหม่ และการมี `occurrenceIndex` ทำให้ใบแจ้งหนี้ที่มีสินค้าชื่อเดียวกัน lot เดียวกัน 2 บรรทัดไม่ถูกตัดทิ้งไป 1 บรรทัด

**พฤติกรรมการนำเข้า** — upsert ตาม `rowKey`: พบแล้ว → อัปเดตค่าทั้งแถว (นับเป็น `updatedRows`), ยังไม่พบ → สร้างใหม่ (นับเป็น `insertedRows`) ทั้งหมดทำใน transaction เดียวต่อไฟล์ ถ้าล้มกลางคันต้อง rollback ทั้งชุดและตั้ง `status = FAILED`

**ผลข้างเคียงที่ต้องทำหลัง import สำเร็จ** — ตั้ง `CoachingInsight.isStale = true` สำหรับทุกงวดใน `periodsTouched` (รวมไตรมาสและปีที่ครอบคลุมงวดนั้น) เพื่อให้หน้าจอแจ้งว่าข้อความ coaching เก่ากว่าข้อมูล และมีปุ่มให้สร้างใหม่

**นิยามตัวนับของ `ImportBatch`** (เพิ่ม 2026-08-16 ตามที่ `qa-engineer` ส่งกลับมาจาก Phase 2 — เดิม `skippedRows` ไม่เคยถูกเพิ่มค่าเลยเพราะไม่มีนิยาม)

| ตัวนับ | นับอะไร | หลักการแยก |
|---|---|---|
| `insertedRows` | แถวที่สร้าง `SalesLine` ใหม่ | — |
| `updatedRows` | แถวที่ upsert ไปทับ `SalesLine` เดิมตาม `rowKey` | — |
| `errorRows` | แถวที่ **มีข้อมูลแต่ถูกปฏิเสธเพราะผิดกฎ** — ตรงกับ `ImportIssue` ระดับ `ERROR` ทุกตัว (`MISSING_REQUIRED`, `INVALID_NUMBER`, `INVALID_DATE`) | มีเจตนาจะเป็นข้อมูล แต่ใช้ไม่ได้ → ต้องมีคนไปแก้ไฟล์ |
| `skippedRows` | แถวที่ **ข้ามโดยไม่ถือว่าผิด** — แถวว่างทั้งแถว, แถวคั่น/แถวรวมยอด/หมายเหตุใต้ตาราง | ไม่ได้ตั้งใจจะเป็นข้อมูลตั้งแต่แรก → ไม่ต้องมีใครไปแก้อะไร |

- **กฎที่ต้องเป็นจริงเสมอ**: `totalRows = insertedRows + updatedRows + skippedRows + errorRows` — `qa-engineer` ใช้สมการนี้ตรวจได้ตรง ๆ
- `totalRows` นับเฉพาะแถวที่อยู่ใต้แถว header ของ sheet แรก ไม่รวมแถว header เอง
- แถวว่างต้อง **เพิ่ม `skippedRows`** ไม่ใช่ `continue` เงียบ ๆ อย่างที่โค้ดปัจจุบันทำ
- เพื่อไม่ให้ตาราง `ImportIssue` ท่วมด้วยแถวว่าง ให้บันทึกเป็น **issue รวบยอดรายการเดียวต่อไฟล์** (`WARNING`, code `BLANK_ROWS_SKIPPED`, `message` ระบุจำนวน) ไม่ใช่รายการละแถว

**ข้อจำกัดที่รู้ตัว** — การ import ไม่ลบแถวเก่าทิ้ง ถ้าไฟล์รอบใหม่ตัดบางบรรทัดออก บรรทัดเดิมจะยังอยู่ในระบบ (ดู Open Questions ข้อ 1)

---

## KPI & Scoring Rules (สัญญาการคำนวณ)

ทุกตัวเลขคำนวณจากคอลัมน์ `Total` (รวม VAT) และแบ่งงวดตาม `SalesLine.year` / `SalesLine.month` เป้าของไตรมาส/ปี = ผลรวมของเป้ารายเดือนในช่วงนั้น

**การรวมยอดรายคน — เปลี่ยนแล้ว 2026-08-16 กระทบทุกสูตรด้านล่าง**

> ยอดของพนักงานขาย 1 คนในงวดหนึ่ง = `Σ (SalesLine.total × SalesLineCredit.sharePercent ÷ 100)` เฉพาะแถว credit ของคนนั้น
> **ห้ามรวมยอดผ่าน `SalesLine.salespersonId` อีกต่อไป** ทุกที่ — ทั้ง KPI, Dashboard, Leaderboard, รายงาน และ payload ที่ส่งให้ AI
> ยอดระดับทีม/บริษัทยังคงรวมจาก `SalesLine.total` ตรง ๆ (ไม่ผ่าน credit) เพื่อไม่ให้นับซ้ำ — และเพราะ `Σ sharePercent = 100` เสมอ ผลรวมของทุกคนจึงเท่ากับยอดบริษัทพอดี ใช้ตรวจความถูกต้องได้

`qa-engineer` ต้องตรวจตัวเลข Phase 4–7 ซ้ำทั้งหมดหลังแก้จุดนี้ แม้ผลลัพธ์ของข้อมูลชุดปัจจุบันจะเปลี่ยนเฉพาะดีลที่แชร์เครดิต เพราะแถวอื่นทั้งหมด backfill ที่ 100%

**นิยาม "เดือนที่มีข้อมูล" (`dataCoverageMonths`)** = จำนวนคู่ (`year`,`month`) ที่ไม่ซ้ำกันซึ่งมี `SalesLine` อยู่ในระบบ ใช้ตัดสินว่า KPI ที่ต้องการประวัติยาวพร้อมใช้หรือยัง

| Metric | นิยาม | คะแนน 0–100 | เงื่อนไขที่ทำให้ "คำนวณไม่ได้" |
|---|---|---|---|
| `REVENUE_VS_TARGET` | `SUM(total)` ของงวด ÷ เป้ายอดขายของงวด × 100 | `min(achievement, 100)` | ไม่ได้ตั้งเป้า หรือเป้า = 0 |
| `NEW_CUSTOMERS` | จำนวนโรงพยาบาลที่ **ขายครั้งแรกในระบบ** ตกอยู่ในงวดนี้ และ `isPreExistingCustomer = false` — ให้เครดิตกับพนักงานขายที่ทำรายการแรกนั้น **ตามสัดส่วน `SalesLineCredit` ของบรรทัดแรกนั้น** (ยืนยัน 2026-08-16) ดีลที่แชร์กัน 50/50 จึงนับให้คนละ 0.5 ราย ทำให้ผลรวมรายคนเท่ากับจำนวนลูกค้าใหม่จริงของบริษัทพอดี · ค่าที่แสดงให้ปัดทศนิยม 1 ตำแหน่ง และระดับบริษัทให้นับเป็นจำนวนโรงพยาบาลที่ไม่ซ้ำ (จำนวนเต็ม) | `min(actual ÷ target × 100, 100)` | `newCustomerTarget` = 0 |
| `PRODUCT_GROUP` | เฉพาะกลุ่มสินค้าที่ตั้งเป้าไว้: `Σ min(ยอดจริงรายกลุ่ม, เป้ารายกลุ่ม) ÷ Σ เป้ารายกลุ่ม × 100` (ตัดยอดเกินรายกลุ่มออกก่อน เพื่อไม่ให้กลุ่มหนึ่งไปกลบอีกกลุ่ม) | ค่าที่ได้ตรง ๆ | ไม่มี `TargetProductGroup` ในงวดนั้นเลย |
| `RETENTION` | โรงพยาบาลที่ซื้อจากพนักงานขายคนนี้ในงวดก่อนหน้า และกลับมาซื้ออีกในงวดนี้ ÷ จำนวนโรงพยาบาลที่ซื้อในงวดก่อนหน้า × 100 | ค่าที่ได้ตรง ๆ | `dataCoverageMonths < minMonthsForChurn` (ค่าเริ่มต้น 6) หรือไม่มีลูกค้าในงวดก่อนหน้า |
| `CONSISTENCY` | สัมประสิทธิ์ความผันผวนของยอดรายเดือนย้อนหลัง `minMonthsForConsistency` เดือน นับถึงเดือนสุดท้ายของงวด: `CV = ส่วนเบี่ยงเบนมาตรฐาน ÷ ค่าเฉลี่ย` | `max(0, (1 − CV)) × 100` | `dataCoverageMonths < minMonthsForConsistency` (ค่าเริ่มต้น 6) หรือค่าเฉลี่ย = 0 |

**คะแนนรวม** = `Σ(น้ำหนัก_i × คะแนน_i) ÷ Σ(น้ำหนัก_i)` โดยนับเฉพาะ metric ที่ **คำนวณได้** เท่านั้น (renormalize)
UI ต้องแสดงกำกับเสมอว่า "คิดจาก X จาก 5 เกณฑ์" และระบุว่าเกณฑ์ไหนถูกยกเว้นพร้อมเหตุผล ("ยังไม่ได้ตั้งเป้า" หรือ "ข้อมูลยังไม่เพียงพอ ต้องการ 6 เดือน ปัจจุบันมี 3 เดือน")
ถ้าไม่มี metric ใดคำนวณได้เลย → ไม่แสดงคะแนนรวม แสดงข้อความอธิบายแทน ห้ามแสดง 0

**KPI ประกอบที่แสดงแต่ไม่คิดคะแนน** — ลูกค้าที่ยัง active ในงวด, ลูกค้าที่หายไป (ไม่สั่งเกิน `churnMonths`), product penetration (จำนวน `ProductType` เฉลี่ยต่อลูกค้า 1 ราย และสัดส่วนกลุ่มสินค้าที่ขายได้), สัดส่วนยอดตามโรงพยาบาล, แนวโน้มยอดรายเดือน — ทุกตัวต้อง drill-down ไปดูรายการ `SalesLine` ที่เป็นที่มาได้

**AI coaching** — คำนวณ KPI และการเปรียบเทียบ (เทียบเป้า / เทียบค่าเฉลี่ยทีม / เทียบงวดก่อน) ให้เสร็จในระบบก่อน แล้วส่งเฉพาะ **ผลสรุปเชิงตัวเลข** ที่ปิดบังชื่อแล้ว (`aiAnonymize = true` → แทนที่ชื่อพนักงานขายด้วย "พนักงานขาย A" และชื่อโรงพยาบาลด้วย "โรงพยาบาล 1") ไปให้ Gemini เรียบเรียงเป็นภาษาไทย เก็บผลลง `CoachingInsight` ถ้าเรียกไม่สำเร็จ → `status = FAILED` และหน้าจอต้อง **แสดงตัวเลข KPI และการเปรียบเทียบตามปกติ** พร้อมข้อความสรุปแบบ rule-based สำรอง ห้ามให้หน้าพังหรือว่างเปล่า

---

## Territory & Potential Rules (สัญญาการคำนวณศักยภาพพื้นที่)

เพิ่ม 2026-08-16 · ปิด Open Question ข้อ 17 ของ `requirement.md` ด้วยตัวเลข coverage จริงจากการทดลองจับคู่รอบที่ 2

> ### ⚠️ ปรับหน่วยเป็น "เขต" — เพิ่ม 2026-08-16 (รอบที่ 2) อ่านก่อนใช้สูตรใด ๆ ในหัวข้อนี้
>
> ทุกสูตรในหัวข้อนี้เขียนไว้ตอนที่เป้าและ KPI ยังผูกกับ **คน** · หลัง `requirement.md` 10.6 ย้ายหน่วยวัดไปที่ **เขต** ให้ **แทน `sp` ด้วย `T` (Territory) ทุกจุดในข้อ 2 และข้อ 5.1–5.6** โดยเงื่อนไข/เพดาน/ข้อห้ามทั้งหมดคงเดิมทุกข้อ:
> - `potential(sp, region)` → `potential(T, region)` = Σ ศักยภาพของโรงพยาบาลที่ `territoryId = T` ในภาคนั้น
> - `personCoverage(sp)` → `territoryCoverage(T)` (นิยามเดิม เปลี่ยนตัวตั้ง/ตัวหารเป็นยอดของเขต)
> - `historyBased` / `potentialBased` / `suggested` คำนวณที่ระดับเขต แล้ว **เขียนลง `Target` ที่ `scope = TERRITORY`**
> - ตัวเลขระดับคนได้มาจากการ derive ตาม Territory KPI Rules ข้อ 6 **ไม่ใช่จากการคำนวณศักยภาพรายคน**
>
> **เหตุผลที่ต้องเปลี่ยน ไม่ใช่ความสวยงาม**: (ก) เขตที่มี 2 คนดูแลจะนับศักยภาพของโรงพยาบาลชุดเดียวกันซ้ำ 2 รอบ (ข) เขตที่ไม่มีเจ้าของจะมีศักยภาพ 0 ทั้งที่มีโรงพยาบาลจริงอยู่ — ทั้งสองอาการทำให้การกระจายเป้าผิดทันที
>
> Module L ยังไม่ implement จึงเป็นการเปลี่ยน **สัญญา ไม่ใช่โค้ด** · ยอดของคนที่ `excludedFromTerritoryTotals = true` ไม่เข้าสูตรศักยภาพของเขตใดเลย ตรงกับ `requirement.md` 10.6 ที่ระบุว่า Mr.Sathit ไม่เข้าคะแนนศักยภาพพื้นที่

### ตัวเลขจริงที่การออกแบบนี้ตั้งอยู่บน

| ภาค | รพ.ที่ขาย | จับคู่ทะเบียนได้ | % แห่ง | ยอดขาย | **% ยอดที่จับคู่ได้** | เตียงในทะเบียน |
|---|---|---|---|---|---|---|
| เหนือ | 22 | 11 | 50.0% | 1.69M | 51.3% | 20,619 |
| อีสาน | 25 | 16 | 64.0% | 4.38M | 91.4% | 37,909 |
| ใต้ | 14 | 5 | 35.7% | 568K | 56.5% | 17,039 |
| กลาง | 39 | 14 | 35.9% | 3.11M | 56.7% | 29,663 |
| **กทม.** | **46** | **0** | **0.0%** | **4.80M** | **0.0%** | **0** |
| รวม | 146 | 46 | 31.5% | 14.56M | **47.8%** | 105,230 |

**ข้อเท็จจริงที่บังคับรูปร่างของสูตร**: ไฟล์ `ขนาดเตียงรพ.xlsx` เป็นทะเบียนตามเกณฑ์ Service Plan ของ สธ. ซึ่งมี 76 จังหวัด — **ไม่มีกรุงเทพมหานคร** ภาค กทม. จึงมีศักยภาพเป็น 0 อย่างถาวรด้วยข้อมูลชุดนี้ ไม่ใช่เพราะจับคู่ไม่สำเร็จ และกรุงเทพคิดเป็น 33% ของยอดทั้งบริษัท โดยพนักงานขายอันดับ 1 ของทีม (24% ของยอด) มี coverage เพียง 7.0%

### สูตร

**1. ศักยภาพรายโรงพยาบาล**

```
potential(h) = metricValue(h, setting.potentialMetric) × tierWeight(h.tier) × h.potentialAdjustment
```

- `setting.potentialMetric` ค่าเริ่มต้น `BEDS`
- `tierWeight` ค่าเริ่มต้น **1.000 ทุกระดับ** → วันแรกให้ผลเท่ากับ "ผลรวมจำนวนเตียงดิบ" พอดี ไม่มีตัวเลขถ่วงน้ำหนักที่ไม่มีใครยืนยันฝังอยู่ในระบบ ผู้จัดการเปิดใช้ทีหลังได้
- `potentialAdjustment` ค่าเริ่มต้น 1.000 ใช้ยกเว้น/ลดทอนรายแห่ง ตามที่ requirement 10.5 บังคับ (ตั้ง 0 = ตัดออกจากศักยภาพทั้งหมด)
- โรงพยาบาลที่ไม่มีในทะเบียน **ไม่มี `potential`** — และต้องไม่ถูกนับเป็น 0 ปนกับที่มีค่าจริง ให้แยกออกไปนับใน coverage แทน

**2. ศักยภาพรายคน — คำนวณแยกรายภาคเสมอ ห้ามรวมเป็นก้อนเดียวทั้งประเทศ**

```
potential(sp, region)      = Σ potential(h) ของทุก TerritoryAssignment ที่ status = ACTIVE ของ sp ในภาคนั้น
potentialShare(sp, region) = potential(sp, region) ÷ Σ potential(*, region)
```

เหตุผลที่ต้องแยกภาค: ถ้ารวมทั้งประเทศ คนที่ดูแลกรุงเทพจะมีสัดส่วนศักยภาพ ≈ 0 แล้วถูกกระจายเป้าต่ำผิดปกติ ทั้งที่ทำยอดสูงสุดในทีม

**3. coverage — ต้องคำนวณ 2 ระดับและแสดงบนหน้าจอเสมอ**

```
regionCoverage(region) = ยอดขายในภาคนั้นจาก รพ.ที่ link แล้ว ÷ ยอดขายทั้งหมดในภาคนั้น
personCoverage(sp)     = ยอดขายของ sp จาก รพ.ที่ link แล้ว ÷ ยอดขายทั้งหมดของ sp
```

ภาคจะ **มีสิทธิ์ใช้ศักยภาพกับเป้า** ก็ต่อเมื่อ `regionCoverage(region) ≥ setting.minRegionCoverage` (ค่าเริ่มต้น 0.50) — ด้วยข้อมูลจริงปัจจุบัน เกณฑ์นี้ทำให้ เหนือ/อีสาน/ใต้/กลาง ผ่าน และ **กทม. ไม่ผ่าน** ซึ่งเป็นผลลัพธ์ที่ต้องการพอดี

**4. อัตราการเจาะพื้นที่ (แสดงอย่างเดียว ไม่เข้าคะแนนรวม)**

```
penetrationIndex(sp, region) = ยอดขายจาก รพ.ที่ link แล้วในภาคนั้น ÷ potential(sp, region)
```

หน่วยคือ **บาทต่อหน่วยศักยภาพ (บาท/เตียง) ไม่ใช่เปอร์เซ็นต์** — ห้ามแสดงเป็น % เพราะจะถูกอ่านผิดว่า "เจาะไปแล้วกี่ % ของตลาด" ซึ่งไม่จริง ใช้เทียบระหว่างคนในภาคเดียวกันเท่านั้น ห้ามเทียบข้ามภาค

**5. ตัวช่วยตั้งเป้า — แสดงคู่กัน 3 ตัวเลขเสมอ ห้ามยุบเหลือตัวเดียว**

ยืนยันครบทุกพารามิเตอร์ 2026-08-16 (ปิด `requirement.md` Open Question ข้อ 10 และคำถามเรื่องเป้าอ้างอิงรายภาค) — **ทุกอย่างในข้อ 5 นี้คำนวณแยกรายภาคก่อนเสมอ แล้วค่อยรวมเป็นตัวเลขรายคนในข้อ 5.5** ห้ามคำนวณเป็นก้อนเดียวทั้งประเทศ

**5.1 `historyBased(sp, region)` — ฐานจากประวัติ**

```
window          = setting.targetLookbackMonths เดือนล่าสุดที่มีข้อมูล (ค่าเริ่มต้น 3) นับถึงเดือนก่อนงวดที่กำลังตั้งเป้า
dealValue(inv)  = Σ (SalesLine.total × SalesLineCredit.sharePercent ÷ 100) ของ sp ทุกบรรทัดที่มี invoiceNo เดียวกัน
                  และอยู่ในภาคนั้น ภายใน window
base(sp,region) = Σ dealValue(inv) ทั้งหมดใน window  −  Σ dealValue(inv) ของดีลที่เป็น outlier
outlier(inv)    = dealValue(inv) ÷ (Σ dealValue ทั้งหมดของ sp ใน window ทุกภาครวมกัน) > setting.targetOutlierThreshold   // ค่าเริ่มต้น 0.40
historyBased(sp,region) = base(sp,region) ÷ จำนวนเดือนใน window × setting.targetGrowthRate
```

- **หน่วยของดีล = 1 `invoiceNo` ไม่ใช่ 1 `SalesLine`** เพราะออร์เดอร์ก้อนใหญ่ก้อนเดียวถูกกระจายเป็นหลายบรรทัดในไฟล์จริง ถ้าวัดรายบรรทัดจะไม่มีบรรทัดไหนถึง 40% เลยและกฎนี้จะไม่เคยทำงาน
- **ตัวหารของเกณฑ์ outlier คือยอดรวมทุกภาคของคนนั้น** ไม่ใช่ยอดเฉพาะภาค — มิฉะนั้นคนที่มีภาคเล็ก ๆ ที่มีดีลเดียวจะถูกตัดดีลนั้นทิ้งทุกครั้งโดยอัตโนมัติ
- ใช้ยอดที่ผ่าน `SalesLineCredit` แล้วเสมอ (ตามสัญญาในหัวข้อ KPI & Scoring Rules) ห้ามรวมผ่าน `SalesLine.salespersonId`
- **ห้ามตัดเงียบ** — หน้าจอต้องแสดงทั้ง "ก่อนตัด / หลังตัด" รายชื่อดีลที่ถูกตัดพร้อมเลขที่ใบกำกับและมูลค่า และมีปุ่มเอากลับเข้ามาคิดได้รายดีล นี่คือเงื่อนไข "ตัด**หรือ**ตีธง" ที่ผู้ใช้เลือก ไม่ใช่ตัดทิ้งอย่างเดียว
- `targetGrowthRate` ค่าเริ่มต้น 1.000 = ไม่บวกการเติบโต ผู้จัดการพิมพ์ตัวเลขเองต่อรอบได้ — จงใจไม่ฝังอัตราเติบโตที่ไม่มีใครยืนยันไว้ในระบบ ด้วยเหตุผลเดียวกับที่ `tierWeight` เริ่มต้นที่ 1.000
- `historyBased` เป็น **ยอดต่อเดือน** เพราะ `Target` เก็บรายเดือน · เป้าไตรมาส/ปี = ผลรวมของเดือนในช่วงนั้น ตรงกับกฎเดิมในหัวข้อ KPI & Scoring Rules

**5.2 `R(region, period)` — เป้าอ้างอิงรายภาค (ปิดปัญหาการอ้างวน)**

```
โหมด SUGGEST (ค่าเริ่มต้น) : R(region) = Σ historyBased(sp, region) ของทุกคนที่มีพื้นที่รับผิดชอบ ACTIVE ในภาคนั้น
โหมด REBALANCE (มีเงื่อนไข): R(region) = Σ Target.revenueTarget ของทุกคนในภาคนั้นในงวดนั้น — snapshot ตอนเปิดหน้าจอ
```

ผู้ใช้เลือก (2026-08-16) ว่า **ไม่เพิ่มช่องกรอกเป้าบริษัทรายภาคเป็นฟิลด์ใหม่** แต่ให้ใช้ "ผลรวมเป้ารายคนในภาคนั้น" เป็นตัวตั้ง · การใช้ผลรวมเป้าที่บันทึกแล้วตรง ๆ **อ้างวน** ด้วย 3 อาการ:

1. รอบตั้งเป้าครั้งแรกของงวดยังไม่มีแถว `Target` เลย → `R = 0` → ทุกข้อเสนอเป็น 0 พอดีในจังหวะที่ต้องใช้ตัวช่วยที่สุด
2. `R` โตขึ้นทุกครั้งที่บันทึกไปทีละคน → ตัวเลขที่เสนอให้คนที่ 5 ขึ้นกับว่าบันทึกคนที่ 1–4 ไปแล้วหรือยัง → **ผลลัพธ์ขึ้นกับลำดับการกด** ไม่นิ่ง และตรวจย้อนไม่ได้
3. การกด "รับข้อเสนอ" เขียน `Target` ซึ่งเปลี่ยน `R` ซึ่งเปลี่ยนข้อเสนอของคนเดิมในการคำนวณรอบถัดไป → ป้อนกลับเป็นวงไม่มีจุดหยุด

**ทางออกที่ล็อกไว้: โหมด SUGGEST ใช้ `Σ historyBased` ของภาคนั้นเป็น `R`** — ยังเป็น "ผลรวมของตัวเลขรายคนในภาค" ตามที่ผู้ใช้เลือก และยังไม่ต้องเพิ่มฟิลด์ให้ใครกรอกตามที่ผู้ใช้ปฏิเสธ แต่เป็นผลรวมของ *ฐานที่คำนวณจากยอดขายในอดีต* ซึ่ง **ไม่ขึ้นกับว่ามีใครตั้งเป้าไปแล้วหรือยัง** จึงนิ่ง ไม่ขึ้นกับลำดับ และการรับข้อเสนอไม่เปลี่ยนข้อเสนอของใครเลย

คุณสมบัติที่ได้มาด้วยและเป็นเหตุผลหลักที่เลือกวิธีนี้:

```
Σ potentialBased(sp, region) = R(region) = Σ historyBased(sp, region)
```

สองคอลัมน์คือ **เงินก้อนเดียวกันของภาคนั้น แบ่งด้วยสัดส่วน 2 แบบ** (สัดส่วนตามประวัติ vs สัดส่วนตามศักยภาพ) ส่วนต่างจึงอ่านได้ตรง ๆ ว่า "คนนี้แบกมากกว่า/น้อยกว่าสัดส่วนศักยภาพในพื้นที่ตัวเอง" และผลรวมของส่วนต่างทั้งภาค = 0 เสมอ ซึ่งคือข้อมูลที่ requirement 10.5 บอกว่ามีค่าที่สุด และใช้เป็นกฎตรวจอัตโนมัติได้อีกชั้น

**โหมด REBALANCE** ใช้ความหมายตามตัวอักษรที่ผู้ใช้เลือก (ผลรวมเป้าที่ตั้งไว้แล้ว) ได้เฉพาะเมื่อมันนิยามได้จริง — เปิดใช้ได้ต่อเมื่อ **ทุกคนในภาคนั้นมีแถว `Target` ของงวดนั้นครบแล้ว** และต้อง **snapshot `R` ตอนเปิดหน้าจอ แล้วห้ามคำนวณ `R` ใหม่ระหว่างที่ผู้จัดการไล่แก้ทีละคน** (ปิดอาการที่ 2 และ 3) ปิดหน้าจอแล้วเปิดใหม่จึงจะได้ `R` ชุดใหม่ · โหมดนี้คือ "เกลี่ยเป้าที่มีอยู่แล้วให้ตรงกับศักยภาพ" ไม่ใช่ "เสนอเป้าตั้งต้น" และหน้าจอต้องบอกชื่อโหมดพร้อมค่า `R` ที่ใช้อยู่เสมอ ห้ามสลับโหมดให้เองเงียบ ๆ

**5.3 `potentialBased` และน้ำหนักผสม**

```
potentialBased(sp,region) = R(region) × potentialShare(sp, region)
w(sp,region)              = 0 ถ้าภาคนั้นไม่ผ่านเกณฑ์ regionCoverage, มิฉะนั้น = min(1 − setting.targetSuggestionAlpha, personCoverage(sp))
suggested(sp,region)      = (1 − w) × historyBased(sp,region) + w × potentialBased(sp,region)
```

- `setting.targetSuggestionAlpha` ค่าเริ่มต้น **1.000 → `w = 0` ทุกคน → `suggested = historyBased`** กล่าวคือวันแรกระบบเสนอเป้าจากประวัติล้วน ส่วนตัวเลขศักยภาพแสดงเป็นข้อมูลประกอบ ผู้จัดการเลื่อน α เองเมื่อพร้อม
- **เพดาน `personCoverage` คือหัวใจ** — ถึงผู้จัดการจะเลื่อน α ไปที่ 0.5 คนที่ coverage 7% ก็จะมีน้ำหนักฝั่งศักยภาพได้ไม่เกิน 7% ระบบจึงไม่มีทางกำหนดเป้าจากเตียงให้คนที่ยอดเกือบทั้งหมดอยู่นอกทะเบียน
- **ห้าม renormalize `suggested` ให้ผลรวมกลับไปเท่ากับ `R`** เพราะ `w` ต่างกันรายคน ผลรวม `suggested` ของภาคจึงไม่เท่ากับ `R` เป๊ะ ๆ — การหารกลับเพื่อให้ลงตัวคือการยกเลิกฤทธิ์ของเพดาน `personCoverage` และทำให้ตัวเลขของคนหนึ่งขึ้นกับ coverage ของอีกคน ให้ **แสดงส่วนต่าง (`Σ suggested − R`) บนหน้าจอแทน** แล้วให้ผู้จัดการเป็นคนเกลี่ยเอง

**5.4 ยอดที่ไม่มีภาค**

ยอดของ sp ที่มาจากโรงพยาบาลที่ยังไม่มี `provinceMappingId` (จึงยังไม่รู้ภาค) ให้แยกเป็น `unmappedBase(sp)` คำนวณด้วยสูตร 5.1 เดียวกัน และ **ผ่านฝั่งประวัติ 100% เสมอ ไม่เข้าสูตรศักยภาพ และไม่เข้า `R` ของภาคใดเลย** ห้ามโยนเข้าภาคใดภาคหนึ่งเพื่อให้ตัวเลขลงตัว หน้าจอต้องแสดงก้อนนี้แยกพร้อมจำนวนโรงพยาบาลที่ยังไม่ได้ map

**5.5 ตัวเลขรายคนที่เอาไปเขียนลง `Target`**

```
suggested(sp) = Σ suggested(sp, region) ทุกภาค + unmappedBase(sp)
```

ตรวจความถูกต้องได้ทันทีว่า เมื่อ α = 1.000 (ค่าเริ่มต้น) ผลลัพธ์ต้องเท่ากับ `historyBased` รวมทุกภาคของคนนั้นพอดี — ถ้าไม่เท่า แปลว่าโค้ดผิด

**5.6 สิ่งที่หน้าจอต้องแสดง**

`historyBased`, `potentialBased`, `suggested` ต้องแสดงคู่กันเสมอ พร้อม **ส่วนต่างระหว่างสองตัวแรก** (requirement 10.5 ระบุว่าเป็นข้อมูลที่มีค่าที่สุด), ป้าย coverage ของคนนั้นและของภาค, โหมดที่ใช้ (SUGGEST/REBALANCE) พร้อมค่า `R`, รายการดีลที่ถูกตัดออกพร้อมปุ่มเอากลับ, ก้อน `unmappedBase`, และค่า `Σ suggested − R` ของภาค · ตัวเลขที่เขียนลง `Target` คือตัวเลขสุดท้ายที่ผู้จัดการยืนยัน ซึ่งแก้ทับได้เสมอ ระบบไม่เคยเขียน `Target` เอง

**6. ข้อห้ามที่เด็ดขาด**

> ห้ามแก้สูตรคะแนนรวม 0–100 ห้ามเพิ่ม `KpiMetric` ตัวใหม่ และห้ามแตะ `ScoringWeight` ที่ Phase 4 ตรวจผ่านแล้ว
> ศักยภาพพื้นที่มีผลต่อการประเมิน **ผ่านทางตัวเลขเป้าที่ผู้จัดการบันทึกเท่านั้น** (requirement 10.5) เมื่อผู้จัดการรับเป้าที่ระบบเสนอ ระบบเขียนลง `Target` ตามปกติ แล้ว KPI เดิมทำงานต่อโดยไม่รู้ว่าเป้ามาจากไหน

**7. ป้ายกำกับที่บังคับให้แสดง** — ทุกหน้าที่โชว์ศักยภาพหรือ penetration ต้องมีข้อความประกอบว่า "คำนวณจากโรงพยาบาลที่จับคู่ทะเบียนได้ X% ของยอดขาย" และสำหรับ กทม. ต้องเขียนตรง ๆ ว่า "ทะเบียนโรงพยาบาลที่ใช้ไม่ครอบคลุมกรุงเทพ จึงยังประเมินศักยภาพพื้นที่นี้ไม่ได้" ห้ามแสดงเลข 0 เฉย ๆ

---

## Territory KPI Rules (สัญญาการคำนวณ KPI และรายงานระดับเขต)

เพิ่ม 2026-08-16 (รอบที่ 2) · ครอบคลุม `requirement.md` 10.2.0, 10.6, 10.7 และมุมมองรายเซลล์ของ 10.4
**Module M / N / P ต้องอ่านหัวข้อนี้ทั้งหัวข้อก่อน implement** — ทุกกฎที่นี่เป็นสัญญาเท่ากับ schema

### 1. หลักการที่ทุกสูตรในหัวข้อนี้ตั้งอยู่บน

> **KPI ของเขตคำนวณจาก "โรงพยาบาลที่สังกัดเขตนั้น" ไม่ใช่จาก "ผลรวมของคนที่ดูแลเขตนั้น"**

ทุก query ในหัวข้อนี้เริ่มจาก `SalesLine.hospital.territoryId` **ห้ามเริ่มจาก `TerritoryAssignment`** — เหตุผลตาม `requirement.md` 10.3: ปัจจุบันมี 2 เขตที่ไม่มีเจ้าของ (ภาคใต้, อีสานตอนบน) ถ้าคำนวณจากผู้ดูแลจะได้ยอด 0 ทั้งที่มีการขายเกิดขึ้นจริง · `TerritoryAssignment` ใช้เพื่อ **แสดงชื่อผู้ดูแล** และเพื่อ derive เป้ารายคน (ข้อ 6) เท่านั้น

### 2. ยอดขายของเขต

```
revenue(T, งวด) = Σ (SalesLine.total × SalesLineCredit.sharePercent ÷ 100)
   เงื่อนไข: SalesLine.hospital.territoryId = T
           · SalesLineCredit.salesperson.excludedFromTerritoryTotals = false
           · (SalesLine.year, SalesLine.month) อยู่ในงวด
```

- ต้องผ่าน `SalesLineCredit` เสมอ ตามสัญญาเดิมในหัวข้อ KPI & Scoring Rules — **ห้ามรวมผ่าน `SalesLine.salespersonId`**
- `excludedFromTerritoryTotals` คือกลไก **เดียว** ที่กันยอดของ Mr.Sathit ออกจากเขต (`requirement.md` 10.6 ปิด OQ23) — **ห้าม hardcode ชื่อคน และห้ามกันด้วย `Product type`** เพราะถ้าพนักงานขายคนอื่นขาย Cook Critical Care ยอดนั้นต้องเข้าเขตตามปกติ
- ดีลที่แชร์เครดิตระหว่างคนที่ถูก exclude กับคนที่ไม่ถูก exclude → เขตได้ **เฉพาะสัดส่วนของฝั่งที่ไม่ถูก exclude** ไม่ใช่ทั้งบรรทัดและไม่ใช่ 0

### 3. สมการยอดรวม 3 ก้อน — ทุกหน้าจอที่แสดงยอดรวมต้องยึดสมการนี้

```
ยอดบริษัท (Σ SalesLine.total) = Σ revenue(ทุกเขต) + personalBucket + unassignedBucket

personalBucket   = Σ (total × share ÷ 100) ของ credit ที่ salesperson.excludedFromTerritoryTotals = true
                   (ทุกโรงพยาบาล ไม่ว่าโรงพยาบาลนั้นอยู่เขตใด)
unassignedBucket = Σ (total × share ÷ 100) ของ credit ที่ไม่ถูก exclude แต่ hospital.territoryId = null
```

**ยอดรวมทีม/บริษัท ≠ ผลรวมทุกเขต** (`requirement.md` 10.6) — หน้าจอ/รายงานที่แสดงยอดรวมต้อง **แสดง 3 ก้อนนี้แยกให้เห็น หรือประกาศชัดว่ายอดที่แสดงคือก้อนไหน** ห้ามบวกเขตครบแล้วเรียกว่ายอดบริษัท และห้ามบวกก้อนของคนที่ถูก exclude เข้าเขตใดเขตหนึ่งเงียบ ๆ
สมการนี้ใช้เป็น **กฎตรวจอัตโนมัติ** ได้ทันที (แบบเดียวกับ "Σ ของทุกคน = ยอดบริษัท" ของ Module J) — `qa-engineer` ต้องตรวจข้อนี้ทุกครั้งที่ตรวจ Module N

### 4. KPI ครบ 5 ตัวที่ระดับเขต

ใช้นิยามและเงื่อนไข "คำนวณไม่ได้" ของหัวข้อ KPI & Scoring Rules ทั้งหมด เปลี่ยนเฉพาะหน่วยจากคนเป็นเขต

| Metric | นิยามที่ระดับเขต | เงื่อนไขที่ทำให้ "คำนวณไม่ได้" | คำนวณได้จริงวันนี้ |
|---|---|---|---|
| `REVENUE_VS_TARGET` | `revenue(T, งวด) ÷ Target(scope=TERRITORY, T, งวด).revenueTarget × 100` | ไม่มีแถว `Target` ของเขตนั้น หรือเป้า = 0 | ✅ ได้ (เป้าปี 2026 มีครบทุกเขต) |
| `NEW_CUSTOMERS` | จำนวนโรงพยาบาลที่ `territoryId = T` ซึ่ง **การขายครั้งแรกที่นับได้** (ไม่รวมบรรทัดของคนที่ถูก exclude) ตกอยู่ในงวดนี้ และ `isPreExistingCustomer = false` — **เป็นจำนวนเต็ม ไม่ต้องแบ่งเศษส่วน** เพราะ 1 แถว = 1 เขต โรงพยาบาลทั้งแห่งสังกัดเขตเดียว | `newCustomerTarget` ของเขต = 0 | ❌ ยังไม่มีตัวเลขเป้ามิตินี้ |
| `PRODUCT_GROUP` | ใช้สูตรเดิม โดยยอดจริงรายกลุ่ม = ยอดของเขตแยกตาม `Product type` และเป้ารายกลุ่ม = `TargetProductGroup` ของ `Target` ของเขตนั้น | ไม่มี `TargetProductGroup` ของเขตนั้นในงวดนั้นเลย | ❌ ยังไม่มีตัวเลขเป้ามิตินี้ |
| `RETENTION` | โรงพยาบาลใน T ที่มียอดในงวดก่อนหน้า และกลับมามียอดอีกในงวดนี้ ÷ จำนวนโรงพยาบาลใน T ที่มียอดในงวดก่อนหน้า × 100 | `dataCoverageMonths < minMonthsForChurn` (6) หรือไม่มีลูกค้าในงวดก่อนหน้า | ❌ มีข้อมูล 3 เดือน |
| `CONSISTENCY` | CV ของ `revenue(T, เดือน)` ย้อนหลัง `minMonthsForConsistency` เดือน | `dataCoverageMonths < minMonthsForConsistency` (6) หรือค่าเฉลี่ย = 0 | ❌ มีข้อมูล 3 เดือน |

**ผลที่ต้องยอมรับและแสดงให้เห็น**: `Σ NEW_CUSTOMERS ของทุกเขต ≠ จำนวนลูกค้าใหม่ของบริษัท` เพราะโรงพยาบาลที่ปิดได้โดยคนที่ถูก exclude ไม่นับให้เขตใดเลย — เป็นผลโดยตรงของกฎ 10.6 ไม่ใช่บั๊ก และต้องอธิบายบนหน้าจอด้วยหลักเดียวกับข้อ 3

### 5. การแสดงคะแนน (ยืนยัน 2026-08-16 — การตัดสินใจแถวที่ 22)

- **ตัวเลขหลักของแต่ละแถวคือ %ถึงเป้า** (`REVENUE_VS_TARGET` ก่อนตัดเพดาน 100 ให้แสดงค่าจริง แต่คะแนนยังใช้ `min(achievement, 100)` ตามสูตรเดิม)
- **คะแนนรวม 0–100 อยู่คนละคอลัมน์** และต้องมีป้าย **"คิดจาก X จาก 5 เกณฑ์"** ติดอยู่เสมอ ห้ามแสดงตัวเลขคะแนนรวมโดยไม่มีป้าย
- เกณฑ์ที่ไม่มีเป้า → **"ยังไม่ได้ตั้งเป้า"** · เกณฑ์ที่ข้อมูลไม่พอ → **"ข้อมูลยังไม่เพียงพอ (ต้องการ 6 เดือน ปัจจุบันมี X เดือน)"** — **ห้ามแสดง 0% และห้ามซ่อนเกณฑ์ทิ้ง** (`requirement.md` 10.7)
- ถ้าไม่มีเกณฑ์ใดคำนวณได้เลย → ไม่แสดงคะแนนรวม แสดงข้อความอธิบายแทน (กฎเดิมของ Phase 4)
- ใช้ `ScoringWeight` และกฎ renormalize เดิมทั้งดุ้น — **ห้ามแก้สูตรคะแนนรวม ห้ามเพิ่ม `KpiMetric` ตัวใหม่ ห้ามสร้างชุดน้ำหนักแยกสำหรับเขต**
- ด้วยข้อมูลวันนี้คะแนนรวมของเขตจะเท่ากับคะแนนยอดขาย vs เป้าพอดี (1/5 เกณฑ์) — **นี่คือเหตุผลที่ %ถึงเป้าต้องเป็นตัวเลขหลัก** ไม่ใช่ให้คะแนนรวมนำหน้าแล้วถูกอ่านว่าเป็นคะแนนเต็มรูปแบบ

### 6. เป้าระดับเขต และเป้ารายคนที่ derive มา (การตัดสินใจแถวที่ 23)

```
derivedTarget(sp, งวด) = Σ over T ที่ sp มี TerritoryAssignment ACTIVE ในงวดนั้น
                          ( Target(scope=TERRITORY, T, งวด).revenueTarget ÷ activeOwnerCount(T, งวด) )

activeOwnerCount(T, งวด) = จำนวน TerritoryAssignment ของ T ที่ effectiveFrom ≤ วันสุดท้ายของงวด
                            และ (effectiveTo = null หรือ effectiveTo ≥ วันแรกของงวด)
```

- **ลำดับความสำคัญ**: ถ้ามีแถว `Target` ที่ `scope = SALESPERSON` ของคนนั้นในงวดนั้น → **ใช้ค่านั้นแทน `derivedTarget` ทั้งก้อน** (หลักการเดิมของเอกสารนี้: ผู้จัดการกรอกทับได้เสมอ) · หน้าจอต้องบอกที่มาของตัวเลขว่า **"กรอกเอง"** หรือ **"คำนวณจากเขต"** ทุกครั้ง
- **ห้ามเขียน `derivedTarget` ลงตาราง `Target`** — คำนวณสดเสมอ มิฉะนั้นตัวเลขจะค้างเมื่อผู้ดูแลเขตเปลี่ยน (เหตุผลเดียวกับที่เอกสารนี้ไม่มีตาราง cache ผล KPI)
- `activeOwnerCount = 0` (เขตไม่มีผู้ดูแล) → เป้าก้อนนั้น **ไม่ตกกับใครเลย** ต้องแสดงเป็นก้อนแยก "เป้าของเขตที่ยังไม่มีผู้ดูแล" ในหน้ารวม ห้ามหารเข้าคนอื่นและห้ามหายไปเงียบ ๆ
- คนที่ `excludedFromTerritoryTotals = true` ไม่มี `TerritoryAssignment` → เป้าของเขามาจาก `Target(scope = SALESPERSON)` อย่างเดียว (Mr.Sathit 166,666.67/เดือน)
- ⚠️ **ข้อนี้ชิงตัดสิน `requirement.md` OQ22 (การแยกเครดิตภายในเขตที่มีหลายคน) ไปก่อน** โดยผู้ใช้รับทราบและเลือกเอง — ถ้า OQ22 ปิดด้วยกฎแบ่งแบบอื่น (เช่น ตามสัดส่วนที่ตกลงกัน หรืออิงรายการขายรายใบแบบ 1.1) **ต้องกลับมาแก้สูตรนี้** และแก้ที่เดียวคือที่นี่ เพราะไม่มีการเขียนค่าลงฐานข้อมูล
- คะแนนและ KPI **รายคน** ของ Phase 4–7 ไม่เปลี่ยนนิยามใด ๆ ทั้งสิ้น เปลี่ยนแค่ที่มาของตัวหาร (เป้า) — ทั้งสองระดับอยู่คู่กัน ไม่แทนที่กัน ตามที่ `requirement.md` 10.6 กำหนด

### 7. รายงาน KPI รายเขต (10.7 — Module N)

- **1 แถว = 1 เขต** ห้ามเป็น 1 แถวต่อคู่ (คน × เขต) เด็ดขาด — กันการอ่านยอดซ้ำในเขตที่มีหลายผู้ดูแล
- คอลัมน์บังคับ: เขต · ผู้ดูแล (ทุกคนในช่องเดียว) · ยอดขาย · เป้า · **%ถึงเป้า (ตัวเลขหลัก)** · KPI 5 ตัวพร้อมป้ายกำกับ · **คะแนนรวม + "คิดจาก X จาก 5 เกณฑ์" (คอลัมน์แยก)**
- เขตที่ไม่มีผู้ดูแล → ช่องผู้ดูแลแสดง **"ยังไม่มีผู้ดูแล"** และ **ยังคำนวณ/แสดงทุกตัวเลขตามปกติ ห้ามซ่อนแถว**
- คนที่ดูแลหลายเขต → ชื่อปรากฏหลายแถว แถวละเขต (ถูกต้องตามนิยาม เพราะแต่ละเขตมีเป้าคนละก้อน)
- ต้องมี **แถว/บล็อกแยก 2 อัน** ต่อท้ายตาราง: `personalBucket` (ชื่อผู้ที่วัดด้วยเป้าส่วนตัว พร้อมเป้าและ %ถึงเป้าของเขาเอง) และ `unassignedBucket` (ยอดของโรงพยาบาลที่ยังไม่ผูกเขต พร้อมจำนวนโรงพยาบาล) — เพื่อให้ผู้อ่านกระทบยอดกลับไปที่ยอดบริษัทได้ตามข้อ 3
- **drill-down บังคับ** จากแต่ละเขต: กลุ่มสินค้า (`Product type`) ที่ขายได้ และ **รายชื่อโรงพยาบาลที่ขายให้** พร้อมยอด — ตามหลักการเดิมว่าทุกตัวเลขต้องกดดูที่มาได้
- เลือกช่วงเวลาได้ เดือน/ไตรมาส/ปี · **หน้าจอ + Export Excel** (ใช้ `exceljs` เดิม ไม่เพิ่ม dependency)

### 8. มุมมองรายเซลล์ของ 10.4 (Module P)

ตั้งต้นจาก "พนักงานขายคนนี้" → เขตที่เขามี `TerritoryAssignment` ACTIVE → โรงพยาบาลในเขตเหล่านั้น
**ห้ามสร้างนิยาม "เคยขาย / ไม่เคยขาย / ไม่มีขายในช่วงนี้" ขึ้นมาใหม่** — ใช้ชุดเดียวกับ 10.4 เดิมและกับ churn

- **"โรงพยาบาลที่ขายได้แล้ว"** = โรงพยาบาลในเขตของเขาที่มียอดในงวดที่เลือก **นับแบบเขต** (ไม่ใช่นับเฉพาะที่เขามีเครดิต) ตามหลัก "KPI เป็นก้อนเดียวที่ระดับเขต" · ต้องมี **ตัวสลับ "เฉพาะที่ฉันมีเครดิต"** ไว้ให้ดูมุมรายคนได้ และต้องบอกชัดว่ากำลังดูโหมดไหน
- **"ยังปิดการขายไม่ได้" แยกเป็น 2 ชุดคนละรายการ** ตาม 10.4: (1) ไม่เคยมีรายการขายเลยตั้งแต่ต้น (2) เคยขายได้แต่ไม่มีรายการในงวดที่เลือก — ชุดที่ 1 ต้องอาศัย `HospitalRegistry` จึง **ขึ้นกับ Module K** ส่วนชุดที่ 2 ทำได้ทันทีจากข้อมูลการขาย
- **จำกัดจำนวนแถวด้วย 2 กลไกพร้อมกันเสมอ** (ยืนยันแล้วใน 10.4): Top N ตามเกณฑ์ศักยภาพที่เลือก (ค่าเริ่มต้น = จำนวนเตียง) **และ** ตัวกรองรายจังหวัด — ไม่ใช่เลือกอย่างใดอย่างหนึ่ง
- **กรองตาม `Product type` ได้** เพื่อตอบ "ยังไม่เคยซื้อสินค้ากลุ่มนี้" แม้จะเคยซื้อกลุ่มอื่นแล้ว
- **คนที่ไม่มีเขต** (`excludedFromTerritoryTotals = true` หรือไม่มี assignment เลย เช่น Mr.Sathit) → หน้าจอ **ห้ามว่างเปล่า** ให้ตกไปที่โหมด "กรองตาม `Product type` ทั่วประเทศ" โดยอัตโนมัติพร้อมข้อความอธิบาย
- ขอบเขตโรงพยาบาลรอบนี้: **โรงพยาบาลรัฐทั่วไป (`GOVERNMENT_GENERAL`) เท่านั้น** ตาม 10.2
- เลือกช่วงเวลาได้ เดือน/ไตรมาส/ปี · หน้าจอ + Export

### 9. การกำหนดเขตครั้งแรกให้โรงพยาบาลที่มีอยู่แล้ว (bootstrap ของ Module M)

ระบบมีโรงพยาบาล 141 แห่งที่ยังไม่มี `territoryId` — ถ้าไม่ bootstrap ทุกยอดจะตกไปที่ `unassignedBucket` ทั้งหมดในวันแรก

1. สำหรับแต่ละ `Hospital` หาพนักงานขายที่มี **ยอด credit สูงสุด** ที่โรงพยาบาลนั้น (ผ่าน `SalesLineCredit` ไม่รวมคนที่ถูก exclude)
2. ถ้าคนนั้นมี `TerritoryAssignment` ACTIVE **เขตเดียว** → ตั้ง `territoryId` เป็นเขตนั้น `territorySource = INFERRED`
3. ถ้าคนนั้นดูแลหลายเขต หรืออันดับ 2 ได้ยอด ≥ 30% ของอันดับ 1 → **ปล่อย `territoryId` เป็น null และตีธงให้ผู้จัดการตัดสิน** ห้ามเลือกให้เอง (หลักเดียวกับ Risks ข้อ 16)
4. ผู้จัดการแก้ทับได้เสมอรายโรงพยาบาล (`territorySource = MANUAL`) และต้องมีเครื่องมือกำหนดยกทั้งจังหวัดในครั้งเดียว
5. หน้าจอต้องแสดง **จำนวนโรงพยาบาลที่ยังไม่ผูกเขตและยอดที่ค้างอยู่ใน `unassignedBucket`** ตลอดเวลา จนกว่าจะเป็น 0

### 10. กฎ as-is ของเขต

**เขตของโรงพยาบาลใช้ค่าปัจจุบันเสมอ ไม่ย้อนตามประวัติ** — ย้ายโรงพยาบาลไปเขตใหม่แล้ว ตัวเลขย้อนหลังของทั้งเขตเดิมและเขตใหม่จะเปลี่ยนตาม · เลือกแบบนี้โดยตั้งใจเพราะทำให้ทุก query เป็น join เดียวและอ่านผลได้ตรงกับ "ใครดูแลอยู่ตอนนี้" ซึ่งคือคำถามที่ผู้ใช้ถาม · `HospitalTerritoryChange` มีไว้ให้ตอบได้ว่าตัวเลขที่เปลี่ยนไปเกิดจากการย้ายเขตครั้งไหน · **ถ้าภายหลังต้องการตัวเลขที่ตรึงตามเขตในอดีต ต้อง amend เอกสารนี้ก่อน ห้าม engineer เพิ่ม logic เอง**

### 11. ข้อห้ามที่เด็ดขาดของหัวข้อนี้

> - ห้ามแก้สูตรคะแนนรวม 0–100 ห้ามเพิ่ม `KpiMetric` ห้ามสร้างชุด `ScoringWeight` แยกสำหรับเขต (`requirement.md` 10.5, 10.6, 10.7 ย้ำ 3 ที่)
> - ห้ามคำนวณยอดเขตจากผู้ดูแล · ห้ามรวมยอดผ่าน `SalesLine.salespersonId`
> - ห้าม hardcode ชื่อเขตหรือชื่อคนใด ๆ ในโค้ด
> - ห้ามเพิ่มตาราง/ฟิลด์ "กลุ่มเขต" (target ผูกหลายเขต) — ผู้ใช้เลือกแตกตัวเลขเป็นรายเขตแทน
> - ห้ามแสดง 0% แทน "ยังไม่ได้ตั้งเป้า" และห้ามซ่อนแถวเขตที่ไม่มีผู้ดูแล

---

## Product Master & Ranking Rules (สัญญาทะเบียนสินค้าและอันดับสินค้ารายเขต)

เพิ่ม 2026-08-16 (รอบที่ 2) · ครอบคลุม `requirement.md` 9.1 · **Module O ต้องอ่านทั้งหัวข้อ**

### 1. ทะเบียนสินค้า 2 ระยะ

| ระยะ | ที่มา | `Product.source` | `Product.code` |
|---|---|---|---|
| **ระยะแรก (รอบนี้)** | สร้างจากสินค้าที่เคยปรากฏในประวัติการขาย (แถว `Product` ที่มีอยู่แล้วทั้งหมด) | `SALES_HISTORY` | **`null` ทั้งหมด** — ไฟล์ยอดขายไม่มีคอลัมน์รหัส |
| **ระยะหลัง** | ผู้ใช้นำเข้ารายการสินค้าทั้งหมดของบริษัท | `CATALOG` | มีรหัสจริง |

- **ห้ามบังคับให้ไฟล์ Excel ยอดขายเปลี่ยนโครงสร้าง** (ผู้ใช้ปฏิเสธทางเลือกนี้) — รายการขายยังจับคู่ทะเบียนด้วย `Product Name` เหมือนเดิม
- ระยะแรก **ไม่ต้องมี migration ข้อมูล** เพราะ `Product` มีอยู่แล้วครบ — เป็นการเติมคอลัมน์ `source` ด้วย default เท่านั้น

### 2. การจับคู่ชื่อสินค้า

- ใช้ `normalizedKey` จาก utility ตัวเดียวกับ Module J (`nameNormalizer` — `latinCore`/`thaiCore`) **ห้ามเขียน normalizer ตัวที่สองขึ้นมา**
- `ProductAlias` เก็บ "ชื่อดิบที่ยุบแล้ว → `Product` ตัวจริง" แบบเดียวกับ `HospitalAlias` · จำคำตัดสินไว้ไม่ต้องถามซ้ำทุกเดือน
- **ระยะแรกยังไม่ต้องมีคิวถามผู้จัดการ** (`ProductNameReview`) — ยืนยันแล้ว (การตัดสินใจแถวที่ 24): ทะเบียนสร้างจากไฟล์เดียวกับที่ใช้จับคู่ จึงตรงกันเป๊ะโดยนิยาม คิวนี้จะจำเป็นตอนแคตตาล็อกจริงเข้ามาชนกับชื่อในไฟล์ยอดขาย → **เป็นงานของระยะ 2 ห้าม implement ล่วงหน้าโดยไม่ amend**
- `@@unique([name, productTypeId])` เดิมคงไว้ — สินค้าชื่อเดียวกันคนละกลุ่มยังเป็นคนละแถวได้เหมือนเดิม

### 3. อันดับสินค้าขายดี/ขายไม่ได้ รายเขต

- **grain: 1 แถว = 1 สินค้า × 1 เขต** · คอลัมน์บังคับตามที่ผู้ใช้ระบุ: **รหัสสินค้า · ชื่อสินค้า · `Product type` · เขต · ผู้ดูแลเขต** + ยอดขายและจำนวน
- `Product.code = null` → แสดง **"—"** พร้อมคำเตือน ห้ามแสดงช่องว่างเปล่าและห้ามเอา `id` มาแสดงแทน
- ผู้ดูแลเขตใช้กฎเดียวกับ 10.7: เขตที่ไม่มีเจ้าของแสดง **"ยังไม่มีผู้ดูแล"** และตัวเลขยังคำนวณตามปกติ
- ยอดขายรายเขตใช้ `revenue(T)` ตาม Territory KPI Rules ข้อ 2 (ผ่าน `SalesLineCredit` และไม่รวมคนที่ถูก exclude) → **สินค้าที่ขายโดยคนที่ถูก exclude จะไม่ปรากฏใต้เขตใดเลย** ต้องมีบล็อกแยกของ `personalBucket` แบบเดียวกับข้อ 3 ของหัวข้อก่อนหน้า มิฉะนั้นรายงานจะบอกว่า Cook Critical Care ไม่เคยขายที่ไหนเลย
- **เรียงจากขายดีที่สุดไปน้อยที่สุด** ตามยอดขาย (`Total`) และ **จัดกลุ่มตาม `Product type`** ตามข้อ 9 เดิม
- **สินค้าที่ขายได้ 0 ต่อท้ายรายการเสมอ ห้ามซ่อน** เรียงตามชื่อสินค้า และต้องแยกป้าย 2 แบบให้ชัด (หลักเดียวกับ 2 รายการของ 10.4):
  - **"ยังไม่เคยขายในเขตนี้เลย"** — ไม่มียอดในเขตนี้ในทุกงวดที่ระบบมีข้อมูล
  - **"เคยขายได้ แต่ไม่มีในงวดที่เลือก"** — เคยมียอดในเขตนี้ แต่ไม่มีในงวดนี้
- เลือกช่วงเวลาได้ เดือน/ไตรมาส/ปี · **หน้าจอ + Export**

### 4. คำเตือนบังคับของระยะแรก

> ทุกหน้าจอและทุกไฟล์ export ที่แสดงรายการ "ขายไม่ได้เลย" ต้องมีข้อความกำกับถาวรว่า
> **"ทะเบียนสินค้าปัจจุบันสร้างจากประวัติการขาย รายการนี้จึงหมายถึงสินค้าที่เขตอื่นขายได้แต่เขตนี้ยังไม่ได้ขาย ไม่ใช่ทั้งแคตตาล็อกของบริษัท"**

ห้ามนำเสนอตัวเลขนี้ราวกับครบถ้วนแล้ว — หลักการเดียวกับข้อจำกัดของ "จำนวนเตียง" ใน 10.5 และป้าย coverage ใน Territory & Potential Rules ข้อ 7 · คำเตือนนี้ถอดออกได้เมื่อ `Product.source = CATALOG` มีอยู่จริงในระบบเท่านั้น

---

## Modules

แบ่งเป็น 16 module ภายในโฟลเดอร์ `sales-evaluation` (A–H ส่งมอบแล้ว · J, K, L เพิ่ม 2026-08-16 · **M, N, O, P เพิ่ม 2026-08-16 รอบที่ 2** · I รอข้อมูลสะสม) เรียงตาม dependency จริง ไม่ใช่ตามลำดับความอยากได้ (ผู้ใช้ยอมรับลำดับนี้แล้วใน requirement ข้อ 14) — การจัดเฟสจริงเป็นงานของ `project-manager`

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

### Module J: ซ่อมข้อมูลชื่อซ้ำ และการแบ่งเครดิตดีล
เพิ่ม 2026-08-16 · **ต้องทำก่อน K และ L** เพราะทั้งสองอย่างตั้งอยู่บนชื่อที่สะอาดแล้ว
- `SalesLineCredit` + backfill 1 แถวต่อ 1 `SalesLine` ที่ 100% แล้วแก้ทุก query ที่รวมยอดรายคนให้อ่านจาก credit
- `SalesmanNameRule` / `SalesmanNameRuleMember` + การ parse ค่าดิบที่มีตัวคั่น + หน้าให้ผู้จัดการยืนยันสัดส่วน
- `HospitalAlias` / `HospitalNameReview` + คิวให้ผู้จัดการตัดสิน + seed รายการ "ห้ามรวมถาวร"
- รวมแถวโรงพยาบาลที่ซ้ำ 5 คู่ และรวมแถวพนักงานขาย `Mr.Panyawat` / `Mr Panyawat`
**Dependencies**: C, E
**Models**: `SalesLineCredit`, `SalesmanNameRule`, `SalesmanNameRuleMember`, `HospitalAlias`, `HospitalNameReview`
**⚠️ ต้องระวังเป็นพิเศษ**: แก้ข้อมูลที่ผู้ใช้เคยเห็นตัวเลขไปแล้ว — ต้องให้ `qa-engineer` ตรวจ Phase 4–7 ซ้ำทั้งหมด และต้องมีสคริปต์ที่ย้อนกลับได้ถ้าผลไม่ถูก

### Module K: ทะเบียนโรงพยาบาล ภาค และพื้นที่รับผิดชอบ
เพิ่ม 2026-08-16 · ครอบคลุม requirement 10.1–10.4
- นำเข้า `ขนาดเตียงรพ.xlsx` เข้า `HospitalRegistry` + `HospitalPotentialMetric` (ใช้ pipeline เดียวกับ Module C)
- seed `Region` 5 ภาค, `ProvinceMapping` 77 จังหวัด, `ProvinceAlias` จากค่าดิบ 69 ค่าที่พบจริง + หน้าให้ผู้จัดการแก้ทั้งการ map จังหวัดและการ map จังหวัด→ภาค
- จับคู่ `Hospital` ↔ `HospitalRegistry` อัตโนมัติ + หน้าให้ผู้จัดการยืนยัน/แก้ทับ/ทำเครื่องหมาย `CONFIRMED_ABSENT`
- เดาเจ้าของจากประวัติการขายเป็น `DRAFT` แล้วผู้จัดการกดยืนยันจึงเป็น `ACTIVE` (ห้ามคำนวณเจ้าของสดทุกครั้ง มิฉะนั้นเจ้าของจะเปลี่ยนเองทุกครั้งที่ import)
- หน้าพื้นที่รับผิดชอบ + รายการโรงพยาบาลที่ยังปิดการขายไม่ได้ 2 ชุดแยกกันตาม requirement 10.4 พร้อมตัวจำกัดจำนวน
**Dependencies**: C, J, **M** (และ E สำหรับนิยาม churn ของรายการชุดที่ 2)
**Models**: `HospitalRegistry`, `HospitalPotentialMetric`, `HospitalRegistryLink`, `ProvinceMapping`, `ProvinceAlias`
**ปรับ 2026-08-16 (รอบที่ 2)**: `Region` (seed 5 แถว) ย้ายไป Module M เพราะ `Territory.regionId` ต้องใช้ก่อน · `TerritoryAssignment` ย้ายไป Module M และเปลี่ยนความหมายเป็น "เขต ↔ คน" · การเดาเจ้าของรายโรงพยาบาลถูกแทนที่ด้วย **โรงพยาบาล → สังกัดเขต** (Territory KPI Rules ข้อ 9) และ module นี้เพิ่มหน้าที่ **ผูก `HospitalRegistry` เข้ากับเขต** เพื่อให้รายการ "รพ.ที่ยังไม่เคยขายในเขตนี้" ของ Module P ทำงานได้
**⚠️ Sensitive**: รับไฟล์ Excel จากภายนอกเพิ่มอีกช่องทาง → `security` ต้องตรวจด้วยเกณฑ์เดียวกับ Module C

### Module L: คะแนนศักยภาพพื้นที่ และตัวช่วยตั้งเป้า
เพิ่ม 2026-08-16 · ครอบคลุม requirement 10.5 — **สิ่งที่ผู้ใช้ต้องการมากที่สุดในรอบนี้**
- คำนวณ `potential` / `potentialShare` / `regionCoverage` / `personCoverage` / `penetrationIndex` ตามหัวข้อ Territory & Potential Rules
- `TierWeight` + หน้าตั้งค่าน้ำหนักตามระดับและค่าปรับรายโรงพยาบาล
- หน้าตัวช่วยตั้งเป้า แสดง `historyBased` / `potentialBased` / `suggested` คู่กันพร้อมส่วนต่างและป้าย coverage แล้วเขียนลง `Target` เดิมเมื่อผู้จัดการรับ
- พารามิเตอร์ครบแล้ว (ย้อนหลัง 3 เดือน · outlier 40% ต่อ `invoiceNo` พร้อมรายการที่ตัดและปุ่มเอากลับ · growth 1.000) และเป้าอ้างอิงรายภาค `R` มี 2 โหมด SUGGEST/REBALANCE ตาม Territory & Potential Rules ข้อ 5.1–5.6
**Dependencies**: D, K, **M**
**⚠️ ปรับ 2026-08-16 (รอบที่ 2)**: ทุกสูตรของ module นี้ **เปลี่ยนหน่วยจากคนเป็นเขต** ตามกล่องเตือนหัวข้อ Territory & Potential Rules — `potential(T, region)`, `territoryCoverage(T)`, `historyBased/potentialBased/suggested` ที่ระดับเขต แล้วเขียนลง `Target` ที่ `scope = TERRITORY` · ตัวเลขรายคนได้จากการ derive (Territory KPI Rules ข้อ 6) ไม่ใช่จากการคำนวณศักยภาพรายคน
**Models**: `TierWeight` + 6 ฟิลด์ใหม่ใน `EvaluationSetting` (`potentialMetric`, `minRegionCoverage`, `targetSuggestionAlpha`, `targetLookbackMonths`, `targetOutlierThreshold`, `targetGrowthRate`) — ทั้งหมดเพิ่มล้วน มี default
**ข้อห้าม**: ห้ามแตะสูตรคะแนนรวมและ `ScoringWeight` ของ Phase 4 · ห้ามเพิ่มฟิลด์เป้าบริษัท/เป้ารายภาค · ห้าม renormalize `suggested`

### Module M: โครงสร้างเขต (Territory) และเป้าระดับเขต
เพิ่ม 2026-08-16 (รอบที่ 2) · ครอบคลุม `requirement.md` 10.2.0, 10.6 และ 2.1 · **เป็น blocker ของรายงานทั้ง 3 ตัว — ไม่มี module นี้ ไม่มีรายงานใดทำได้**
- `Territory` + `TerritoryAssignment` (คน↔เขต N:N มีช่วงเวลา รองรับเขตไม่มีเจ้าของ) + `HospitalTerritoryChange` + seed `Region` 5 ภาค
- คอลัมน์ `territoryId`/`territorySource` บน `Hospital` และ `HospitalRegistry` + คอลัมน์ `excludedFromTerritoryTotals`/`employmentEndedAt` บน `Salesperson`
- **`Target` re-scope**: `scope` + `territoryId` + `salespersonId` nullable และแก้ทุก query/validator ของ Phase 3/4 ที่สมมติว่า `salespersonId` ไม่เป็น null
- bootstrap เขตให้โรงพยาบาล 141 แห่งตาม Territory KPI Rules ข้อ 9 (เดาแล้วตีธง ห้ามเลือกให้เองเมื่อกำกวม)
- หน้าจัดการเขต/ผู้ดูแล + หน้ากรอกเป้าระดับเขต + **กรอกเป้าจริงปี 2026 เข้าระบบ** (ผู้ใช้ต้องแตกตัวเลข 14M/13M เป็นรายเขตก่อน — งานข้อมูล ไม่ใช่งานโค้ด)
- derived เป้ารายคนตาม Territory KPI Rules ข้อ 6 (คำนวณสด ห้ามเขียนลงฐานข้อมูล)
**Dependencies**: J (ต้องมีชื่อที่สะอาดและ `SalesLineCredit` ก่อน มิฉะนั้นยอดรายเขตผิดตั้งแต่วันแรก)
**Models**: `Territory`, `TerritoryAssignment`, `HospitalTerritoryChange`, `Region` (seed), + คอลัมน์ใหม่บน `Hospital`/`HospitalRegistry`/`Salesperson`, + `Target` ที่เปลี่ยนรูป
**⚠️ ต้องระวังเป็นพิเศษ**: `Target` เป็นการเปลี่ยนที่ **ไม่ทำลายข้อมูลแต่ทำลายสัญญาของ query เดิม** — `qa-engineer` ต้องตรวจ Phase 3 และ Phase 4 ซ้ำหลัง module นี้ลง (รูปแบบเดียวกับที่ Module J บังคับให้ตรวจ Phase 4–7 ซ้ำ)
**ความอ่อนไหว**: ไม่รับ input จากภายนอก แต่มี endpoint แก้ตัวเลขเป้าซึ่งเป็นข้อมูลตัวเลขทางธุรกิจ — ระดับเดียวกับ Module D (ไม่ใช่ required security gate แต่ควรตรวจสิทธิ์ MANAGER ให้ครบทุก endpoint)

### Module N: KPI รายเขต และรายงาน KPI รายเขต (10.7)
เพิ่ม 2026-08-16 (รอบที่ 2) · ครอบคลุม `requirement.md` 10.7
- สูตร KPI ครบ 5 ตัว + คะแนนรวมที่ระดับเขต ตาม Territory KPI Rules ข้อ 2–5 (ใช้ `ScoringWeight` และกฎ renormalize เดิม ห้ามแก้สูตร)
- รายงาน 1 แถว = 1 เขต + drill-down `Product type` และรายชื่อโรงพยาบาล + บล็อกแยกของ `personalBucket` และ `unassignedBucket`
- เลือกเดือน/ไตรมาส/ปี + Export Excel (ใช้ `exceljs` เดิม ไม่เพิ่ม dependency)
**Dependencies**: M, E
**Models**: อ่านอย่างเดียว
**กฎตรวจอัตโนมัติที่ `qa-engineer` ต้องใช้**: `Σ revenue(ทุกเขต) + personalBucket + unassignedBucket = Σ SalesLine.total` ของงวดนั้นพอดี

### Module O: ทะเบียนสินค้า และอันดับสินค้าขายดี/ขายไม่ได้ รายเขต (9.1)
เพิ่ม 2026-08-16 (รอบที่ 2) · ครอบคลุม `requirement.md` 9.1 (ขยายข้อ 9)
- **ส่วนที่ 1 — ทะเบียนสินค้า**: ขยาย `Product` (`code`/`displayName`/`source`/`isActive`) + `ProductAlias` + backfill `source = SALES_HISTORY` ให้แถวที่มีอยู่ · **ไม่ขึ้นกับเขต เริ่มทำขนานได้ตั้งแต่วันแรก** (ข้อเดียวของรายงาน 3 ตัวที่ทำก่อนโครงสร้างเขตได้จริง)
- **ส่วนที่ 2 — รายงานอันดับรายเขต**: ตาม Product Master & Ranking Rules ข้อ 3–4 พร้อมคำเตือนบังคับของระยะแรก
**Dependencies**: ส่วนที่ 1 = J · ส่วนที่ 2 = M
**Models**: `ProductAlias` + คอลัมน์ใหม่บน `Product`
**🔒 Security gate — เฉพาะระยะที่ 2**: การนำเข้าไฟล์แคตตาล็อกสินค้าคือ **ช่องรับไฟล์จากภายนอกช่องใหม่** ต้องให้ `security` ตรวจด้วยเกณฑ์เดียวกับ Module C · ระยะแรก (seed จากฐานข้อมูลเดิม) ไม่มี input จากภายนอก

### Module P: มุมมองรายเซลล์ของพื้นที่รับผิดชอบ (10.4)
เพิ่ม 2026-08-16 (รอบที่ 2) · ครอบคลุมมุมมองรายเซลล์ของ `requirement.md` 10.4 · **ต้องแยกส่ง 2 รอบ**
- **P1 (ทำได้ทันทีที่มี M)**: "โรงพยาบาลที่ขายได้แล้ว" ในเขตของเขา + ตัวสลับ "เฉพาะที่ฉันมีเครดิต" + รายการ "เคยขายแต่ไม่มีในงวดนี้" + ตัวกรอง `Product type` + Export
- **P2 (ต้องรอ K)**: "โรงพยาบาลรัฐที่ยังไม่เคยขายเลย" ในเขตของเขา + Top N ตามศักยภาพ **และ** ตัวกรองจังหวัดพร้อมกัน
- โหมดสำรองสำหรับคนที่ไม่มีเขต (Mr.Sathit) — กรอง `Product type` ทั่วประเทศ ห้ามให้หน้าว่างเปล่า
**Dependencies**: P1 = M, E · P2 = K
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

| 13 | **จับคู่ทะเบียนได้เพียง 47.8% ของยอดขาย** (31.5% ของจำนวนแห่ง) | ครึ่งหนึ่งของเงินไม่มีข้อมูลศักยภาพรองรับ | บังคับแสดง coverage ทุกหน้า + เพดาน `personCoverage` ในสูตรเป้า + ตั้ง `minRegionCoverage` กันภาคที่ข้อมูลบางเกินไป |
| 14 | **ทะเบียนไม่มีกรุงเทพเลย (เตียง = 0) แต่กรุงเทพคือ 33% ของยอด** และพนักงานขายอันดับ 1 มี coverage 7.0% | ถ้ากระจายเป้าด้วยสัดส่วนเตียง คนเก่งที่สุดจะได้เป้าเกือบศูนย์ — ตรงข้ามกับเจตนา "ความยุติธรรม" | คำนวณศักยภาพแยกรายภาค + ภาคที่ไม่ผ่านเกณฑ์ coverage ถูกกันออกจากการกระจายเป้าโดยอัตโนมัติ + `targetSuggestionAlpha` เริ่มต้นที่ "ใช้ประวัติล้วน" |
| 15 | **แก้ query รวมยอดรายคนทั้งระบบให้อ่านจาก `SalesLineCredit`** | Phase 4–7 ที่ verified แล้วอาจเพี้ยนถ้าแก้ไม่ครบทุกจุด | ต้องแก้ให้เหลือทางเดียว (ไม่มี fallback ไป `salespersonId`) + `qa-engineer` ตรวจ Phase 4–7 ซ้ำทั้งหมด + ใช้กฎ `Σ ของทุกคน = ยอดบริษัท` เป็นตัวตรวจอัตโนมัติ |
| 16 | **การเดาเจ้าของพื้นที่ตั้งอยู่บนข้อมูลเพียง 1 ไตรมาส** และ 5 จาก 15 จังหวัดมีคนขายสูสีกัน (กรุงเทพ กาญจนบุรี นครปฐม นนทบุรี อุดรธานี) | เดาผิดแล้วศักยภาพและเป้าผิดตามทั้งชุด | ผลการเดาเป็น `DRAFT` เสมอ ผู้จัดการต้องกดยืนยัน + จังหวัดที่อันดับ 2 ได้ ≥30% ของอันดับ 1 ต้องถูกตีธงให้คนตัดสิน ไม่เลือกให้เงียบ ๆ |
| 17 | **น้ำหนักตามระดับโรงพยาบาลเริ่มต้นที่ 1.000 ทุกระดับ** | รพ.ระดับ A 760 เตียง กับ รพ.ชุมชน 760 เตียง (ถ้ามี) ถูกมองว่าศักยภาพเท่ากัน | เป็นการเลือกโดยตั้งใจ เพื่อไม่ให้มีตัวเลขที่ไม่มีใครยืนยันฝังในระบบ — เปิดใช้เมื่อผู้ใช้พร้อมกำหนดน้ำหนักเอง |
| 18 | **ย้อนหลัง 3 เดือน = ข้อมูลทั้งหมดที่มีอยู่ตอนนี้** (ระบบมีแค่ ม.ค.–มี.ค. 2569 ไตรมาสเดียว) | `historyBased` รอบแรกไม่มีอะไรให้เฉลี่ยนอกจากไตรมาสเดียวนั้น ถ้าไตรมาสนั้นผิดปกติ เป้าทั้งปีจะเพี้ยนตาม | หน้าจอต้องแสดงจำนวนเดือนที่ใช้จริงและช่วงวันที่กำกับตัวเลขทุกครั้ง + `targetLookbackMonths` แก้ได้ในหน้าตั้งค่า + ตัวเลขที่เสนอเป็นเพียงข้อเสนอ ผู้จัดการพิมพ์ทับได้เสมอ ระบบไม่เคยเขียน `Target` เอง |
| 19 | **การตัดดีลก้อนใหญ่ที่ >40% อาจตัดฐานหายไปเกือบครึ่ง** โดยเฉพาะคนที่มีลูกค้ารายใหญ่รายเดียวเป็นหลัก | เป้าที่เสนอต่ำกว่าความจริงมาก และถ้าไม่มีใครสังเกตก็จะกลายเป็นเป้าจริง | บังคับแสดง "ก่อนตัด/หลังตัด" + รายชื่อดีลที่ถูกตัดพร้อมเลขที่ใบกำกับ + ปุ่มเอากลับรายดีล (นี่คือส่วน "ตีธง" ของข้อสรุปที่ผู้ใช้เลือก ไม่ใช่ทางเลือกของ implementer) |
| 20 | **ผลรวม `suggested` ของภาคไม่เท่ากับ `R`** เพราะ `w` ต่างกันรายคน | ผู้จัดการอาจคาดหวังว่าตัวเลขจะลงตัวพอดีแล้วสับสน | แสดงส่วนต่าง `Σ suggested − R` ตรง ๆ บนหน้าจอพร้อมคำอธิบาย — **ห้าม renormalize ให้ลงตัว** เพราะจะยกเลิกฤทธิ์ของเพดาน `personCoverage` (Territory & Potential Rules ข้อ 5.3) |
| 21 | **`Target` เปลี่ยนรูป (`salespersonId` → nullable + `scope`)** กระทบทุก query/validator ของ Phase 3 (targets CRUD) และ Phase 4 (`kpi.service.ts` อ่านเป้ารายคน) | Phase 3/4 ที่ verified แล้วอาจเพี้ยนถ้าแก้ไม่ครบ — อาการจะเป็น "เป้าหาย" หรือ "เป้าของเขตถูกอ่านเป็นเป้าของคน" ซึ่งดันคะแนนผิดโดยไม่มีใครเห็น | บังคับให้ทุกที่ที่อ่าน `Target` ระบุ `scope` เสมอ (ห้าม query แบบไม่กรอง scope) + `qa-engineer` ตรวจ Phase 3 และ 4 ซ้ำทั้งหมดหลัง Module M + ใช้กฎตรวจ "ทุกแถว `Target` มี `territoryId` หรือ `salespersonId` อย่างใดอย่างหนึ่งเท่านั้น" เป็น assertion |
| 22 | **KPI ระดับเขตคำนวณได้จริงเพียง 1 ใน 5 เกณฑ์** (2 เกณฑ์ไม่มีตัวเลขเป้า, 2 เกณฑ์ต้องการ 6 เดือนแต่มี 3) | "คะแนนรวม 0–100 ของเขต" จะเท่ากับ %ถึงเป้าพอดี แต่ถูกอ่านว่าเป็นคะแนนเต็มรูปแบบ | ผู้ใช้เลือกทางแก้แล้ว (การตัดสินใจแถวที่ 22): **%ถึงเป้าเป็นตัวเลขหลัก คะแนนรวมอยู่คนละคอลัมน์พร้อมป้าย "คิดจาก X จาก 5 เกณฑ์" เสมอ** + ป้าย "ยังไม่ได้ตั้งเป้า"/"ข้อมูลยังไม่เพียงพอ" รายเกณฑ์ ห้ามแสดง 0% |
| 23 | **เป้ารายคนที่ derive มาจากเขต ใช้การหารเท่ากันตามจำนวนผู้ดูแล** ซึ่งชิงตัดสิน `requirement.md` OQ22 ไปก่อน | ถ้าภายหลังตกลงกฎแบ่งแบบอื่น ตัวเลขเป้ารายคนย้อนหลังทั้งหมดจะเปลี่ยนความหมาย | ผู้ใช้รับทราบและเลือกเอง · ลดผลกระทบด้วยการ **ไม่เขียน `derivedTarget` ลงฐานข้อมูล** — คำนวณสดทุกครั้ง ทำให้การแก้กฎในอนาคตแก้ที่เดียวและไม่ต้อง migrate ข้อมูล |
| 24 | **กฎ as-is ของเขต** — ย้ายโรงพยาบาลไปเขตใหม่แล้วตัวเลขย้อนหลังของทั้ง 2 เขตเปลี่ยนตาม | รายงานงวดเดิมที่พิมพ์ไปประชุมแล้วอาจไม่ตรงกับที่เปิดดูใหม่ | เลือกโดยตั้งใจ (Territory KPI Rules ข้อ 10) + `HospitalTerritoryChange` บันทึกไว้ว่าเปลี่ยนเมื่อไหร่โดยใคร เพื่ออธิบายส่วนต่างได้ · ถ้าต้องการตัวเลขที่ตรึงตามเขตในอดีตต้อง amend เอกสารนี้ก่อน |
| 25 | **รหัสสินค้าว่างทั้งหมดในระยะแรก และ "สินค้าที่ขายไม่ได้เลย" ยังไม่ใช่ทั้งแคตตาล็อก** | ผู้ใช้ขอ "รหัสเครื่องมือ" มาโดยเฉพาะ แต่จะเห็น "—" ทุกแถว และอาจเข้าใจว่ารายการสินค้าที่ขายไม่ได้ครบแล้ว | แสดง "—" ไม่ใช่ช่องว่าง + **คำเตือนบังคับถาวร** ตาม Product Master & Ranking Rules ข้อ 4 (ถอดออกได้ต่อเมื่อมี `Product.source = CATALOG` จริงในระบบ) + แยกป้าย "ยังไม่เคยขายในเขตนี้เลย" กับ "เคยขายแต่ไม่มีในงวดนี้" |
| 26 | **ผู้ใช้เลือกทำ Module M ขนานไปกับงานที่เหลือของ Module J** แทนการรอ J ถูกตรวจรับก่อน (การตัดสินใจแถวที่ 20) | ตัวเลขในรายงานทั้ง 3 ตัวอาจขยับหลัง `qa-engineer` ตรวจ Module J เสร็จ (ยอดรายคน/จำนวนลูกค้าเปลี่ยนได้จากการรวมชื่อซ้ำ) | ความเสี่ยงที่ผู้ใช้เลือกรับเอง — ลดผลด้วย: bootstrap เขตอิงยอด credit จาก `SalesLineCredit` (ซึ่ง Module J แก้เสร็จแล้วฝั่ง backend) ไม่ใช่อิง `SalesLine.salespersonId` · และรายงานทุกตัวคำนวณสด ไม่มี cache จึงสะท้อนข้อมูลที่แก้แล้วทันทีโดยไม่ต้อง rebuild · `project-manager` ต้องยกความเสี่ยงข้อนี้ขึ้นมาในแผน ไม่ใช่ปล่อยให้อยู่แต่ในเอกสารนี้ |

**ลำดับการพัฒนาที่ dependency บังคับ** (แก้ 2026-08-16 รอบที่ 2): A → B → C → D → E → (F, G) → H → J → **M** → (**N**, **P1**, และ **O ส่วนที่ 2** ทำขนานกันได้ทั้งสาม) → **K** → (**L**, **P2**) → (I เมื่อข้อมูลพอ)

- **O ส่วนที่ 1 (ทะเบียนสินค้า) ไม่มี dependency กับเขตเลย — เริ่มขนานได้ตั้งแต่วันแรก** เป็นชิ้นเดียวของรายงาน 3 ตัวที่หยิบมาทำก่อน M ได้จริง
- ผู้ใช้ยืนยัน (การตัดสินใจแถวที่ 20) ให้ **ทำ M ขนานไปกับงานที่เหลือของ J** (`[frontend]` + รอบตรวจของ `qa-engineer`) แทนการรอ J ปิดให้จบก่อน — `project-manager` จัดเฟสตามนี้ได้ แต่ต้องยกความเสี่ยง Risks ข้อ 26 ขึ้นมาแสดงในแผนด้วย
- **ลำดับที่ห้ามสลับเด็ดขาด**: M ต้องมาก่อน N/P/O-ส่วนที่ 2 เสมอ · K ต้องมาก่อน P2 และ L เสมอ

---

## Unresolved Open Questions

รอบแรก (MVP) ตอบครบ 13/13 แล้ว · **รอบขยาย 2026-08-16: ปิดครบทั้ง 3 ข้อที่เป็น blocker แล้ว (ข้อ 1, 2, 5 ด้านล่าง) — ไม่มี blocker ค้างอยู่ Module J/K/L เริ่มจัดเฟสได้** ข้อที่เหลือเป็นเรื่องที่ตัดสินใจทีหลังได้โดยไม่ต้องแก้ schema
**รอบที่ 2 (2026-08-16 — เขต + รายงาน 3 ตัว): ปิด blocker ครบทุกข้อเช่นกัน — Module M/N/O/P เริ่มจัดเฟสได้ทันที** ข้อ 11–15 ด้านล่างเป็นเรื่องข้อมูลและการตัดสินใจที่ทำทีหลังได้ ไม่มีข้อไหนต้องแก้ schema

1. ✅ **ปิดแล้ว 2026-08-16 — ลูกค้าใหม่ที่ปิดได้ด้วยดีลแชร์เครดิต นับให้ใคร** (`requirement.md` Open Question ข้อ 18) ผู้ใช้เลือก **(ค) ตามสัดส่วนเครดิตของบรรทัดแรกนั้น** — ดีล 50/50 นับให้คนละ 0.5 ราย ผลรวมรายคนจึงเท่ากับจำนวนลูกค้าใหม่จริงของบริษัทพอดีและใช้เป็นกฎตรวจอัตโนมัติได้ · นิยามที่ผูกพันอยู่ในหัวข้อ KPI & Scoring Rules แถว `NEW_CUSTOMERS` · **ไม่แตะน้ำหนัก 15% และไม่แตะสูตรคะแนนรวมของ Phase 4** แต่ตัวเลข `NEW_CUSTOMERS` ของดีลที่แชร์กันจะเปลี่ยน จึงอยู่ในขอบเขตที่ `qa-engineer` ต้องตรวจ Phase 4–7 ซ้ำอยู่แล้ว
2. ✅ **ปิดแล้ว 2026-08-16 — พารามิเตอร์ของตัวช่วยตั้งเป้า** (`requirement.md` Open Question ข้อ 10) ย้อนหลัง **3 เดือน** (`targetLookbackMonths`) · เกณฑ์ดีลก้อนใหญ่ผิดปกติ **40%** ของยอดคนนั้นในช่วงย้อนหลัง (`targetOutlierThreshold`) โดยหน่วยของดีลคือ 1 `invoiceNo` และต้อง **แสดงรายการที่ตัดพร้อมปุ่มเอากลับ ห้ามตัดเงียบ** · อัตราเติบโตเริ่มต้น **1.000** (`targetGrowthRate`) ผู้จัดการกรอกเองต่อรอบ · สูตรเต็มอยู่ใน Territory & Potential Rules ข้อ 5.1
3. **สัดส่วนการแบ่งเครดิตดีล** — ตอนนี้ออกแบบให้ค่าเริ่มต้นเป็น "แบ่งเท่ากันทุกคน" และเก็บสัดส่วนไว้ที่ `SalesLineCredit` รายบรรทัด (ยืดหยุ่นที่สุด) โดยมี `SalesmanNameRule` เป็นค่าตั้งต้นที่ผู้จัดการแก้ได้ครั้งเดียวแล้วใช้ตลอด — **ทำงานได้ทั้งกรณีที่ผู้ใช้อยากได้ 50/50 เสมอ และกรณีที่อยากปรับรายดีล** จึงไม่ block แต่ถ้าผู้ใช้ยืนยันว่า "50/50 เสมอ ไม่มีข้อยกเว้น" จะตัด UI แก้รายบรรทัดออกได้
4. **การจัด 4 จังหวัดเข้าภาค** — นครสวรรค์ กำแพงเพชร พิจิตร อุทัยธานี ผมจัดไว้ที่ "เหนือ" บางนิยามจัดเป็น "กลาง" · แก้ได้ในระบบอยู่แล้ว (`ProvinceMapping.regionId`) แต่ควรให้ผู้ใช้เคาะก่อน seed
5. ✅ **ปิดแล้ว 2026-08-16 — เป้าบริษัทรายภาคมาจากไหน** ผู้ใช้เลือก "ใช้ผลรวมตัวเลขรายคนในภาคนั้น **ไม่เพิ่มช่องกรอกเป้าบริษัท**" · การใช้ผลรวม `Target` ที่บันทึกแล้วตรง ๆ **อ้างวน** (ยังไม่มีเป้า→R=0 · ผลขึ้นกับลำดับการบันทึก · รับข้อเสนอแล้วข้อเสนอเปลี่ยนตัวเอง) จึงนิยามใหม่เป็น `R = Σ historyBased` ของภาคนั้นในโหมด SUGGEST ซึ่งไม่ขึ้นกับเป้าที่มีอยู่ และเก็บความหมายตามตัวอักษร (`Σ Target` แบบ snapshot) ไว้เฉพาะโหมด REBALANCE ที่ทุกคนในภาคมีเป้าครบแล้ว · เหตุผลเต็มและคุณสมบัติ `Σ potentialBased = Σ historyBased` อยู่ใน Territory & Potential Rules ข้อ 5.2 — **สอดคล้องกับ `requirement.md` ที่ระบุว่าไม่มีเป้าระดับทีม เพราะไม่มีตัวเลขใหม่ที่ใครต้องกรอกเพิ่มเลย**
6. ✅ **ปิดแล้ว 2026-08-16 (รอบที่ 2) — แหล่งที่มาของรหัสสินค้า** (`requirement.md` Open Question ข้อ 11) รหัสมาจาก **ทะเบียนสินค้าในระบบ** ไม่ใช่คอลัมน์ในไฟล์ Excel · ระยะแรกทะเบียนสร้างจากประวัติการขาย ทำให้ `Product.code` เป็น `null` ทั้งหมดและต้องแสดง "—" พร้อมคำเตือน · ดู Product Master & Ranking Rules · **คำถามที่แตกออกมาแทนและยังค้าง**: ผู้ใช้จะส่งรายการสินค้าทั้งหมดของบริษัทมาเมื่อไหร่ — จนกว่าจะได้ไฟล์นั้น รายการ "สินค้าที่ขายไม่ได้เลย" ยังเป็นแค่ช่องว่างเชิงเปรียบเทียบระหว่างเขต
7. **คำสั่ง "ลบข้อมูลตามงวด"** — ต้องการให้ผู้จัดการลบข้อมูลทั้งเดือน/ทั้งชุด import แล้วนำเข้าใหม่ได้ไหม (แก้ปัญหาข้อ 11 ในตารางความเสี่ยง) ถ้าต้องการ เป็นการเพิ่ม endpoint + UI **ไม่ต้องแก้ schema**
8. **การให้คะแนนเมื่อทำเกินเป้า** — ปัจจุบันทำได้ 100% ของเป้า = คะแนนเต็มของเกณฑ์นั้น ทำเกินไม่ได้คะแนนเพิ่ม ถ้าภายหลังต้องการให้ต่างกัน ต้อง amend สูตรและเพิ่ม `achievementCapPercent` ใน `EvaluationSetting`
9. **ความถี่ในการนำเข้าไฟล์** (`requirement.md` Open Question ข้อ 8) — ไม่กระทบ design มีผลแค่ความสดของ Dashboard
10. **การจัดเฟสและลำดับงานจริง** — เป็นงานของ `project-manager` เอกสารนี้ให้เพียง dependency ที่ห้ามสลับ

**เพิ่ม 2026-08-16 (รอบที่ 2) — รอบรายงาน 3 ตัวและโครงสร้างเขต ปิด blocker ครบทุกข้อ ข้อที่เหลือด้านล่างไม่ block งานและไม่กระทบ schema**

11. **การแตกตัวเลขเป้า 14M / 13M เป็นรายเขต** — ผู้ใช้เลือกแตกเป็นรายเขต (การตัดสินใจแถวที่ 21) แต่ **ยังไม่ได้ให้ตัวเลขที่แตกแล้วมา**: กท1 เท่าไหร่ / ภาคตะวันตกเท่าไหร่ · กท2 เท่าไหร่ / ภาคกลางเท่าไหร่ · เป็น **งานข้อมูล ไม่ใช่งานโค้ด** — Module M implement ได้เลยโดยไม่ต้องรอ แต่ **กรอกเป้าเข้าระบบให้ครบไม่ได้จนกว่าจะได้ตัวเลขนี้** และ 2 เขตนั้นจะยังคำนวณ `REVENUE_VS_TARGET` ไม่ได้ (แสดง "ยังไม่ได้ตั้งเป้า" ตามกฎเดิม)
12. **`requirement.md` OQ20 — วันที่พ้นสภาพจริงของพนักงาน 3 คน** ยังไม่ได้รับคำตอบ · กระทบ `TerritoryAssignment.effectiveTo` ของเขตภาคใต้และอีสานตอนบน (ตั้งแต่เมื่อไหร่จึงเป็น "ยังไม่มีผู้ดูแล") และ `Salesperson.employmentEndedAt` · **ไม่ block Module M** — ตั้ง `effectiveTo` เป็น `null` แล้วมาแก้ทีหลังได้ แต่ตัวเลข `activeOwnerCount` ของงวดย้อนหลังจะยังไม่ตรงจนกว่าจะได้วันที่จริง
13. **`requirement.md` OQ22 — การแยกเครดิตภายในเขตที่มีหลายคน** รอบนี้ใช้ "หารเท่ากันตามจำนวนผู้ดูแล" สำหรับ derive เป้ารายคน (การตัดสินใจแถวที่ 23) ซึ่ง **เป็นการชิงตัดสินคำถามนี้ไปก่อน** — ถ้าปิด OQ22 ด้วยกฎอื่น ต้องกลับมาแก้ Territory KPI Rules ข้อ 6 · แก้ที่เดียว ไม่ต้อง migrate เพราะไม่มีการเขียนค่าลงฐานข้อมูล
14. **เขตพิเศษข้ามจังหวัด ("เขาใหญ่")** — schema รองรับแล้ว (`Territory` ไม่ผูกกับจังหวัดหรือภาค) แต่ **ยังไม่ต้อง implement** ตามที่ `requirement.md` 10.2.0 ระบุ · เมื่อถึงเวลาเป็นแค่การเพิ่มแถวและย้ายโรงพยาบาลเข้าเขต ไม่ต้องแก้โครงสร้าง
15. **สิทธิ์การมองเห็นรายงานรายเขต** — รอบนี้ยึดกฎเดิมของทั้งระบบ (ทุกคนที่ล็อกอินเห็นทุกอย่าง ต่างกันที่สิทธิ์แก้ไข) พนักงานขายจึงเห็น KPI ของทุกเขตรวมถึงเขตที่ตัวเองไม่ได้ดูแล · ถ้าผู้ใช้ต้องการจำกัดภายหลัง เป็นการเปลี่ยนนโยบายทั้งระบบ (`requirement.md` Later) ไม่ใช่เฉพาะรายงานนี้

**สิ่งที่ตัดออกอย่างชัดเจนแล้ว ห้าม implement โดยไม่ amend เอกสารนี้ก่อน**
- ตาราง `PasswordResetToken` และบริการส่งอีเมล (Resend/SendGrid) — ผู้ใช้ยืนยัน 2026-08-14 ว่าใช้อีเมลเป็นแค่ username และให้ผู้จัดการรีเซ็ตรหัสผ่านให้แทน
- การอ่าน sheet ที่ 2 เป็นต้นไปของไฟล์ Excel — ผู้ใช้ยืนยัน 2026-08-14 ว่านำเข้าเฉพาะ sheet แรก
- **ฟิลด์/ตาราง "เป้าบริษัทรายปีหรือรายภาค" ให้ผู้จัดการกรอก** — ผู้ใช้ยืนยัน 2026-08-16 ว่าไม่เพิ่ม ใช้ผลรวมตัวเลขรายคนในภาคแทน (ดู Territory & Potential Rules ข้อ 5.2) ถ้าภายหลังต้องการเป้าบริษัทจริง ๆ ต้อง amend เอกสารนี้ก่อน ห้าม `backend-engineer` เพิ่มคอลัมน์เอง
- **การ renormalize `suggested` ให้ผลรวมของภาคเท่ากับ `R`** — ตัดออกโดยตั้งใจ เพราะจะยกเลิกฤทธิ์ของเพดาน `personCoverage` (Territory & Potential Rules ข้อ 5.3)
- **ตาราง/ฟิลด์ "กลุ่มเขต" (`Target` ผูกได้หลายเขต)** — ผู้ใช้ยืนยัน 2026-08-16 (รอบที่ 2) ว่าให้แตกตัวเลขเป็นเป้ารายเขตแทน เพื่อรักษา grain "1 แถว = 1 เขต" ของ 10.7 ห้าม `backend-engineer` เพิ่มเอง
- **คิวให้ผู้จัดการตัดสินชื่อสินค้าที่คล้ายกัน (`ProductNameReview`)** — เลื่อนไปพร้อมการนำเข้าแคตตาล็อกสินค้าระยะที่ 2 ตามที่ผู้ใช้ยืนยัน ระยะแรกใช้ `ProductAlias` อย่างเดียวก็พอเพราะทะเบียนสร้างจากไฟล์เดียวกับที่ใช้จับคู่
- **การตรึงเขตของโรงพยาบาลตามช่วงเวลา (point-in-time territory)** — เลือกกฎ as-is แทน (Territory KPI Rules ข้อ 10) ถ้าภายหลังต้องการตัวเลขย้อนหลังที่ไม่ขยับเมื่อย้ายเขต ต้อง amend เอกสารนี้ก่อน
- **การเปลี่ยน/เพิ่มสูตรคะแนนรวมสำหรับระดับเขต** — ใช้ `ScoringWeight` และกฎ renormalize ชุดเดียวกับรายคนเท่านั้น ห้ามมีชุดน้ำหนักที่สองในระบบ

---

## Change Log

- 2026-08-16 — **amend รอบที่ 2: โครงสร้างเขต (Territory) + เป้าระดับเขต + รายงาน 3 ตัว (9.1 · 10.4 มุมมองรายเซลล์ · 10.7)** — รอบนี้ครอบคลุม **ทั้ง** การเปลี่ยนหน่วยวัดจากคนเป็นเขต (`requirement.md` 10.2.0 + 10.6 ซึ่งค้างไม่เคยผ่าน `system-analyst` มาก่อน) **และ** รายงาน 3 ตัวที่เพิ่งขอ เพราะรายงานออกแบบแยกจากโครงสร้างเขตไม่ได้ · **schema**: เพิ่ม `Territory`, `TerritoryAssignment`, `HospitalTerritoryChange`, `ProductAlias` (4 ตาราง) + enum `TerritoryRole`, `TerritoryLinkSource`, `ProductSource`, `TargetScope` + คอลัมน์เพิ่มล้วนบน `Hospital`/`HospitalRegistry`/`Salesperson`/`Product` · **`TerritoryAssignment` เปลี่ยนความหมายจาก "โรงพยาบาล↔คน" เป็น "เขต↔คน"** (ตรวจ `schema.prisma` จริงแล้วว่าตารางนี้ยังไม่เคยถูกสร้าง จึงไม่มีข้อมูลต้อง migrate) และ **`Target` เปลี่ยนรูป** (`salespersonId` → nullable, เพิ่ม `scope`/`territoryId`) ซึ่ง **ไม่ทำลายข้อมูลแต่ทำลายสัญญาของ query เดิม** — `qa-engineer` ต้องตรวจ Phase 3/4 ซ้ำ (Risks ข้อ 21) · **เพิ่มหัวข้อสัญญาใหม่ 2 หัวข้อ**: `Territory KPI Rules` (นิยาม KPI 5 ตัว + คะแนนรวมที่ระดับเขต, สมการยอดรวม 3 ก้อน `Σ เขต + personalBucket + unassignedBucket = ยอดบริษัท`, การ derive เป้ารายคน, grain 1 แถว = 1 เขต, มุมมองรายเซลล์, bootstrap เขตให้ 141 โรงพยาบาล, กฎ as-is) และ `Product Master & Ranking Rules` (ทะเบียนสินค้า 2 ระยะ, การจับคู่ชื่อด้วย `ProductAlias`, อันดับสินค้ารายเขตพร้อมสินค้าที่ขายได้ 0 และคำเตือนบังคับ) · **ปรับ Territory & Potential Rules** ให้เปลี่ยนหน่วยของข้อ 2 และ 5.1–5.6 จาก `sp` เป็น `T` (เขตที่มี 2 คนดูแลจะนับศักยภาพซ้ำ และเขตไม่มีเจ้าของจะได้ศักยภาพ 0 ถ้าไม่แก้) · **เพิ่ม Module M → N/O/P** และปรับ dependency ของ K (ต้องรอ M, ย้าย `Region` seed ไป M) และ L (ต้องรอ M + re-grain) · เพิ่มความเสี่ยงข้อ 21–26 และ Open Questions ข้อ 11–15 · **ปิด `requirement.md` OQ11** (รหัสสินค้ามาจากทะเบียนในระบบ) · **การตัดสินใจของผู้ใช้ 5 ข้อในรอบนี้** (ตารางแถวที่ 20–24): ทำ M ขนานกับงานที่เหลือของ J ไม่รอปิดข้อ 0 · แตกเป้า 14M/13M เป็นรายเขตแทนการสร้าง "กลุ่มเขต" · แสดง %ถึงเป้าเป็นตัวเลขหลักและคะแนนรวมคนละคอลัมน์พร้อมป้าย "คิดจาก X จาก 5 เกณฑ์" · derive เป้ารายคน = เป้าเขต ÷ จำนวนผู้ดูแล (ชิงตัดสิน OQ22 โดยผู้ใช้รับทราบ) · รหัสสินค้าว่างในระยะแรกแสดง "—" พร้อมคำเตือน และเลื่อน `ProductNameReview` ไประยะ 2 · **ไม่แตะสูตรคะแนนรวม 0–100 และ `ScoringWeight` ของ Phase 4 ตามข้อห้ามเดิมทุกประการ**
- 2026-08-14 — สร้างเอกสารครั้งแรก ประเมินความเป็นไปได้ 11 ฟีเจอร์ใน MVP + 3 รายการที่นอกขอบเขตเพราะไม่มีข้อมูล, ปิดคำถามที่ค้าง 11 ข้อกับผู้ใช้ (ปี ค.ศ./date serial, upsert ตอน import ซ้ำ, ลูกค้าใหม่ต่อบริษัท + ติ๊กลูกค้าเดิม, renormalize น้ำหนักเมื่อ KPI คำนวณไม่ได้, churn 6 เดือน, Gemini + cache + ปิดบังชื่อ, login ด้วยอีเมล, export Excel อย่างเดียว, ไม่มียอดติดลบ, น้ำหนัก 50/15/15/10/10, ยึด Year/Month เป็นงวดบัญชี), ยืนยัน Prisma schema 17 models/8 enums, ล็อกกฎการนำเข้าและกฎการคำนวณ KPI เป็นสัญญา, แบ่งเป็น 8 modules (A–H) + 1 module เฟสหลัง (I)
- 2026-08-14 — ปิดคำถามที่ค้าง 2 ข้อสุดท้าย: (ก) **นำเข้าเฉพาะ sheet แรกเท่านั้น** เปลี่ยนกฎจากการสแกนทุก sheet เป็นอ่าน sheet แรก + ขึ้น `WARNING` `SHEET_IGNORED` สำหรับ sheet ที่ถูกข้าม เพิ่ม `HEADER_NOT_FOUND` เป็น ERROR (ข) **ใช้อีเมลเป็นแค่ username ไม่มีระบบส่งอีเมลจริง** ตัดตาราง `PasswordResetToken` และบริการส่งอีเมลออกจากขอบเขตอย่างถาวรจนกว่าจะ amend ใหม่ ผู้จัดการเป็นผู้รีเซ็ตรหัสผ่านให้ — เพิ่มความเสี่ยงข้อ 12 (ต้องมีผู้จัดการ 2 บัญชีหรือมีสคริปต์รีเซ็ตฉุกเฉิน) — schema ไม่มีการเปลี่ยนแปลง คำถามครบ 13/13 ข้อ
- 2026-08-16 — **นิยาม `skippedRows` vs `errorRows`** ตามที่ `qa-engineer` ส่งกลับมาจาก Phase 2 (เดิมไม่เคยถูกเพิ่มค่าเลยเพราะไม่มีนิยาม): `errorRows` = แถวที่มีข้อมูลแต่ผิดกฎ, `skippedRows` = แถวว่าง/แถวคั่นที่ข้ามโดยไม่ถือว่าผิด พร้อมกฎ `totalRows = inserted + updated + skipped + error` และ issue รวบยอด `BLANK_ROWS_SKIPPED` — ไม่กระทบ schema
- 2026-08-16 — **ปิด Open Question ข้อ 17 (สูตรศักยภาพพื้นที่)** ด้วยตัวเลข coverage จริงจากการทดลองจับคู่รอบที่ 2 (47.8% ของยอดขาย, กทม. 0%) เพิ่มหัวข้อ `Territory & Potential Rules` ทั้งหัวข้อ: ศักยภาพ = เตียง × น้ำหนักระดับ (default 1.000 ทุกระดับ) × ค่าปรับรายแห่ง, **คำนวณแยกรายภาคเสมอ**, เกณฑ์ `minRegionCoverage` 0.50 กันภาคที่ข้อมูลบางเกินไปออกจากการกระจายเป้า (ผลจริง: กทม. ไม่ผ่าน อีก 4 ภาคผ่าน), เป้าที่เสนอ = ผสมประวัติกับศักยภาพโดยน้ำหนักฝั่งศักยภาพถูกจำกัดด้วย `personCoverage` และค่าเริ่มต้น `targetSuggestionAlpha = 1.000` คือใช้ประวัติล้วน · ยืนยันข้อห้ามไม่แตะสูตรคะแนน 0–100 ของ Phase 4
- 2026-08-16 — **เพิ่มการแบ่งเครดิตดีล** ตามที่ `business-analyst` ยืนยันว่าดีลที่แชร์ระหว่างพนักงานขายเกิดขึ้นประจำ: `SalesLineCredit` เป็นแหล่งเดียวของการรวมยอดรายคน + `SalesmanNameRule`/`SalesmanNameRuleMember` จดจำสัดส่วนไว้ไม่ต้องถามซ้ำ · **เป็นการเปลี่ยนที่ไม่ทำลายข้อมูลแต่ทำลายสัญญาของ query เดิม** — ต้อง backfill 846 แถวที่ 100% แก้ทุก query ของ Phase 4 และให้ `qa-engineer` ตรวจ Phase 4–7 ซ้ำทั้งหมด · `SalesLine.salespersonId` คงไว้แต่เปลี่ยนความหมายเป็นผู้บันทึก ห้ามใช้คำนวณ KPI
- 2026-08-16 — **เพิ่มกฎ normalize และการรวมชื่อเข้า Import Rules**: `thaiCore`/`latinCore`/`personCore`, รวมอัตโนมัติเมื่อชื่ออังกฤษตรงกัน, ห้ามรวมอัตโนมัติเมื่อชื่อไทยตรงแต่อังกฤษต่าง (กรณีสาขา) ให้เข้าคิว `HospitalNameReview` แทน, จดจำคำตัดสินถาวรทั้ง `MERGED` และ `KEPT_SEPARATE` พร้อม seed รายการห้ามรวม 10 คู่ที่ยืนยันแล้ว — พลิกข้อสรุปเดิมในหัวข้อ Declined ของ `requirement.md` ที่เคยตัดหน้าจับคู่ชื่อออก
- 2026-08-16 — **เพิ่ม 12 ตารางใหม่** (ทะเบียนโรงพยาบาล, metric ศักยภาพแบบเก็บเป็นแถว, ตารางเชื่อมทะเบียน, ภาค/จังหวัดมาตรฐาน/alias, พื้นที่รับผิดชอบพร้อมช่วงเวลาที่มีผล, น้ำหนักตามระดับ) + คอลัมน์ใหม่ `Hospital.provinceMappingId` และ 3 คอลัมน์ใน `EvaluationSetting` — ทั้งหมดเป็นการเพิ่มล้วน ยกเว้นเรื่องเครดิตดีลข้างต้น · เพิ่ม Module J (ซ่อมข้อมูล+เครดิตดีล) → K (ทะเบียน+พื้นที่) → L (ศักยภาพ+ตัวช่วยตั้งเป้า) และความเสี่ยงข้อ 13–17
- 2026-08-16 — **ปิด Open Question ข้อ 1 (ลูกค้าใหม่บนดีลแชร์เครดิต)**: ผู้ใช้เลือกแบ่งตามสัดส่วนเครดิตของบรรทัดแรก (ดีล 50/50 = คนละ 0.5 ราย) ยืนยันนิยามในแถว `NEW_CUSTOMERS` ของ KPI & Scoring Rules และบันทึกลงตารางการตัดสินใจ 2026-08-16 แถวที่ 17 — **ไม่แตะน้ำหนัก 15% และไม่แตะสูตรคะแนนรวมของ Phase 4** ไม่กระทบ schema (ใช้ `SalesLineCredit` ที่ออกแบบไว้แล้ว)
- 2026-08-16 — **ปิด Open Question ข้อ 2 (พารามิเตอร์ตัวช่วยตั้งเป้า)**: ย้อนหลัง 3 เดือน · outlier = ดีลที่เกิน 40% ของยอดคนนั้นในช่วงย้อนหลัง โดยหน่วยของดีลคือ **1 `invoiceNo` ไม่ใช่ 1 `SalesLine`** (ถ้าวัดรายบรรทัดกฎนี้จะไม่เคยทำงานกับไฟล์จริง) และตัวหารคือยอดรวมทุกภาคของคนนั้น · อัตราเติบโตเริ่มต้น 1.000 ให้ผู้จัดการกรอกเอง · **ห้ามตัด outlier เงียบ ๆ** ต้องแสดงก่อนตัด/หลังตัดพร้อมปุ่มเอากลับรายดีล · เพิ่ม 3 คอลัมน์ใน `EvaluationSetting` (`targetLookbackMonths`, `targetOutlierThreshold`, `targetGrowthRate`) — **เพิ่มล้วน มี default ครบ ไม่ต้อง backfill ไม่กระทบ Phase 1–7** · เขียนสูตร `historyBased` เต็มเป็นข้อ 5.1
- 2026-08-16 — **ปิด Open Question ข้อ 5 (เป้าอ้างอิงรายภาค) และแก้ปัญหาการอ้างวนของสูตร `potentialBased`**: ผู้ใช้เลือก "ผลรวมตัวเลขรายคนในภาค ไม่เพิ่มช่องกรอกเป้าบริษัท" · การใช้ `Σ Target` ที่บันทึกแล้วเป็นตัวตั้งอ้างวน 3 อาการ (รอบแรกยังไม่มีเป้า → R = 0 · ผลลัพธ์ขึ้นกับลำดับที่กดบันทึก · การรับข้อเสนอเปลี่ยนข้อเสนอของตัวเอง) จึงนิยาม `R(region) = Σ historyBased(sp, region)` ในโหมด SUGGEST ซึ่งคำนวณจากยอดขายในอดีตล้วนและไม่ขึ้นกับเป้าที่มีอยู่ ทำให้ได้คุณสมบัติ `Σ potentialBased = R = Σ historyBased` — สองคอลัมน์เป็นเงินก้อนเดียวกันแบ่งคนละวิธี ส่วนต่างรวมทั้งภาค = 0 ตรงกับ requirement 10.5 · เก็บความหมายตามตัวอักษรไว้ในโหมด REBALANCE เฉพาะเมื่อทุกคนในภาคมีเป้าครบแล้ว และต้อง snapshot `R` ตอนเปิดหน้าจอ · เพิ่มข้อ 5.2–5.6 (เป้าอ้างอิง, น้ำหนักผสม, **ห้าม renormalize**, ยอดที่ยังไม่มีภาค `unmappedBase`, การรวมเป็นตัวเลขรายคน), ความเสี่ยงข้อ 18–20, และรายการที่ตัดออกถาวร 2 รายการ · **ไม่เพิ่มตาราง/คอลัมน์ใด ๆ** · ตรวจแล้วว่าไม่ขัดกับสิ่งที่ล็อกไว้ก่อนหน้า: α = 1.000 ยังให้ `suggested = historyBased` เท่าเดิม, กทม. ยังถูกกันออกด้วยเกณฑ์ coverage เหมือนเดิม, ยังไม่มีเป้าระดับทีมตามที่ `requirement.md` ระบุ
- 2026-08-16 — **ปิด blocker ครบทุกข้อของรอบขยาย** เพิ่มตาราง "การตัดสินใจที่ผู้ใช้ยืนยันแล้ว (2026-08-16)" 6 แถวไว้ใต้ตารางของ 2026-08-14 เพื่อให้ agent ปลายทางอ่านเจอโดยไม่ต้องไล่ Change Log · `design.md` พร้อมส่ง `project-manager` จัดเฟส Module J → K → L
- 2026-08-14 — ตรวจโครงสร้างไฟล์ Excel จริง (`รายละเอียดขาย มกราคม - มีนาคม 2569.xlsx`) พบว่า `Amount` เป็นสูตร `ROUND(Qty*Price*100/107,2)` แปลว่า `Price` รวม VAT แล้ว และ `Total = Qty × Price` เพิ่มกฎตรวจสอบ `TOTAL_MISMATCH` / `AMOUNT_RECOMPUTED` และออกแบบการสแกน sheet อัตโนมัติแทนการ hardcode ชื่อ sheet
