# rental-system-backend
# 🏢 Gifted Hands Ventures — Property Management System

<div align="center">

![Gifted Hands Ventures](https://img.shields.io/badge/Gifted%20Hands%20Ventures-Property%20Management-0A7A4B?style=for-the-badge&logo=buildings)
![Status](https://img.shields.io/badge/Status-Live%20%26%20Running-1DB87A?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-3.0%20Production-C8960A?style=for-the-badge)

**A full-stack property management web application built to replace Excel sheets with a smart, modern, mobile-friendly system — complete with M-Pesa payments, SMS/WhatsApp notifications, real-time dashboard, and enterprise-grade security.**

[🌍 Live Demo](https://giftedhandsventures.vercel.app) · [📦 Frontend Repo](https://github.com/angelaaa1ww-prog/rental-system-frontend) · [⚙️ Backend Repo](https://github.com/angelaaa1ww-prog/rental-system-backend)

</div>

---

## 📸 Screenshots

> Login Page · Dashboard · Tenant Management · Payments · Reports

| Login | Dashboard |
|-------|-----------|
| Clean, secure login with branding | Real-time stats, occupancy rate, overdue tenants |

---

## 🚀 About The Project

**Gifted Hands Ventures PMS** was built to solve a real problem — a landlord managing 5 apartments across Kenya using Excel spreadsheets. Tracking rent payments, tenant details, overdue balances, and sending reminders manually was time-consuming and error-prone.

This system replaces all of that with a **single web application** that the landlord can access from any phone or computer, anywhere in the world.

> Built by **Angela Amani** — at age 18, before joining campus. 🔥

---

## ✨ Features

### 🏠 Property Management
- Add, edit and delete apartments and individual housing units
- Track unit status — **Occupied** or **Vacant** in real time
- Store house details: number, location, bedrooms, monthly rent
- Filter and search houses by name, location or status
- Houses grouped by apartment (A, B, C, D, E)

### 👤 Tenant Management
- Add, edit and delete tenants with full details
- Store name, phone number, national ID
- Assign tenants to specific housing units instantly
- View full **tenant profile** with complete payment history
- Search tenants by name, phone or ID number

### 💳 Payment Tracking
- Record **cash payments** manually with one click
- **M-Pesa STK Push** — sends payment prompt directly to tenant's phone
- Real-time payment confirmation via Safaricom Daraja callback
- Track payment status: `pending` → `confirmed` → `failed`
- Delete incorrect payment records instantly
- Full payment history with dates, references and methods

### 📊 Dashboard & Analytics
- Live overview of total houses, occupied, vacant units
- Occupancy rate progress bar (color-coded green/amber/red)
- Total income collected across all apartments
- Overdue tenants list with exact balance owed
- All data updates in real time

### 📋 Monthly Reports
- Generate rent collection reports by month and year
- See total income, number of transactions, average payment
- Print reports directly from the browser
- **Gifted Hands Ventures** branded report header

### 📱 SMS Notifications (Africa's Talking)
- Send rent reminders to individual tenants with one click
- Broadcast one SMS to ALL tenants simultaneously
- Custom message support — type your own or use default
- **Automated cron jobs** — system sends reminders automatically:
  - 📅 1st of every month → rent due notice to all unpaid tenants
  - 🔔 10 days before due date → gentle reminder
  - 🔔 3 days before due date → follow-up
  - ⚠️ Due today → urgent reminder
  - 🚨 Overdue 1-7 days → overdue warning
  - 🚨 Overdue 8+ days → final urgent notice

### 🔐 Enterprise Security
- **JWT Authentication** with 1-hour auto-expiry
- **Account lockout** after 5 failed login attempts (15 min lock)
- **Real-time SMS security alerts** to owner's phone on every login
- Failed attempt warnings sent to owner from the 2nd wrong password
- Token tampering detection — any modified token is rejected
- HTTPS enforced on all endpoints

### 🌙 UI/UX
- **Dark mode / Light mode** toggle — preference saved across sessions
- Fully **mobile responsive** — works perfectly on any phone
- **PWA** — installable on Android and iPhone like a real app
- Skeleton loading states while data loads
- Smooth animations and transitions
- Toast notifications replace browser alerts
- Instant delete — items removed from UI immediately, no waiting

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React.js** | UI framework |
| **Vercel** | Hosting & deployment |
| **PWA / Service Worker** | Installable app + push notifications |
| **Africa's Talking SDK** | SMS integration |
| **Daraja API (M-Pesa)** | Mobile payments |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js + Express** | REST API server |
| **MongoDB + Mongoose** | Database |
| **JWT** | Authentication & security |
| **Render** | Cloud hosting |
| **node-cron** | Automated rent reminders |
| **Axios** | HTTP requests to Daraja |

### External APIs
| API | Purpose |
|-----|---------|
| **Safaricom Daraja API** | M-Pesa STK Push payments |
| **Africa's Talking** | SMS notifications |
| **MongoDB Atlas** | Cloud database |

---

## 📁 Project Structure

```
rental-system/
├── frontend/                  # React PWA
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   └── sw.js              # Service worker
│   └── src/
│       ├── App.js             # Main application
│       └── MpesaPayButton.js  # M-Pesa payment component
│
└── backend/                   # Node.js API
    ├── config/
    │   └── db.js              # MongoDB connection
    ├── cron/
    │   └── rentCron.js        # Automated SMS reminders
    ├── middleware/
    │   └── authMiddleware.js  # JWT verification
    ├── models/
    │   ├── Tenant.js
    │   ├── House.js
    │   ├── Payment.js
    │   ├── Apartment.js
    │   ├── RentRecord.js
    │   └── SmsLog.js
    ├── routes/
    │   ├── authRoutes.js      # Login + security
    │   ├── tenantRoutes.js
    │   ├── houseRoutes.js
    │   ├── paymentRoutes.js
    │   ├── mpesaRoutes.js     # Daraja STK push
    │   ├── smsRoutes.js
    │   ├── dashboardRoutes.js
    │   └── reportRoutes.js
    ├── utils/
    │   ├── sms.js             # Africa's Talking helper
    │   └── mpesa.js           # Daraja API helper
    └── server.js              # Express app entry point
```

---

## ⚙️ Environment Variables

### Backend `.env`
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

# Admin credentials
ADMIN_EMAIL=admin@rentals.co.ke
ADMIN_PASSWORD=your_secure_password

# Africa's Talking
AT_USERNAME=your_username
AT_API_KEY=your_api_key

# Safaricom Daraja
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://your-backend.onrender.com/api/mpesa/callback

# Security
OWNER_PHONE=+254XXXXXXXXX
CLIENT_URL=https://your-frontend.vercel.app
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- Africa's Talking account
- Safaricom Daraja account

### Installation

**1. Clone both repositories**
```bash
# Frontend
git clone https://github.com/angelaaa1ww-prog/rental-system-frontend.git

# Backend
git clone https://github.com/angelaaa1ww-prog/rental-system-backend.git
```

**2. Install dependencies**
```bash
# Backend
cd rental-system-backend
npm install

# Frontend
cd rental-system-frontend
npm install
```

**3. Set up environment variables**
```bash
# In backend folder
cp .env.example .env
# Fill in your values
```

**4. Run locally**
```bash
# Backend (port 5000)
cd backend
nodemon server.js

# Frontend (port 3000)
cd frontend
npm start
```

**5. Open browser**
```
http://localhost:3000
```

---

## 🌍 Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | [giftedhandsventures.vercel.app](https://giftedhandsventures.vercel.app) |
| Backend | Render | rental-system-backend-1t05.onrender.com |
| Database | MongoDB Atlas | Cloud hosted |

---

## 🔒 Security Features

- ✅ JWT tokens expire after 1 hour
- ✅ Account locks after 5 failed login attempts
- ✅ Real-time SMS alert to owner on every login
- ✅ Failed attempt notifications from 2nd wrong password
- ✅ HTTPS on all endpoints
- ✅ CORS restricted to known frontend URLs
- ✅ Environment variables for all sensitive data
- ✅ Token tampering detection

---

## 📈 Future Roadmap

- [ ] WhatsApp Business API integration
- [ ] PDF receipt generation
- [ ] Multi-landlord support (SaaS)
- [ ] Mobile app via React Native
- [ ] Expense tracking module
- [ ] Tenant rating system
- [ ] Lease agreement digital signing

---

## 👩‍💻 Author

**Angela Amani**
- GitHub: [@angelaaa1ww-prog](https://github.com/angelaaa1ww-prog)
- Built at age 18, before joining campus 🚀
- Location: Nairobi, Kenya 🇰🇪

---

## 🙏 Acknowledgements

- [Safaricom Daraja API](https://developer.safaricom.co.ke) — M-Pesa integration
- [Africa's Talking](https://africastalking.com) — SMS notifications
- [MongoDB Atlas](https://www.mongodb.com/atlas) — Cloud database
- [Render](https://render.com) — Backend hosting
- [Vercel](https://vercel.com) — Frontend hosting

---

<div align="center">

**Built with ❤️ in Nairobi, Kenya 🇰🇪**

*"Replacing Excel sheets with smart technology — one apartment at a time."*

⭐ Star this repo if you found it useful!

</div>
