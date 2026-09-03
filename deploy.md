# Sales Evaluation System — Deployment Guide & Runbook

## Environments

| Environment | Frontend | Backend | Database | Notes |
|---|---|---|---|---|
| **Production (Vercel + Cloud)** | Vercel (Next.js) | Render / Railway / Cloud Container / VPS | Supabase (PostgreSQL with Pooler) | Highly scalable, low maintenance |
| **Production (Self-hosted)** | Docker Compose (Port 3000) | Docker Compose (Port 4000) | Supabase / RDS / Local Postgres | Behind reverse proxy (Nginx / Caddy with TLS) |
| **Local Dev** | `npm run dev` (Port 3000) | `npm run dev` (Port 4000) | Supabase / Local Postgres | Local development with hot-reload |

---

## Architecture: Vercel + Supabase + Backend

```
[ Client Browser ]
        │
        ├─── (Web UI) ─────────────► [ Vercel (Next.js Frontend) ]
        │                                      │
        └─── (REST API Requests) ─────────────┼──────────────┐
                                               ▼              ▼
                                     [ Backend API (Node.js/Express) ]
                                               │
                                 ┌─────────────┴─────────────┐
                    (DATABASE_URL: Port 6543)    (DIRECT_URL: Port 5432)
                                 │                           │
                                 ▼                           ▼
                        [ Supabase Pooler ]        [ Supabase Direct DB ]
                                 └─────────────┬─────────────┘
                                               ▼
                                      [ PostgreSQL Engine ]
```

---

## Step-by-Step: Vercel + Supabase Deployment

### ขั้นตอนที่ 1: เตรียมฐานข้อมูล Supabase
1. เข้าไปที่ [Supabase](https://supabase.com) แล้วสร้างโปรเจกต์ใหม่ (หรือเลือกโปรเจกต์เดิม)
2. ไปที่ **Project Settings** > **Database** > **Connection string**:
   - **Transaction Pooler (Port 6543)**: คัดลอกค่าสำหรับ `DATABASE_URL`  
     ตัวอย่าง: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`
   - **Session / Direct (Port 5432)**: คัดลอกค่าสำหรับ `DIRECT_URL`  
     ตัวอย่าง: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
3. รัน Migration เพื่อสร้างตารางทั้งหมดขึ้น Supabase จากเครื่องคุณ:
   ```bash
   cd backend
   # รัน migrate deploy ขึ้น Supabase
   npx prisma migrate deploy
   
   # (ทางเลือก) ทำการ seed ข้อมูลเริ่มต้น เช่น user/master data
   npm run prisma:seed
   ```

---

### ขั้นตอนที่ 2: Deploy Backend API (Render / Railway / VPS)
*เนื่องจาก Express เป็นเซิร์ฟเวอร์แบบ long-running และมีการอัปโหลดไฟล์ Excel ขนาดใหญ่ (20MB) จึงแนะนำให้ deploy ขึ้น Render, Railway, Fly.io หรือ VPS:*

1. **สร้าง Web Service ใหม่** (เช่น บน [Render](https://render.com) หรือ [Railway](https://railway.app))
   - Root Directory: `backend`
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npm run start`
2. **กำหนด Environment Variables ใน Backend**:
   - `DATABASE_URL`: Connection string (Port 6543 จาก Supabase)
   - `DIRECT_URL`: Connection string (Port 5432 จาก Supabase)
   - `JWT_SECRET`: รหัสสุ่มยาว (เช่น ความยาว 32–64 ตัวอักษร)
   - `JWT_EXPIRES_IN`: `1d`
   - `GEMINI_API_KEY`: API Key ของ Gemini
   - `PORT`: `4000` (หรือ port ที่ platform กำหนด)
3. เมื่อ Deploy เสร็จ จะได้ URL สำหรับ Backend API เช่น:
   `https://sales-evaluation-api.onrender.com`

---

### ขั้นตอนที่ 3: Deploy Frontend ขึ้น Vercel
1. เข้าไปที่ [Vercel](https://vercel.com) แล้วกด **Add New** > **Project**
2. เลือก Git Repository นี้
3. ในหน้าตั้งค่า **Configure Project**:
   - **Root Directory**: เลือกโฟลเดอร์ `frontend` (กด Edit แล้วเลือก `frontend`)
   - **Framework Preset**: Next.js (ระบบจะเลือกให้อัตโนมัติ)
4. ในส่วน **Environment Variables** เพิ่มตัวแปร:
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: URL ของ Backend API ที่ได้จากขั้นตอนที่ 2 (เช่น `https://sales-evaluation-api.onrender.com`)
5. กด **Deploy**
   - Vercel จะทำการ build และ deploy หน้าเว็บให้อัตโนมัติ เมื่อเสร็จแล้วจะได้ URL สำหรับเข้าใช้งานระบบ เช่น `https://sales-evaluation.vercel.app`

---

## Runbook & Database Migrations

ก่อนการแก้ไข Schema ในอนาคต ให้ทำตามขั้นตอน 5-step:
1. **Dry Run**: `npx prisma migrate status`
2. **Backup**: Backup ข้อมูลจาก Supabase Dashboard หรือ `pg_dump`
3. **Execute**: `npx prisma migrate deploy`
4. **Verify**: `npx prisma migrate status`

---

## Required Environment Variables

### Backend
| Key | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | Supabase Pooler Connection (Port 6543) | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Supabase Direct Connection (Port 5432) | `postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres` |
| `PORT` | API Server Port | `4000` |
| `JWT_SECRET` | JWT Secret Key | Random string |
| `JWT_EXPIRES_IN` | Token Expiry | `1d` |
| `GEMINI_API_KEY` | Gemini API Key | `AIzaSy...` |

### Frontend
| Key | Purpose | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL ของ Backend API | `https://sales-evaluation-api.onrender.com` |
