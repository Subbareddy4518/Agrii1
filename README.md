# AgriConnect 2.0 (Enhanced)

A farmer-first direct marketplace that connects **Farmers** and **Industries** directly — eliminating middlemen. Farmers post crops for sale, industries post crop procurement requirements, and each side connects directly via native **Call** or **WhatsApp**.

AgriConnect 2.0 introduces **AI-Assisted 3-Step Crop Posting**, **APMC Mandi Price Guidance**, **Voice Speech-to-Text Recognition** in Telugu, Hindi & English, **SmartMatch Explainable AI Matching**, and an **Ask AgriConnect AI Advisor**.

---

## What's New in AgriConnect 2.0

### 1. Simple Three-Step Crop Posting
- **Step 1: What Are You Selling?**
  - Large, touch-friendly visual cards with recognizable icons/photos across Cereals, Vegetables, Spices, Cash Crops, Pulses, and Fruits.
  - Search by crop name (Telugu, Hindi, English).
  - Prominent **AI Microphone button** for voice-based crop details entry.
  - Automatic AI extraction of crop, variety, quantity, unit, price, and location.
  - Clear selected-crop confirmation with change option.
- **Step 2: Crop Details**
  - Quantity entry with standard units (`Kg`, `Quintal`, `Ton`, `Bags (50kg)`, `Boxes`) and quick chips (`+10`, `+50`, `+100`, `+500`).
  - Expected price with **Negotiable** option.
  - **Mandi Benchmark Price Guidance**: Shows verified regional market ranges (e.g. Paddy: ₹2,183 – ₹2,450/qtl) with a 1-tap "Use Recommended Price" button.
  - Crop variety suggestions tailored to the selected crop (e.g. Sona Masoori, Teja, Bunny).
  - Quality grade selection (`Grade A / Premium`, `Standard / Grade B`, `Organic`).
  - Location pre-filled from user profile and editable.
  - Harvest availability status or target date.
  - **"AI Write Description"** button: Automatically drafts a clean, professional listing description in the active language.
  - Crop photograph upload with preview.
- **Step 3: Review and Publish**
  - Live buyer preview card showing exactly how the listing looks to buyers.
  - Field-by-field checklist with instant jump-to-edit buttons.
  - Clear visual distinction between AI suggestions and farmer-verified data.
  - Prominent 48px+ touch target **Publish Crop** button.
  - Success celebration screen with direct links to view in marketplace, check matching buyers, or post another crop.
  - Full manual fallback that works 100% reliably even if microphone or speech recognition is unavailable.

### 2. Explainable SmartMatch AI
- Match score computed transparently based on:
  - Exact crop / category match
  - Geographic district proximity
  - Quantity compatibility
  - Expected price vs. buyer budget alignment
- Transparent match reason pills (e.g. `✓ Direct crop match for Paddy`, `📍 Same district: Nalgonda`, `💰 Buyer offer aligns with asking price`).
- Dedicated SmartMatch view (`/matches`) and match count badge.
- 1-tap Call and WhatsApp handoff directly to counterparts.

### 3. Ask AgriConnect AI Advisor
- Dedicated conversational assistant (`/api/ai/advisor`) available on the Home screen.
- Farmers and buyers can ask questions about mandi prices, selling tips, buyer safety, and platform guidance in Telugu, Hindi, or English.
- Voice speech-to-text input + Web Speech text-to-speech read aloud.

### 4. Farmer-First UI/UX Overhaul
- **Brand Colors**:
  - Forest Green: `#1E5E3A` (primary agricultural brand)
  - Harvest Gold: `#D9822B` (accent, price badges, calls-to-action)
  - Off-White: `#F9FAF7` (clean, high-contrast surface)
- **Home Screen 4 Large Recognizable Action Cards**:
  - 🌾 **Sell My Crops** (Large primary action card)
  - 🔍 **Find Buyers / Requirements**
  - 🤝 **Check My Matches** (with live match count badge)
  - 💬 **Ask AgriConnect AI**
- Responsive layouts tested across 360px, 390px, 768px, 1024px, and 1440px with touch targets of 44–48px or larger.
- Instant 1-tap language switch pill (`🌐 EN`, `🌐 తె`, `🌐 हि`) in the top navigation bar.

### 5. Trust, Security & Moderation
- Verified Farmer and Verified Industry trust badges.
- Content moderation reporting flow (`POST /api/reports/post/{id}`) with reason selector.
- Trust score indicators and verified mobile signals.

---

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons, React Router v6, i18next (English, Telugu, Hindi), Web Speech API.
- **Backend:** FastAPI, SQLAlchemy, Pydantic v2, Python-JOSE (JWT), Passlib/Bcrypt.
- **Database:** SQLite (file-based `agriconnect.db`, zero setup). Compatible with PostgreSQL via `DATABASE_URL`.
- **Storage:** Static image uploads served from `backend/uploads/`.

---

## Project Structure

```
agriconnect/
├── backend/
│   ├── main.py                 # FastAPI app, static mounts, route registration
│   ├── database.py             # SQLAlchemy engine, additive migrations
│   ├── models.py               # User, Post, Like, Notification, Report models
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── auth.py                 # JWT token generation & auth dependencies
│   ├── routers/
│   │   ├── auth.py             # /api/auth/register, /api/auth/login
│   │   ├── posts.py            # Feed, search, CRUD, likes, image upload
│   │   ├── ai_services.py      # /api/ai/crops, /price-guidance, /crop-assist, /advisor
│   │   ├── matching.py         # /api/matching/my-matches, /explain/{id}
│   │   ├── reports.py          # /api/reports/post/{id}
│   │   ├── notifications.py    # In-app notifications
│   │   ├── users.py            # User profile endpoints
│   │   └── admin.py            # Admin moderation dashboard
│   ├── tests/
│   │   ├── test_backend.py     # 13 automated unit & integration tests
│   │   └── verify_server.py    # Health & route verification script
│   ├── uploads/                # User uploaded images
│   ├── requirements.txt        # Backend dependencies
│   └── .env.example            # Backend configuration template
│
├── frontend/
│   ├── src/
│   │   ├── pages/              # CreatePost, Home, MatchesPage, SearchPage, Profile...
│   │   ├── components/         # TopBar, BottomNav, PostCard, AiAdvisorModal, ReportModal...
│   │   ├── utils/              # voiceInput.js, i18nHelpers.js, onboarding.js, time.js
│   │   ├── locales/            # en, te, hi JSON translations
│   │   ├── services/           # api.js axios endpoints
│   │   └── context/            # AuthContext
│   ├── tailwind.config.js      # Forest green, harvest gold, off-white tokens
│   ├── vite.config.js          # Vite dev proxy configuration
│   ├── package.json
│   └── .env.example            # Frontend environment template
│
├── .env.example                # Root environment template
└── README.md
```

---

## Running Locally

### 1. Backend

```bash
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run automated tests
python -m unittest tests/test_backend.py

# Start FastAPI server
uvicorn main:app --reload --port 8000
```

The API will be live at `http://127.0.0.1:8000`.
Interactive Swagger API documentation: `http://127.0.0.1:8000/docs`.

### 2. Frontend

```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server
npm run dev
```

Open `http://127.0.0.1:5173`.
Vite automatically proxies `/api` and `/uploads` to port 8000.

### 3. Production Build

```bash
cd frontend
npm run build
```

Build artifacts will be generated in `frontend/dist/`.

---

## API Reference Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register farmer or industry account |
| POST | `/api/auth/login` | Login, returns JWT token + user |
| GET | `/api/users/me` | Current user profile |
| PUT | `/api/users/me` | Update user profile |
| GET | `/api/posts/feed` | Role-based feed (opposite role posts) |
| GET | `/api/posts/search` | Search by crop, category, location, query |
| GET | `/api/posts/mine` | User's own postings |
| POST | `/api/posts` | Create crop listing or industry requirement |
| PUT | `/api/posts/{id}` | Update own post |
| DELETE | `/api/posts/{id}` | Delete own post |
| POST | `/api/posts/{id}/like` | Toggle interested reaction |
| POST | `/api/posts/upload-image` | Upload listing or profile image |
| GET | `/api/ai/crops` | Predefined crops catalog with benchmarks |
| GET | `/api/ai/price-guidance` | APMC Mandi benchmark price guidance |
| POST | `/api/ai/crop-assist` | AI NLP extraction from speech or text |
| POST | `/api/ai/advisor` | Multilingual AI advisory assistant |
| GET | `/api/matching/my-matches` | Explainable SmartMatch listings |
| GET | `/api/matching/explain/{id}` | Detailed explanation of a match |
| POST | `/api/reports/post/{id}` | Report post for moderation |
| GET | `/api/notifications` | Current user notifications |

---

## Testing & Quality Assurance

- **Backend Automated Tests:** 13/13 passing in ~2 seconds (`backend/tests/test_backend.py`).
- **Frontend Production Build:** Compiles with 0 errors via Vite (`npm run build`).
- **Browser Compatibility:** Tested with Chrome, Edge, Android Mobile Chrome (Web Speech API).
