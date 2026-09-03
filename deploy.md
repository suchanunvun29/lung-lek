# Sales Evaluation System — Deployment Guide & Runbook

## Environments

| Environment | Frontend | Backend | Database | Notes |
|---|---|---|---|---|
| **Production (Vercel + Cloud Container)** | Vercel (Next.js) | Render / Railway / Cloud Run / VPS (.NET 9) | Supabase (PostgreSQL with Pooler) | Highly scalable, low maintenance |
| **Production (Self-hosted Docker)** | Docker Compose (Port 3000) | Docker Compose (Port 4000) | Supabase / RDS / Local Postgres | Behind reverse proxy (Nginx / Caddy with TLS) |
| **Local Dev** | `npm run dev --prefix frontend` (Port 3000) | `dotnet watch run --project src/SalesEvaluation.Api` (Port 4000) | Supabase / Local Postgres | Local development with hot-reload |

---

## Architecture: Vercel + Supabase + .NET 9 Backend

```
[ Client Browser ]
        │
        ├─── (Web UI) ─────────────► [ Vercel (Next.js Frontend) ]
        │                                      │
        └─── (REST API Requests) ─────────────┼──────────────┐
                                               ▼              ▼
                                     [ Backend API (.NET 9 / ASP.NET Core) ]
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

---

### ขั้นตอนที่ 2: Deploy .NET 9 Backend API (Render / Railway / Docker / VPS)
*Backend ถูกพัฒนาบน .NET 9 Modular Monolith ประสิทธิภาพสูง รองรับการประมวลผล Excel ขนาดใหญ่ (20MB) และ AI Coaching ด้วย Google Gemini:*

1. **สร้าง Web Service หรือ Container** (เช่น บน [Render](https://render.com), [Railway](https://railway.app), หรือ Docker Host)
   - **Build Command**: `dotnet publish src/SalesEvaluation.Api/SalesEvaluation.Api.csproj -c Release -o out`
   - **Start Command**: `dotnet out/SalesEvaluation.Api.dll`
   - หรือใช้ Dockerfile: `Dockerfile.backend` (Multi-stage build)
2. **กำหนด Environment Variables ใน Backend**:
   - `DATABASE_URL`: Connection string PostgreSQL (เช่น Supabase Pooler Port 6543)
   - `JWT_SECRET`: รหัสสุ่มสำหรับเซ็น JWT (ความยาวอย่างน้อย 32 ตัวอักษร)
   - `GEMINI_API_KEY`: API Key ของ Google Gemini
   - `ASPNETCORE_ENVIRONMENT`: `Production`
   - `ASPNETCORE_URLS`: `http://+:4000`
   - `PORT`: `4000`
3. เมื่อ Deploy เสร็จ จะได้ URL สำหรับ Backend API เช่น:
   `https://sales-evaluation-api.onrender.com`

---

### ขั้นตอนที่ 3: Deploy Frontend ขึ้น Vercel
1. เข้าไปที่ [Vercel](https://vercel.com) แล้วกด **Add New** > **Project**
2. เลือก Git Repository นี้
3. ในหน้าตั้งค่า **Configure Project**:
   - **Root Directory**: เลือกโฟลเดอร์ `frontend` (กด Edit แล้วเลือก `frontend`)
   - **Framework Preset**: Next.js
4. ในส่วน **Environment Variables** เพิ่มตัวแปร:
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: URL ของ Backend API ที่ได้จากขั้นตอนที่ 2 (เช่น `https://sales-evaluation-api.onrender.com` หรือ `http://localhost:4000`)
5. กด **Deploy**

---

### ขั้นตอนที่ 4: รันระบบผ่าน Docker Compose (Local / Self-hosted)
รันทั้ง .NET 9 Backend และ Frontend พร้อมกันด้วยคำสั่งเดียว:
```bash
docker compose up -d --build
```
ตรวจสอบการทำงาน:
- Backend Health: `curl http://localhost:4000/health`
- Frontend UI: `http://localhost:3000`

---

## Required Environment Variables

### Backend (.NET 9)
| Key | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | Supabase / PostgreSQL Connection String | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres` |
| `PORT` | API Server Port | `4000` |
| `ASPNETCORE_URLS` | ASP.NET Core URL Binding | `http://+:4000` |
| `ASPNETCORE_ENVIRONMENT` | Environment Mode | `Production` or `Development` |
| `JWT_SECRET` | Secret Key สำหรับเซ็น HMAC-SHA256 Token | `super-secret-key-at-least-32-chars-long` |
| `GEMINI_API_KEY` | API Key สำหรับบริการ Google Gemini Coaching | `AIzaSy...` |

### Frontend (Next.js)
| Key | Purpose | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL ของ Backend API | `https://sales-evaluation-api.onrender.com` หรือ `http://localhost:4000` |
