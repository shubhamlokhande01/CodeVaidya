import csv
import os
import random
import time
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from groq import Groq

# ─────────────────────────────────────────────
# ENV & GROQ CLIENT
# ─────────────────────────────────────────────
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY is missing or empty. "
        "Add it to your .env file as: GROQ_API_KEY=gsk_..."
    )

client = Groq(api_key=GROQ_API_KEY)

# ─────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────
SYSTEM_PROMPT = """You are Aarogya AI, a health assistant for Maharashtra's disease outbreak monitoring system.

You have access to REAL district-level health data from Maharashtra. Use it to give localised, data-driven answers.

Your role:
- Answer questions about diseases, symptoms, and prevention clearly and concisely
- Reference the real district data when relevant (e.g. high-risk districts, fever case counts)
- Tailor safety advice based on local risk levels from the data
- Encourage consulting doctors for serious conditions

Safety rules:
- Always include this disclaimer exactly once per response: "This is not a medical diagnosis"
- Never prescribe dosages or dangerous treatments
- If symptoms sound severe, urgent, or worsening — advise immediate medical care
- Do not cause panic; be calm and factual

Response style:
- Short, clear, actionable
- Use bullet points when listing precautions or symptoms
- When referencing data, mention district names and risk levels naturally
"""

# ─────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────
# backend_api.py lives in: <project>/backend/
# frontend files live in:  <project>/frontend/
BACKEND_DIR  = Path(__file__).parent          # .../backend
FRONTEND_DIR = BACKEND_DIR.parent / "frontend" # .../frontend

# ─────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────
app = FastAPI(title="Aarogya Health Chat API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# SERVE FRONTEND AS STATIC FILES
# Accessible at: http://localhost:8000
# ─────────────────────────────────────────────
if FRONTEND_DIR.exists():
    # Serve js/, css files etc. under their paths
    app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    def serve_index():
        """Serve frontend/index.html at root URL."""
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/style.css", include_in_schema=False)
    def serve_css():
        return FileResponse(str(FRONTEND_DIR / "style.css"), media_type="text/css")

# ─────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    outbreak_context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    response: str


# ─────────────────────────────────────────────
# DATASET & SIMULATION STATE
# ─────────────────────────────────────────────
DATASET_PATH = BACKEND_DIR / "health_data.csv"
DATA_LOCK = Lock()
SIM_STATE: Dict[str, Any] = {
    "locations": {},
    "last_simulated_at": 0.0,
    "next_interval_seconds": random.randint(5, 10),
}

KNOWN_COORDS: Dict[str, Tuple[float, float]] = {
    "Pune": (18.5204, 73.8567),
    "Mumbai": (19.0760, 72.8777),
    "Nagpur": (21.1458, 79.0882),
    "Nashik": (19.9975, 73.7898),
    "Aurangabad": (19.8762, 75.3433),
    "Solapur": (17.6599, 75.9064),
    "Kolhapur": (16.7050, 74.2433),
    "Satara": (17.6805, 74.0183),
    "Sangli": (16.8524, 74.5815),
    "Amravati": (20.9374, 77.7796),
    "Akola": (20.7002, 77.0082),
    "Yavatmal": (20.3899, 78.1307),
    "Wardha": (20.7453, 78.6022),
    "Bhandara": (21.1682, 79.6485),
    "Gondia": (21.4602, 80.1961),
    "Chandrapur": (19.9615, 79.2961),
    "Gadchiroli": (20.1849, 80.0037),
    "Latur": (18.4088, 76.5604),
    "Osmanabad": (18.1810, 76.0419),
    "Beed": (18.9891, 75.7601),
    "Jalna": (19.8347, 75.8816),
    "Parbhani": (19.2644, 76.7708),
    "Hingoli": (19.7176, 77.1490),
    "Nanded": (19.1383, 77.3210),
    "Dhule": (20.9042, 74.7749),
    "Nandurbar": (21.3667, 74.2400),
    "Jalgaon": (21.0077, 75.5626),
    "Ahmednagar": (19.0952, 74.7496),
    "Thane": (19.2183, 72.9781),
    "Palghar": (19.6967, 72.7699),
    "Raigad": (18.5158, 73.1822),
    "Ratnagiri": (16.9902, 73.3120),
    "Sindhudurg": (16.3492, 73.5594),
}

# ─────────────────────────────────────────────
# CSV DATA LOADING — aggregated per district
# ─────────────────────────────────────────────
def load_csv_summary() -> Dict[str, Dict[str, Any]]:
    """
    Reads health_data.csv and returns one aggregated record per district.
    Uses the last row's risk_level as the most recent value.
    """
    if not DATASET_PATH.exists():
        return {}

    raw: Dict[str, List[Dict]] = {}
    with DATASET_PATH.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            district = (row.get("district") or "").strip()
            if not district:
                continue
            raw.setdefault(district, []).append(row)

    summary: Dict[str, Dict[str, Any]] = {}
    for district, rows in raw.items():
        def avg(field: str) -> float:
            vals = [float(r[field]) for r in rows if r.get(field) not in (None, "")]
            return round(sum(vals) / len(vals), 1) if vals else 0.0

        latest_risk = (rows[-1].get("risk_level") or "Unknown").strip()
        past_outbreak = any(str(r.get("past_outbreak", "0")).strip() == "1" for r in rows)

        summary[district] = {
            "risk_level": latest_risk,
            "avg_fever_cases": avg("fever_cases"),
            "avg_malnutrition_rate": avg("malnutrition_rate"),
            "avg_water_quality_index": avg("water_quality_index"),
            "avg_rainfall_mm": avg("rainfall_mm"),
            "avg_temperature": avg("temperature"),
            "past_outbreak": past_outbreak,
        }

    return summary


# Cache so we don't re-read CSV on every chat request
_CSV_SUMMARY_CACHE: Optional[Dict[str, Dict[str, Any]]] = None

def get_csv_summary() -> Dict[str, Dict[str, Any]]:
    global _CSV_SUMMARY_CACHE
    if _CSV_SUMMARY_CACHE is None:
        _CSV_SUMMARY_CACHE = load_csv_summary()
    return _CSV_SUMMARY_CACHE


def build_data_context_block() -> str:
    """
    Builds a compact text block summarising all district data
    to inject into every chat prompt so Groq can reference real data.
    """
    summary = get_csv_summary()
    if not summary:
        return ""

    high = sorted([d for d, v in summary.items() if v["risk_level"].lower() == "high"])
    medium = sorted([d for d, v in summary.items() if v["risk_level"].lower() == "medium"])
    low = sorted([d for d, v in summary.items() if v["risk_level"].lower() == "low"])

    lines = [
        "=== MAHARASHTRA DISTRICT HEALTH DATA (real project dataset) ===",
        f"High risk districts ({len(high)}): {', '.join(high)}",
        f"Medium risk districts ({len(medium)}): {', '.join(medium)}",
        f"Low risk districts ({len(low)}): {', '.join(low)}",
        "",
        "Per-district details:",
    ]

    for district, v in sorted(summary.items()):
        outbreak_flag = "Yes" if v["past_outbreak"] else "No"
        lines.append(
            f"  {district}: Risk={v['risk_level']}, "
            f"Avg Fever Cases={v['avg_fever_cases']}, "
            f"Malnutrition Rate={v['avg_malnutrition_rate']}%, "
            f"Water Quality Index={v['avg_water_quality_index']}, "
            f"Avg Rainfall={v['avg_rainfall_mm']}mm, "
            f"Avg Temp={v['avg_temperature']}°C, "
            f"Past Outbreak={outbreak_flag}"
        )

    lines.append("=== END OF DISTRICT DATA ===")
    return "\n".join(lines)


# ─────────────────────────────────────────────
# PROMPT BUILDER
# ─────────────────────────────────────────────
def build_user_prompt(message: str, outbreak_context: Optional[Dict[str, Any]]) -> str:
    data_block = build_data_context_block()

    context_block = ""
    if outbreak_context:
        context_block = f"\nLive outbreak context (from frontend): {outbreak_context}\n"

    instructions = """
Instructions:
- Use the district data above to give localised answers when relevant.
- If the user asks about a specific district, reference its actual data.
- If the user asks a general health question, briefly mention the highest-risk districts.
- Always be concise and practical.
"""
    return f"{data_block}\n{context_block}\n{instructions}\nUser message: {message}"


# ─────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────
def city_coordinates(city: str) -> Tuple[float, float]:
    if city in KNOWN_COORDS:
        return KNOWN_COORDS[city]
    seed = abs(hash(city)) % 10_000
    lat = 19.0 + ((seed % 1200) / 1000.0) - 0.6
    lng = 76.0 + (((seed // 1200) % 1200) / 1000.0) - 0.6
    return round(lat, 4), round(lng, 4)


def trend_and_risk(last_7_days: List[int]) -> Tuple[str, str, float]:
    if not last_7_days:
        return "stable", "Low", 0.0
    start = max(last_7_days[0], 1)
    end = last_7_days[-1]
    growth_pct = ((end - start) / start) * 100.0
    if growth_pct > 20:
        return "increasing", "High", growth_pct
    if growth_pct < -20:
        return "decreasing", "Low", growth_pct
    if end > start:
        return "increasing", "Medium", growth_pct
    if end < start:
        return "decreasing", "Medium", growth_pct
    return "stable", "Medium", growth_pct


def load_dataset_state() -> None:
    if not DATASET_PATH.exists():
        raise RuntimeError(f"Dataset not found: {DATASET_PATH}")

    grouped: Dict[str, List[int]] = {}
    with DATASET_PATH.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            city = (row.get("district") or "").strip()
            fever_cases = int(float(row.get("fever_cases") or 0))
            if not city:
                continue
            grouped.setdefault(city, []).append(fever_cases)

    locations: Dict[str, Any] = {}
    for city, series in grouped.items():
        last_7 = (
            series[-7:]
            if len(series) >= 7
            else ([series[0]] * (7 - len(series)) + series)
        )
        trend, risk, growth_pct = trend_and_risk(last_7)
        active_cases = int(last_7[-1])
        total_cases = int(sum(series))
        lat, lng = city_coordinates(city)

        locations[city] = {
            "location_name": city,
            "latitude": lat,
            "longitude": lng,
            "series": series[:],
            "last_7_days": last_7[:],
            "total_cases": total_cases,
            "active_cases": active_cases,
            "recovered": max(total_cases - active_cases, 0),
            "trend": trend,
            "risk_level": risk,
            "growth_rate": round(growth_pct, 2),
        }

    SIM_STATE["locations"] = locations
    SIM_STATE["last_simulated_at"] = time.time()
    SIM_STATE["next_interval_seconds"] = random.randint(5, 10)


def maybe_simulate_update() -> None:
    now = time.time()
    elapsed = now - float(SIM_STATE["last_simulated_at"])
    if elapsed < int(SIM_STATE["next_interval_seconds"]):
        return

    for city, item in SIM_STATE["locations"].items():
        latest = max(int(item["last_7_days"][-1]), 1)
        bias = (
            1.02 if item["risk_level"] == "High"
            else 1.0 if item["risk_level"] == "Medium"
            else 0.98
        )
        noise = random.uniform(0.94, 1.06)
        new_active = int(max(1, round(latest * bias * noise)))

        item["series"].append(new_active)
        item["last_7_days"] = item["series"][-7:]
        item["active_cases"] = new_active
        item["total_cases"] += new_active
        item["recovered"] = max(item["total_cases"] - item["active_cases"], 0)
        trend, risk, growth_pct = trend_and_risk(item["last_7_days"])
        item["trend"] = trend
        item["risk_level"] = risk
        item["growth_rate"] = round(growth_pct, 2)

    SIM_STATE["last_simulated_at"] = now
    SIM_STATE["next_interval_seconds"] = random.randint(5, 10)


def get_locations_snapshot() -> List[Dict[str, Any]]:
    with DATA_LOCK:
        if not SIM_STATE["locations"]:
            load_dataset_state()
        maybe_simulate_update()
        return [dict(v) for v in SIM_STATE["locations"].values()]


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────
@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/hotspots")
def hotspots(sort_by: str = "active_cases", limit: int = 10) -> Dict[str, Any]:
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 200")

    allowed_sort = {"active_cases", "growth_rate"}
    if sort_by not in allowed_sort:
        raise HTTPException(
            status_code=400,
            detail="sort_by must be one of: active_cases, growth_rate",
        )

    locations = get_locations_snapshot()
    sorted_rows = sorted(
        locations, key=lambda x: float(x.get(sort_by, 0.0)), reverse=True
    )

    return {
        "updated_at": int(time.time()),
        "sort_by": sort_by,
        "hotspots": [
            {
                "location_name": row["location_name"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "total_cases": row["total_cases"],
                "active_cases": row["active_cases"],
                "risk_level": row["risk_level"],
                "trend": row["trend"],
                "growth_rate": row["growth_rate"],
            }
            for row in sorted_rows[:limit]
        ],
    }


@app.get("/search")
def search_city(city: str) -> Dict[str, Any]:
    query = city.strip().lower()
    if not query:
        raise HTTPException(status_code=400, detail="city query is required")

    locations = get_locations_snapshot()
    exact = [r for r in locations if r["location_name"].lower() == query]
    partial = [r for r in locations if query in r["location_name"].lower()]
    matches = exact or partial

    if not matches:
        raise HTTPException(status_code=404, detail=f"City '{city}' not found")

    row = matches[0]
    csv_data = get_csv_summary().get(row["location_name"], {})

    return {
        "location_name": row["location_name"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "total_cases": row["total_cases"],
        "active_cases": row["active_cases"],
        "recovered": row["recovered"],
        "last_7_days_data": row["last_7_days"],
        "trend": row["trend"],
        "predicted_risk_level": row["risk_level"],
        "growth_rate": row["growth_rate"],
        "avg_malnutrition_rate": csv_data.get("avg_malnutrition_rate"),
        "avg_water_quality_index": csv_data.get("avg_water_quality_index"),
        "avg_rainfall_mm": csv_data.get("avg_rainfall_mm"),
        "past_outbreak": csv_data.get("past_outbreak"),
    }


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    try:
        prompt = build_user_prompt(payload.message, payload.outbreak_context)

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=600,
            temperature=0.7,
        )

        text = (completion.choices[0].message.content or "").strip()

        if not text:
            raise ValueError("Empty response from Groq API")

        if "This is not a medical diagnosis" not in text:
            text += "\n\nThis is not a medical diagnosis"

        return ChatResponse(response=text)

    except Exception as e:
        print(f"[CHAT ERROR] {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Chat service error: {type(e).__name__}: {e}",
        )


@app.get("/city-analytics")
async def city_analytics(city: str) -> List[Dict[str, Any]]:
    """Generate top 5 diseases for a city using AI."""
    city_name = city.strip()
    if not city_name:
        raise HTTPException(status_code=400, detail="city name is required")

    prompt = f"""You are an AI public health expert.
A user has searched for the city: {city_name} (India).

Based on realistic conditions such as:
- weather patterns
- rainfall
- water quality
- sanitation
- population density
- seasonal trends in India

Generate a list of the TOP 5 most common diseases likely affecting this city.

Return ONLY valid JSON in the following format:

[
  {{
    "name": "Disease name",
    "cases": number,
    "severity": "Low" | "Medium" | "High",
    "trend": "Increasing" | "Stable" | "Decreasing",
    "prevention": ["tip 1", "tip 2", "tip 3"]
  }}
]

Rules:
- Do NOT include any explanation or text outside JSON
- Ensure all 5 diseases are unique
- Use realistic case numbers
- Prioritize diseases common in Indian cities (e.g., Dengue, Malaria, Typhoid, Flu, etc.)
- Severity should reflect risk level
- Trend should reflect current realistic situation
- **Prevention**: Provide EXACTLY 3 short, highly actionable prevention tips specific to the disease. Do not provide more or less.
- Total JSON should contain exactly 5 unique disease objects.

City: {city_name}"""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a specialized JSON generator for public health data. No conversation, just JSON."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=1000,
            temperature=0.6,
            response_format={"type": "json_object"} if "llama-3.1" in "llama-3.3-70b-versatile" else None
        )
        
        raw_content = completion.choices[0].message.content or "[]"
        import json
        if "```json" in raw_content:
            raw_content = raw_content.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_content:
            raw_content = raw_content.split("```")[1].split("```")[0].strip()
            
        data = json.loads(raw_content)
        if isinstance(data, dict):
            for key in data:
                if isinstance(data[key], list):
                    return data[key][:5]
        
        if isinstance(data, list):
            return data[:5]
            
        return []

    except Exception as e:
        print(f"[ANALYTICS ERROR] {e}")
        return [
            {"name": "Dengue", "cases": 120, "severity": "High", "trend": "Increasing", "prevention": ["Use mosquito nets", "Avoid stagnant water", "Wear protective clothing"]},
            {"name": "Malaria", "cases": 85, "severity": "Medium", "trend": "Stable", "prevention": ["Wear long sleeves", "Use mosquito repellent", "Spray indoor insecticides"]},
            {"name": "Typhoid", "cases": 64, "severity": "Medium", "trend": "Decreasing", "prevention": ["Drink boiled water", "Wash hands regularly", "Avoid street food"]},
            {"name": "Flu", "cases": 310, "severity": "Low", "trend": "Stable", "prevention": ["Wear masks in crowds", "Stay hydrated", "Get annual vaccination"]},
            {"name": "Gastroenteritis", "cases": 145, "severity": "High", "trend": "Increasing", "prevention": ["Eat freshly cooked food", "Maintain kitchen hygiene", "Consume safe drinking water"]}
        ]


# ─────────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("  Aarogya AI — Backend + Frontend Server")
    print("  Open: http://localhost:8000")
    print("="*50 + "\n")
    uvicorn.run("backend_api:app", host="0.0.0.0", port=8000, reload=True)