# AgriConnect

A social marketplace that connects **Farmers** and **Industries** directly —
no middlemen. Farmers post crops, industries post requirements, and each side
only ever sees posts from the other. Everyone connects instantly through
**Call** or **WhatsApp**. There is no in-app chat by design.

Built for first-time smartphone users: a single scrolling feed (Instagram/
Facebook Marketplace style), large buttons, minimal steps, and no dashboards.

---

## Tech Stack

- **Frontend:** React + Vite, Tailwind CSS, React Router, Axios
- **Backend:** FastAPI, SQLAlchemy, JWT auth (python-jose + passlib/bcrypt)
- **Database:** SQLite (file-based, zero setup). Swap the connection string
  in `backend/database.py` for a `postgresql://` URI to move to Postgres —
  nothing else needs to change.
- **Storage:** Uploaded images are saved to `backend/uploads/` and served at
  `/uploads/<filename>`.

---

## Project Structure

```
agriconnect/
├── backend/
│   ├── main.py            # FastAPI app, CORS, static file mount
│   ├── database.py        # SQLAlchemy engine/session
│   ├── models.py          # User, Post, Like, Notification tables
│   ├── schemas.py         # Pydantic request/response models
│   ├── auth.py             # JWT + password hashing + current-user dependency
│   ├── routers/
│   │   ├── auth.py         # /api/auth/register, /api/auth/login
│   │   ├── posts.py        # feed, search, create/update/delete, like, upload
│   │   ├── notifications.py
│   │   └── users.py        # profile get/update
│   ├── uploads/            # uploaded images land here
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── pages/           # Login, Register, Home, CreatePost,
    │   │                    # Notifications, Profile, SearchPage
    │   ├── components/      # BottomNav, TopBar, PostCard, ImagePicker,
    │   │                    # EmptyState, PostCardSkeleton, Layout,
    │   │                    # ProtectedRoute
    │   ├── context/         # AuthContext (JWT + current user)
    │   ├── services/        # api.js (axios instance + endpoint calls)
    │   └── utils/            # time.js (relative timestamps)
    ├── tailwind.config.js   # forest-green / harvest-gold theme tokens
    └── vite.config.js       # dev proxy to the FastAPI backend
```

---

## Running Locally

### 1. Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API is now at `http://127.0.0.1:8000`. Interactive docs at
`http://127.0.0.1:8000/docs`. A `agriconnect.db` SQLite file is created
automatically on first run — no migrations needed.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The Vite dev server proxies `/api` and
`/uploads` to the backend on port 8000 (see `vite.config.js`), so no
`.env` / CORS setup is needed in development.

### 3. Try it out

1. Register two accounts — one as a **Farmer**, one as an **Industry** (use
   any two 10-digit mobile numbers).
2. Log in as the Farmer and create a crop post.
3. Log in as the Industry (different browser / incognito tab) — the crop
   post appears in their Home feed. Like it, or hit Call/WhatsApp.
4. Log back in as the Farmer — a notification confirms the industry's
   interest.

---

## Core Design Decisions

- **One feed, filtered by role.** Farmers only ever see Industry posts and
  vice versa — enforced server-side in `GET /api/posts/feed`, not just in
  the UI.
- **No in-app chat.** Every post surfaces Call and WhatsApp buttons that
  hand off to the phone's native dialer / WhatsApp — communication happens
  directly between the two parties, exactly as the brief specifies.
- **Voice input placeholder.** The mic icon on the post form is wired up
  and shows a "coming soon" toast; hook it to a speech-to-text service
  later to auto-fill the description field.
- **Unified `posts` table.** Farmer crop posts and Industry requirement
  posts share one table (`role` column differentiates them), which keeps
  the feed query a single `WHERE role = <opposite role>` — simple to read
  and cheap to scale.

---

## API Reference

| Method | Endpoint                          | Description                          |
|--------|------------------------------------|---------------------------------------|
| POST   | `/api/auth/register`               | Create a Farmer or Industry account  |
| POST   | `/api/auth/login`                  | Log in, returns JWT + user           |
| GET    | `/api/users/me`                    | Current user profile                 |
| PUT    | `/api/users/me`                    | Update profile                       |
| GET    | `/api/posts/feed`                  | Paginated feed (opposite role only)  |
| GET    | `/api/posts/search`                | Search by crop / location / name     |
| GET    | `/api/posts/mine`                  | Current user's own posts             |
| POST   | `/api/posts`                       | Create a post                        |
| PUT    | `/api/posts/{id}`                  | Update own post                      |
| DELETE | `/api/posts/{id}`                  | Delete own post                      |
| POST   | `/api/posts/{id}/like`             | Toggle "interested"                  |
| POST   | `/api/posts/upload-image`          | Upload an image, returns its URL     |
| GET    | `/api/notifications`               | Current user's notifications         |
| POST   | `/api/notifications/{id}/read`     | Mark one as read                     |
| POST   | `/api/notifications/read-all`      | Mark all as read                     |

---

## Production Notes

- Move `SECRET_KEY` in `backend/auth.py` into an environment variable.
- Point `SQLALCHEMY_DATABASE_URL` in `backend/database.py` at Postgres.
- Swap local `uploads/` storage for S3 / Cloud Storage and serve via CDN.
- Restrict CORS `allow_origins` in `backend/main.py` to your real frontend
  domain instead of `*`.
- Run `npm run build` in `frontend/` and serve the `dist/` folder from a
  static host or behind the same reverse proxy as the API.
