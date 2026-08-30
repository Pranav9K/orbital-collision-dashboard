# 🛡️ Orbital Shield — Space Debris Collision Risk Dashboard

**PS-04 | Smart India Hackathon — Space Technology**

An end-to-end, real-time space situational awareness (SSA) platform for tracking orbital objects, screening conjunction (close-approach) events, scoring collision risk using hybrid machine learning models, recommending evasive maneuvers, and visualizing orbital mechanics on an interactive 3D globe.

---

## 🔗 Project Links

- 📊 **PPT Link:** [https://tinyurl.com/team-ssd-ppt](https://tinyurl.com/team-ssd-ppt)
- 💻 **Project repository:** [https://tinyurl.com/team-ssd-project-repo](https://tinyurl.com/team-ssd-project-repo)
- 🌐 **Project Live Link:** [https://tinyurl.com/team-ssd-sih-live](https://tinyurl.com/team-ssd-sih-live)
- 🎥 **Project Demo Video (YouTube):** [https://tinyurl.com/team-ssd-yt-demo](https://tinyurl.com/team-ssd-yt-demo)

---

## 🌟 Key Features

### 1. 🛰️ Real-Time SGP4 Orbit Propagation
- Ingests two-line element (TLE) / General Perturbations (GP) ephemeris data from **CelesTrak**.
- Uses high-precision **SGP4** analytical propagation to model perturbations (Earth oblateness $J_2/J_3/J_4$, atmospheric drag, lunar/solar gravitational pull).
- Converts Earth-Centered Inertial (ECI TEME) state vectors into geodetic coordinates (Latitude, Longitude, Altitude, Velocity).

### 2. ⚡ High-Throughput Conjunction Screening Engine
- **Apogee-Perigee Pre-Filter:** Discards non-intersecting orbital pairs mathematically before propagation.
- **Vectorized Coarse Screening:** Evaluates distance matrices across 1,440 time steps (24h horizon at 60s intervals) via optimized NumPy vectorization.
- **Fine-Step Interpolation:** Performs sub-second fine screening (10s intervals) around candidate close-approach minimums to pinpoint exact Time of Closest Approach (TCA) and miss distance.

### 3. 🧠 Hybrid Collision Risk Assessment (Physics + ML)
- **NASA CARA-Aligned Risk Model:** Combines deterministic orbital mechanics heuristics with a trained **Random Forest** machine learning classifier.
- Feature parameters evaluated:
  - Miss distance ($d_{\min}$ in km)
  - Relative collision velocity ($v_{\text{rel}}$ in km/s)
  - Time remaining to TCA ($t_{\text{TCA}}$ in hours)
  - Radar Cross Section (RCS) size factor (Small, Medium, Large)
  - Object categorization (Payload, Debris, Rocket Body)
  - Relative approach angle ($\theta$ in degrees)
  - Orbital period similarity ratio

### 4. 🚨 Segregated Conjunction Hazard Streams
- **High-Risk Conjunction Events Panel:** Dedicated top-tier alert stream showing critical ($\ge 80$) and high-risk ($\ge 60$) collision events with live countdown timers, direct zoom controls, and velocity telemetry.
- **Standard Conjunction Events Table:** Filtered table displaying moderate ($35-59$) and low-risk ($< 35$) conjunctions with sorting by TCA, miss distance, and risk score.

### 5. 🌍 Interactive 3D Digital Globe Visualization
- Built with **Three.js** and **react-globe.gl** with custom shaders and night-sky atmospheric glow.
- **High-Visibility Animated Orbits:** Vibrant orbital paths for conjunction objects (Neon Cyan `#00d4ff` and Amber Gold `#fbbf24`) with animated particle flow.
- **Pulsating Hazard Rings:** Real-time ground-track ripple markers highlighting collision hazard zones at TCA.
- **De-Cluttered View:** Clean orbital rendering without point noise; individual satellite pins appear only on explicit operator selection.

### 6. 🚀 Evasive Maneuver Recommendation Engine
- Automatically computes required velocity impulse ($\Delta v$) for an active satellite to achieve safe miss distance separation ($> 5\text{ km}$).
- Calculates optimal burn direction (prograde/retrograde, radial, cross-track) and thruster burn lead time before TCA.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph DataIngestion ["1. Data Ingestion & Sync"]
        CT[CelesTrak GP/TLE API] -->|Periodic Sync| DB[(SQLite Database)]
        SEED[Seed Catalog Backup] -->|Fallback| DB
    end

    subgraph BackendCore ["2. Backend Compute Engine (Python / Flask)"]
        DB --> SGP4[SGP4 Batch Propagator]
        SGP4 --> FILTER[Apogee-Perigee Geometric Pre-filter]
        FILTER --> COARSE[Vectorized Coarse Screening (NumPy)]
        COARSE --> FINE[Fine Screening around TCA]
        FINE --> ML[Random Forest Risk Scorer + Physics Heuristics]
        ML --> CE[Conjunction Events DB]
        CE --> MANEUVER[Maneuver Recommendation Engine]
        SCHED[APScheduler Worker] -->|Triggers| SGP4
    end

    subgraph REST_API ["3. REST API Layer"]
        CE --> API_CONJ["/api/conjunctions & /api/conjunctions/alerts"]
        MANEUVER --> API_MANEUVER["/api/conjunctions/:id/maneuver"]
        SGP4 --> API_POS["/api/positions & /api/positions/:id"]
        DB --> API_SAT["/api/satellites & /api/satellites/stats"]
    end

    subgraph FrontendApp ["4. Client Dashboard (React 18 + Vite)"]
        API_CONJ & API_MANEUVER & API_POS & API_SAT --> STORE[Zustand State Store]
        STORE --> GLOBE[3D Globe Engine (react-globe.gl / Three.js)]
        STORE --> ALERTS[High-Risk Alerts Panel]
        STORE --> TABLE[Conjunction Events Table]
        STORE --> TIMELINE[Risk Timeline Chart (Recharts)]
        STORE --> DETAIL[Conjunction & Telemetry Modal]
    end
```

---

## 🚦 Risk Score Classification Matrix

| Level | Score Range | Color | Description | Action Required |
|---|---|---|---|---|
| **Critical** | `80 – 100` | 🔴 `#dc2626` | Imminent collision threat. Miss distance $< 1\text{ km}$, high kinetic energy. | Immediate operator action & maneuver burn execution |
| **High** | `60 – 79` | 🟠 `#ea580c` | Significant risk. Miss distance $1 - 5\text{ km}$, intersecting geometry. | Evasive maneuver strongly recommended before TCA |
| **Medium** | `35 – 59` | 🟡 `#fbbf24` | Elevated risk. Miss distance $5 - 15\text{ km}$. | Monitor closely; plan potential collision avoidance |
| **Low** | `0 – 34` | 🟢 `#fcd34d` | Nominal risk. Miss distance $> 15\text{ km}$. | Standard orbital tracking and monitoring |

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | `GET` | Service health status and timestamp |
| `/api/satellites` | `GET` | List tracked satellites (supports `search`, `type`, `group`, `page`, `per_page`) |
| `/api/satellites/<id>` | `GET` | Get detailed orbital elements for a specific NORAD ID |
| `/api/satellites/stats` | `GET` | Catalog statistics (total objects, type breakdown, group counts) |
| `/api/satellites/refresh` | `POST` | Force refresh orbital catalog from CelesTrak |
| `/api/positions` | `GET` | Real-time geodetic positions (lat, lon, alt, speed) for all satellites |
| `/api/positions/<id>` | `GET` | Propagated orbit path coordinate array for single satellite |
| `/api/conjunctions` | `GET` | All active conjunction events sorted by risk score |
| `/api/conjunctions/alerts` | `GET` | High-risk conjunction events only (`risk_score >= 60`) |
| `/api/conjunctions/timeline` | `GET` | Time-binned max collision risk over 24-hour horizon |
| `/api/conjunctions/screen` | `POST` | Trigger manual conjunction screening pass |
| `/api/conjunctions/<id>/maneuver` | `POST` | Compute optimal evasive thruster maneuver ($\Delta v$) |

---

## 🛠️ Technology Stack

- **Backend:** Python 3.11+, Flask, SQLAlchemy, SGP4, NumPy, scikit-learn, APScheduler
- **Frontend:** React 18, Vite, Three.js (`react-globe.gl`), Recharts, Zustand, Lucide React
- **Database:** SQLite / PostgreSQL compatible
- **Data Source:** CelesTrak REST API (Stations, Visual, Cosmos-1408 Debris Cloud)

---

## 🚀 Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/Pranav9K/orbital-collision-dashboard.git
cd orbital-collision-dashboard
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
python run.py
```
*The Flask backend will launch at `http://localhost:5000` and automatically initialize catalog data, train the ML risk model, and run conjunction screening.*

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
*The frontend dashboard will launch at `http://localhost:5173` with live hot-reloading and proxying to the backend API.*