# PS-04 — Space Debris Tracking & Satellite Collision Risk Prediction Dashboard

Full-stack web dashboard: **Python/Flask backend** (data ingestion, SGP4 propagation, conjunction screening, ML risk scoring) + **React/Three.js frontend** (3D globe, real-time alerts, premium dark-mode UI).

---

## User Review Required

> [!IMPORTANT]
> **Full-stack architecture — Flask API + React SPA**
> The backend handles all heavy computation (propagation, conjunction screening, risk ML). The frontend is a pure consumer of the REST API — lightweight, fast, and visually stunning. Communication via JSON REST endpoints with CORS.

> [!WARNING]
> **CelesTrak rate limits** — CelesTrak asks for ≤4 automated requests/day. The backend will fetch on startup + every 6 hours via APScheduler, caching everything in SQLite. The frontend never touches CelesTrak directly.

> [!IMPORTANT]
> **Database — SQLite** for simplicity. Zero config, single file, ships with Python. More than sufficient for a hackathon demo with ~2000–5000 tracked objects. Can swap to PostgreSQL later if needed.

## Open Questions

1. **Default object groups** — I plan to load: `STATIONS` (ISS etc.), `ACTIVE` (subset), and `1982-092` (Cosmos 1408 debris cloud — real, dramatic debris field). Add more?
2. **Prediction horizon** — Default 24h forward propagation, 60-second time steps. Adjustable via UI slider (6h/12h/24h/48h).
3. **ML model scope** — I'll train a lightweight Random Forest on conjunction features (miss distance, relative velocity, object size, time-to-TCA) to produce a risk probability. If you want something fancier (LSTM time-series, etc.), flag it now.

---

## Project Structure

```
smart-india-hackathon/
├── backend/                    # Python/Flask API
│   ├── app/
│   │   ├── __init__.py         # Flask app factory
│   │   ├── config.py           # Configuration
│   │   ├── models.py           # SQLAlchemy models
│   │   ├── services/
│   │   │   ├── celestrak.py    # TLE fetching & caching
│   │   │   ├── propagator.py   # SGP4 propagation engine
│   │   │   ├── conjunction.py  # Conjunction screening
│   │   │   └── risk_scorer.py  # ML risk scoring
│   │   ├── routes/
│   │   │   ├── satellites.py   # /api/satellites endpoints
│   │   │   ├── conjunctions.py # /api/conjunctions endpoints
│   │   │   └── positions.py    # /api/positions endpoints
│   │   └── workers/
│   │       └── scheduler.py    # APScheduler background jobs
│   ├── requirements.txt
│   ├── run.py                  # Entry point
│   └── instance/
│       └── orbital.db          # SQLite database (auto-created)
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css           # Design system
│   │   ├── api/                # API client
│   │   ├── store/              # Zustand state
│   │   ├── components/
│   │   │   ├── Globe/          # 3D Earth + orbits
│   │   │   ├── Dashboard/      # Stats, tables, charts
│   │   │   ├── Sidebar/        # Object list & details
│   │   │   └── Controls/       # Time scrubber, filters
│   │   └── types/              # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

---

## Proposed Changes

### Component 1 — Flask Backend Core

#### [NEW] `backend/requirements.txt`
```
flask
flask-cors
flask-sqlalchemy
sgp4
numpy
scipy
scikit-learn
apscheduler
requests
python-dateutil
```

#### [NEW] `backend/app/__init__.py`
- Flask app factory pattern
- Register blueprints (satellites, conjunctions, positions)
- Initialize SQLAlchemy, CORS, APScheduler
- Kick off initial TLE fetch on first launch

#### [NEW] `backend/app/config.py`
- `SQLALCHEMY_DATABASE_URI` → SQLite in `instance/`
- `CELESTRAK_BASE_URL`, `CELESTRAK_GROUPS` list
- `CONJUNCTION_THRESHOLD_KM` (default: 25)
- `PROPAGATION_HORIZON_HOURS` (default: 24)
- `PROPAGATION_STEP_SECONDS` (default: 60)
- `RISK_HIGH_THRESHOLD` (default: 70)

---

### Component 2 — Database Models

#### [NEW] `backend/app/models.py`
- **`Satellite`** — NORAD catalog number, name, international designator, object type (payload/debris/rocket body), TLE line 1 & 2, epoch, orbital params (inclination, eccentricity, period, apogee, perigee), last updated timestamp
- **`ConjunctionEvent`** — object_1_id, object_2_id, TCA (time of closest approach), miss_distance_km, relative_velocity_km_s, risk_score (0–100), risk_probability (0.0–1.0 from ML), status (active/expired/mitigated), created_at
- **`PropagationCache`** — satellite_id, timestamp, x/y/z ECI position, lat/lon/alt geodetic, computed_at (for cache invalidation)

---

### Component 3 — Data Ingestion Service

#### [NEW] `backend/app/services/celestrak.py`
- `fetch_group(group_name: str) -> list[dict]`
  - GET `https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=JSON`
  - Parse JSON → list of OMM records
  - Extract TLE lines from OMM fields (`TLE_LINE1`, `TLE_LINE2`)
- `sync_catalog()` — fetches all configured groups, upserts into `Satellite` table
- `get_tle_lines(norad_id: int) -> tuple[str, str]` — retrieve from DB
- Robust error handling: timeout, retry with exponential backoff, fallback to cached data

---

### Component 4 — SGP4 Propagation Engine

#### [NEW] `backend/app/services/propagator.py`
- Uses Python's `sgp4` library (the reference implementation by Vallado)
- `propagate_single(tle_line1, tle_line2, dt: datetime) -> (pos_eci, vel_eci, geodetic)`
  - Parse TLE → `Satrec.twoline2rv()`
  - Propagate → `satrec.sgp4(jd, fr)`
  - Convert TEME → ECEF → geodetic (lat/lon/alt)
- `propagate_batch(satellites: list, time_range: list[datetime]) -> np.ndarray`
  - **NumPy-vectorized** batch propagation
  - Returns shape `(n_satellites, n_timesteps, 6)` — [x, y, z, vx, vy, vz] in ECI
  - ~10–50x faster than looping in Python
- `get_current_positions(satellites: list) -> list[dict]`
  - Single-timestep propagation for all objects → JSON-serializable dicts with lat/lon/alt

---

### Component 5 — Conjunction Screening Engine

#### [NEW] `backend/app/services/conjunction.py`
- **The core algorithm:**
  1. **Apogee-Perigee Pre-filter** — For each pair, if `apogee_A < perigee_B - threshold` or vice versa, skip (orbits can never intersect). Eliminates >90% of pairs.
  2. **Coarse screening** — Propagate remaining pairs at 60s steps. Compute ECI distances using NumPy broadcasting: `distances = np.linalg.norm(pos_A - pos_B, axis=-1)` for all pairs simultaneously.
  3. **Fine screening** — For pairs where coarse distance < 2× threshold, re-propagate at 10s steps around the coarse minimum to find precise TCA.
  4. **Event generation** — Create `ConjunctionEvent` with TCA, miss distance, relative velocity.
- `screen_all(satellites, horizon_hours, threshold_km) -> list[ConjunctionEvent]`
- `screen_incremental(new_tles, existing_catalog)` — only screen newly updated objects (performance optimization for scheduled runs)
- Performance target: ~2000 objects × 24h × 60s steps → runs in <30s on a modern laptop

---

### Component 6 — ML Risk Scorer

#### [NEW] `backend/app/services/risk_scorer.py`
- **Feature engineering** from conjunction events:
  - `min_distance_km` — the miss distance at TCA
  - `relative_velocity_km_s` — closing speed
  - `time_to_tca_hours` — urgency factor
  - `object_1_type`, `object_2_type` — payload vs debris vs rocket body
  - `combined_rcs` — radar cross-section (proxy for size, from CelesTrak metadata)
  - `orbit_similarity` — ratio of orbital periods (similar orbits = higher risk)
  - `approach_angle_deg` — head-on vs side-swipe
- **Model**: `sklearn.RandomForestClassifier` trained on synthetic conjunction data
  - Synthetic training data generated from known risk thresholds (NASA CARA guidelines: Pc > 1e-4 → high risk)
  - Binary classification: high-risk vs. low-risk
  - Also outputs `predict_proba()` for continuous risk probability
- **Hybrid score**: `risk_score = 0.6 * ml_probability + 0.4 * deterministic_score`
  - Deterministic component based on inverse-distance + velocity + urgency formula
  - ML component captures non-linear feature interactions
- Model serialized with `joblib`, retrained on each scheduled data refresh
- Fallback to deterministic-only scoring if ML model unavailable

---

### Component 7 — REST API Routes

#### [NEW] `backend/app/routes/satellites.py`
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/satellites` | List all tracked objects (paginated, filterable by type/group) |
| `GET` | `/api/satellites/<norad_id>` | Single satellite detail + orbital params |
| `GET` | `/api/satellites/stats` | Summary stats (total count, by type, by group) |
| `POST` | `/api/satellites/refresh` | Trigger manual TLE re-fetch (rate-limited) |

#### [NEW] `backend/app/routes/positions.py`
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/positions?time=<iso>` | All satellite positions at given time (default: now) |
| `GET` | `/api/positions/<norad_id>?start=<iso>&end=<iso>&step=<sec>` | Orbit path for single satellite over time range |

#### [NEW] `backend/app/routes/conjunctions.py`
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/conjunctions` | All active conjunction events (sorted by risk score desc) |
| `GET` | `/api/conjunctions/<id>` | Single conjunction detail with full timeline |
| `GET` | `/api/conjunctions/alerts` | High-risk events only (risk_score > threshold) |
| `POST` | `/api/conjunctions/screen` | Trigger manual re-screening |
| `GET` | `/api/conjunctions/timeline?start=<iso>&end=<iso>` | Risk timeline data for charts |

---

### Component 8 — Background Scheduler

#### [NEW] `backend/app/workers/scheduler.py`
- APScheduler with 3 recurring jobs:
  1. **TLE Sync** — every 6 hours — fetch latest TLEs from CelesTrak
  2. **Conjunction Screen** — every 2 hours — re-run screening with latest data
  3. **Cache Cleanup** — daily — purge expired propagation cache & old conjunction events

---

### Component 9 — React Frontend (API Client)

#### [NEW] `frontend/src/api/client.ts`
- Axios/fetch wrapper pointing to `http://localhost:5000/api`
- Typed request/response functions:
  - `fetchSatellites()`, `fetchPositions(time)`, `fetchConjunctions()`
  - `fetchAlerts()`, `fetchTimeline(start, end)`
  - `triggerRefresh()`, `triggerScreening()`
- Auto-polling: positions every 10s, conjunctions every 30s
- Error handling with retry logic

#### [NEW] `frontend/src/types/index.ts`
- TypeScript interfaces matching backend models:
  - `Satellite`, `Position`, `ConjunctionEvent`, `Alert`, `TimelinePoint`

---

### Component 10 — 3D Globe Visualization

#### [NEW] `frontend/src/components/Globe/GlobeView.tsx`
- Interactive 3D Earth using `three-globe` / `globe.gl`
- Satellite dots color-coded: active = cyan, debris = red/orange, station = gold
- Orbit paths as 3D arcs
- Conjunction events as pulsing red warning markers connecting the two objects
- Click-to-select → detail panel + camera zoom
- Auto-rotation, smooth zoom/pan
- Day/night terminator, atmosphere glow

---

### Component 11 — Dashboard UI Panels

#### [NEW] `frontend/src/index.css`
- Design system: deep navy dark theme, glassmorphism panels, electric accent colors
- Google Fonts: **Inter** + **JetBrains Mono**
- CSS custom properties, smooth transitions, glow effects

#### [NEW] `frontend/src/components/Dashboard/StatsBar.tsx`
- Top bar: total objects, active conjunctions, highest risk score, next TCA countdown

#### [NEW] `frontend/src/components/Dashboard/ConjunctionTable.tsx`
- Sortable table of conjunction events with risk score badges (green → red gradient)

#### [NEW] `frontend/src/components/Dashboard/RiskTimeline.tsx`
- Recharts line/area chart: risk scores over prediction window

#### [NEW] `frontend/src/components/Dashboard/AlertPanel.tsx`
- Live feed of high-risk alerts with animated entry, TCA countdown, urgency colors

#### [NEW] `frontend/src/components/Sidebar/ObjectList.tsx`
- Searchable, grouped list of all tracked objects

#### [NEW] `frontend/src/components/Sidebar/ObjectDetail.tsx`
- Selected object: orbital params, current position, conjunction involvement

#### [NEW] `frontend/src/components/Controls/TimeControls.tsx`
- Play/pause, speed control, time slider, "jump to now"

#### [NEW] `frontend/src/components/Controls/FilterBar.tsx`
- Object type toggles, threshold slider, horizon selector

---

### Component 12 — App Assembly

#### [NEW] `frontend/src/App.tsx`
- Full-viewport layout: globe background + glassmorphism overlay panels
- Top: StatsBar | Left: Sidebar | Right: Alerts + ConjunctionTable | Bottom: TimeControls + RiskTimeline

#### [NEW] `frontend/src/store/appStore.ts`
- Zustand store: satellite catalog, simulation time, conjunctions, selected objects, UI state

---

## Verification Plan

### Automated Tests
```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend build
cd frontend && npm run build
```

### Manual Verification
1. Start backend (`python run.py`) → verify TLE fetch on startup, DB populated
2. Hit `/api/satellites` → confirm JSON response with satellite data
3. Hit `/api/positions` → confirm lat/lon/alt for ISS matches known position
4. Hit `/api/conjunctions` → confirm events with risk scores
5. Start frontend (`npm run dev`) → globe renders with satellites
6. Verify conjunction markers, alert panel, risk timeline
7. Test time scrubber, filters, object selection
8. Screenshot the running dashboard for visual verification
