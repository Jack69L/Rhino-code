# 💰 EarnCoin — Telegram Mini App

A full-stack monetizable Telegram Mini App with ad rewards, spin wheel, scratch cards, referrals, streaks, and a fraud-prevention withdrawal gate.

---

## 🚀 Quick Setup (5 Minutes)

### 1. Create your Telegram Bot
1. Open Telegram → search **@BotFather**
2. Send `/newbot` → follow prompts → copy your **BOT_TOKEN**
3. Send `/newapp` to BotFather → link your deployed URL as the Mini App

### 2. Configure Environment
```bash
cd backend
cp .env.example .env
```
Edit `.env`:
```
BOT_TOKEN=1234567890:ABCdef...   ← from BotFather
BOT_USERNAME=YourBotUsername      ← without @
APP_URL=https://your-app.up.railway.app
ADMIN_KEY=make_this_a_long_secret
PORT=3000
```

### 3. Deploy to Railway (Free)
1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set environment variables in Railway dashboard
4. Copy your Railway URL → paste into `.env` as `APP_URL`

### 4. Local Development
```bash
cd backend
npm install
npm start
# → Server running on http://localhost:3000
```

---

## 📁 Project Structure
```
earncoin/
├── backend/
│   ├── server.js          ← Express server + Telegram bot
│   ├── database.js        ← SQLite schema + seed data
│   ├── helpers.js         ← Utility functions
│   ├── .env.example       ← Environment template
│   └── routes/
│       ├── users.js       ← User init, profile, leaderboard
│       ├── earnings.js    ← Ads, spin wheel, scratch card
│       ├── tasks.js       ← Task list + completion
│       └── withdrawals.js ← Withdrawal requests + admin
├── frontend/
│   └── index.html         ← Complete Mini App UI (self-contained)
└── README.md
```

---

## 💰 How Users Earn
| Action | Reward |
|--------|--------|
| Watch an ad | $0.25 (max 12/day = $3) |
| Complete a task | $0.25 – $1.00 |
| Refer a friend | $0.75 instant |
| Weekly spin | $0.10 – $2.00 |
| Monthly scratch card | $1.00 – $10.00 |
| Daily login streak | $0.05/day + milestones |
| Streak milestones (7/14/30 days) | $0.25 / $0.50 / $1.00 |

---

## 🔐 Withdrawal Requirements (Anti-Fraud Gate)
Only shown when user hits $40 balance. ALL must be completed:
1. ✅ Invite 5 friends
2. ✅ 30-day login streak (cumulative best)
3. ✅ Watch 100 ads total
4. ✅ Complete 5 tasks
5. ✅ Account verified by admin

---

## 🔌 Add Real Ads (Adsgram)
Replace the `watchAd()` simulation in `frontend/index.html`:
```javascript
// Replace the sleep(1600) section with:
const AdController = await window.Adsgram.init({ blockId: "YOUR_BLOCK_ID" });
await AdController.show();
// Then call the /api/earnings/watch-ad endpoint
```
Sign up at [adsgram.ai](https://adsgram.ai) to get your Block ID.

---

## 🛠️ Admin Panel
Manage withdrawals via API:

**List pending withdrawals:**
```
GET /api/withdrawals/admin/pending?admin_key=YOUR_ADMIN_KEY
```

**Approve a withdrawal:**
```
POST /api/withdrawals/admin/approve/:id
Body: { "admin_key": "...", "note": "Paid via PayPal" }
```

---

## 📊 API Reference
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/init` | POST | Register/login user, update streak |
| `/api/users/:id` | GET | Get user profile + transactions |
| `/api/users/leaderboard/top` | GET | Top 10 earners |
| `/api/earnings/watch-ad` | POST | Record ad watch (+$0.25) |
| `/api/earnings/spin` | POST | Weekly spin wheel |
| `/api/earnings/scratch` | POST | Monthly scratch card |
| `/api/tasks` | GET | List tasks (with completion status) |
| `/api/tasks/complete` | POST | Mark task complete + credit reward |
| `/api/withdrawals/request` | POST | Submit withdrawal request |
| `/api/withdrawals/history/:id` | GET | User withdrawal history |
