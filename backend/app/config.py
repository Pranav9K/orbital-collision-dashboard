"""Application configuration."""

import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(os.path.dirname(BASE_DIR), "instance")


class Config:
    """Base configuration."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-prod")

    # Database
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = (
        db_url or f"sqlite:///{os.path.join(INSTANCE_DIR, 'orbital.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    # CelesTrak
    CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php"
    CELESTRAK_GROUPS = [
        "stations",       # ISS, Tiangong, CSS
        "visual",         # 100 brightest satellites & debris
        "1982-092",       # Cosmos 1408 debris cloud
    ]
    CELESTRAK_TIMEOUT = 12  # seconds (fail fast and use fallback)

    # Propagation
    PROPAGATION_HORIZON_HOURS = 24
    PROPAGATION_STEP_SECONDS = 60       # coarse screening
    PROPAGATION_FINE_STEP_SECONDS = 10  # fine screening around TCA

    # Conjunction screening
    CONJUNCTION_THRESHOLD_KM = 25.0     # flag if closer than this
    CONJUNCTION_COARSE_FACTOR = 2.0     # coarse threshold = factor * threshold
    CONJUNCTION_MAX_EVENTS = 500        # cap stored events

    # Risk scoring
    RISK_HIGH_THRESHOLD = 70            # score >= this → high-risk alert
    RISK_ML_WEIGHT = 0.6                # weight for ML probability in hybrid score
    RISK_DETERMINISTIC_WEIGHT = 0.4     # weight for deterministic component

    # Scheduler intervals (seconds)
    SCHEDULER_TLE_SYNC_HOURS = 6
    SCHEDULER_CONJUNCTION_SCREEN_HOURS = 2
    SCHEDULER_CACHE_CLEANUP_HOURS = 24

    # CORS
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
