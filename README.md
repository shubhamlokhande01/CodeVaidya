# Aarogya AI — Project Structure

## Folder Layout

```
d:\Vaidya11\
├── backend/                  ← Python FastAPI backend
│   ├── backend_api.py        ← Main API (chat, hotspots, search, health)
│   ├── health_data.csv       ← Maharashtra district health dataset
│   ├── model.pkl             ← Trained ML model
│   ├── encoder.pkl           ← Label encoder
│   ├── train_model.py        ← Model training script
│   ├── requirements.txt      ← Python dependencies
│   └── .env                  ← GROQ_API_KEY (keep secret)
│
├── frontend/                 ← Static HTML/CSS/JS frontend
│   ├── index.html            ← Main dashboard page
│   ├── style.css             ← All styles
│   └── js/                   ← Split JavaScript modules
│       ├── api.js            ← Backend fetch helpers (URLs + API calls)
│       ├── map.js            ← Leaflet map + hotspot markers
│       ├── charts.js         ← Plotly + Chart.js rendering
│       ├── chat.js           ← Chat widget + offline fallback
│       └── dashboard.js      ← Entry point: wires all modules
│
├── venv/                     ← Python virtual environment
├── start.ps1                 ← Easy startup script
└── README.md                 ← This file
```

## How to Run

### 1. Start the Backend
```powershell
# Option A — Use the startup script
.\start.ps1

# Option B — Manual (from backend folder)
cd backend
python -m uvicorn backend_api:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Open the Frontend
Open `frontend/index.html` directly in your browser:
```
d:\Vaidya11\frontend\index.html
```
Or use VS Code Live Server pointing to `frontend/`.

## Backend API Endpoints

| Method | Endpoint    | Description                          |
|--------|-------------|--------------------------------------|
| GET    | `/health`   | Health check                         |
| GET    | `/hotspots` | Top districts by active cases        |
| GET    | `/search`   | Search city/district data            |
| POST   | `/chat`     | AI health assistant (Groq/LLaMA)     |

## Frontend JS Modules

| File            | Responsibility                            |
|-----------------|-------------------------------------------|
| `js/api.js`     | All `fetch()` calls + API URL constants   |
| `js/map.js`     | Leaflet map init + marker rendering       |
| `js/charts.js`  | Plotly + Chart.js chart functions         |
| `js/chat.js`    | Chat widget + offline fallback logic      |
| `js/dashboard.js` | Entry point: DOMContentLoaded wiring   |
