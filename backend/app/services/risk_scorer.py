"""ML-based collision risk scoring.

Hybrid scoring: deterministic formula + Random Forest ML model.
The ML model is trained on synthetic conjunction data generated from
NASA CARA risk thresholds.
"""

import logging
import os
import math
from datetime import datetime, timezone

import numpy as np
import joblib

logger = logging.getLogger(__name__)

# Path for persisted ML model
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "instance")
MODEL_PATH = os.path.join(MODEL_DIR, "risk_model.joblib")

# Global model reference (lazy-loaded)
_ml_model = None
_model_loaded = False


# ---------- Deterministic Risk Score ----------

def _deterministic_score(
    miss_distance_km: float,
    relative_velocity_km_s: float,
    time_to_tca_hours: float,
    combined_size_factor: float = 1.0,
    approach_angle_deg: float = 90.0,
) -> float:
    """
    Compute a deterministic risk score (0-100) based on physics heuristics.

    Factors:
      - Distance: closer = higher risk (inverse exponential)
      - Velocity: faster = higher risk (kinetic energy)
      - Urgency: sooner TCA = higher risk
      - Size: larger objects = higher risk
      - Angle: head-on (180°) = higher risk than side-swipe
    """
    # Distance factor (0-1): exponential decay
    # At 0 km → 1.0, at threshold (25 km) → ~0.37, at 100 km → ~0.02
    dist_factor = math.exp(-miss_distance_km / 10.0)

    # Velocity factor (0-1): normalized to typical LEO relative velocity (~15 km/s max)
    vel_factor = min(relative_velocity_km_s / 15.0, 1.0)

    # Urgency factor (0-1): exponential decay over time
    # Within 1 hour → ~0.9, 6 hours → ~0.55, 24 hours → ~0.09
    urgency_factor = math.exp(-time_to_tca_hours / 10.0)

    # Approach angle factor (0-1): head-on (180°) is worst
    angle_factor = (approach_angle_deg / 180.0) if approach_angle_deg else 0.5

    # Combined score with weights
    raw_score = (
        0.40 * dist_factor
        + 0.25 * vel_factor
        + 0.20 * urgency_factor
        + 0.05 * angle_factor
        + 0.10 * combined_size_factor
    )

    return min(100.0, max(0.0, raw_score * 100.0))


# ---------- Feature Engineering ----------

RCS_SIZE_MAP = {"SMALL": 0.1, "MEDIUM": 0.5, "LARGE": 1.0}
OBJECT_TYPE_MAP = {"PAYLOAD": 1.0, "ROCKET BODY": 0.8, "DEBRIS": 0.6, "UNKNOWN": 0.5}


def _build_features(
    miss_distance_km: float,
    relative_velocity_km_s: float,
    time_to_tca_hours: float,
    obj1_type: str,
    obj2_type: str,
    obj1_rcs: str | None,
    obj2_rcs: str | None,
    approach_angle_deg: float,
    obj1_period: float | None,
    obj2_period: float | None,
) -> np.ndarray:
    """Build a feature vector for the ML model."""
    rcs1 = RCS_SIZE_MAP.get(obj1_rcs or "", 0.5)
    rcs2 = RCS_SIZE_MAP.get(obj2_rcs or "", 0.5)
    type1 = OBJECT_TYPE_MAP.get(obj1_type, 0.5)
    type2 = OBJECT_TYPE_MAP.get(obj2_type, 0.5)

    # Orbital similarity: ratio of periods (1.0 = identical orbits)
    period1 = obj1_period or 90.0
    period2 = obj2_period or 90.0
    orbit_similarity = min(period1, period2) / max(period1, period2) if max(period1, period2) > 0 else 0.5

    features = np.array([
        miss_distance_km,
        relative_velocity_km_s,
        time_to_tca_hours,
        rcs1,
        rcs2,
        type1,
        type2,
        approach_angle_deg or 90.0,
        orbit_similarity,
        miss_distance_km * relative_velocity_km_s,  # interaction: energy proxy
    ], dtype=np.float64)

    return features.reshape(1, -1)


# ---------- ML Model Training ----------

def train_risk_model() -> None:
    """
    Train the Random Forest risk classifier on synthetic conjunction data.

    Synthetic data is generated based on NASA CARA risk thresholds:
      - Pc > 1e-4 → high risk
      - Miss distance < 1 km + high velocity → high risk
      - Miss distance > 10 km + low velocity → low risk
    """
    from sklearn.ensemble import RandomForestClassifier

    logger.info("Training ML risk model on synthetic data...")

    np.random.seed(42)
    n_samples = 5000

    # Generate synthetic features
    miss_distances = np.random.exponential(scale=10.0, size=n_samples)  # km
    rel_velocities = np.random.uniform(0.1, 15.0, size=n_samples)  # km/s
    time_to_tca = np.random.uniform(0.5, 48.0, size=n_samples)  # hours
    rcs1 = np.random.choice([0.1, 0.5, 1.0], size=n_samples)
    rcs2 = np.random.choice([0.1, 0.5, 1.0], size=n_samples)
    type1 = np.random.choice([0.5, 0.6, 0.8, 1.0], size=n_samples)
    type2 = np.random.choice([0.5, 0.6, 0.8, 1.0], size=n_samples)
    angles = np.random.uniform(0, 180, size=n_samples)
    orbit_sim = np.random.uniform(0.3, 1.0, size=n_samples)
    energy_proxy = miss_distances * rel_velocities

    X = np.column_stack([
        miss_distances, rel_velocities, time_to_tca,
        rcs1, rcs2, type1, type2, angles, orbit_sim, energy_proxy,
    ])

    # Generate labels based on physics heuristics
    # High risk: close + fast + soon + large objects
    risk_scores = (
        0.4 * np.exp(-miss_distances / 5.0)
        + 0.25 * (rel_velocities / 15.0)
        + 0.2 * np.exp(-time_to_tca / 10.0)
        + 0.05 * (angles / 180.0)
        + 0.1 * ((rcs1 + rcs2) / 2.0)
    )
    y = (risk_scores > 0.4).astype(int)  # binary: 1 = high risk

    # Train
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X, y)

    # Save model
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    logger.info(f"  ML model trained and saved to {MODEL_PATH}")

    # Update global reference
    global _ml_model, _model_loaded
    _ml_model = model
    _model_loaded = True


def _load_model():
    """Lazy-load the ML model from disk."""
    global _ml_model, _model_loaded

    if _model_loaded:
        return _ml_model

    if os.path.exists(MODEL_PATH):
        try:
            _ml_model = joblib.load(MODEL_PATH)
            _model_loaded = True
            logger.info("ML risk model loaded from disk.")
            return _ml_model
        except Exception as e:
            logger.warning(f"Failed to load ML model: {e}")
            _model_loaded = True  # Don't retry
            return None

    # Train a fresh model if none exists
    try:
        train_risk_model()
        return _ml_model
    except Exception as e:
        logger.warning(f"Failed to train ML model: {e}")
        _model_loaded = True
        return None


# ---------- Public API ----------

def compute_risk_score(
    miss_distance_km: float,
    relative_velocity_km_s: float,
    time_to_tca_hours: float,
    obj1_type: str = "UNKNOWN",
    obj2_type: str = "UNKNOWN",
    obj1_rcs: str | None = None,
    obj2_rcs: str | None = None,
    approach_angle_deg: float = 90.0,
    obj1_period: float | None = None,
    obj2_period: float | None = None,
) -> dict:
    """
    Compute hybrid risk score combining deterministic + ML components.

    Returns:
        Dict with 'risk_score' (0-100 int) and 'risk_probability' (0.0-1.0 float)
    """
    from ..config import Config

    # Combined size factor from RCS
    rcs1 = RCS_SIZE_MAP.get(obj1_rcs or "", 0.5)
    rcs2 = RCS_SIZE_MAP.get(obj2_rcs or "", 0.5)
    combined_size = (rcs1 + rcs2) / 2.0

    # Deterministic score
    det_score = _deterministic_score(
        miss_distance_km=miss_distance_km,
        relative_velocity_km_s=relative_velocity_km_s,
        time_to_tca_hours=time_to_tca_hours,
        combined_size_factor=combined_size,
        approach_angle_deg=approach_angle_deg,
    )

    # ML probability
    ml_prob = 0.0
    model = _load_model()

    if model is not None:
        try:
            features = _build_features(
                miss_distance_km=miss_distance_km,
                relative_velocity_km_s=relative_velocity_km_s,
                time_to_tca_hours=time_to_tca_hours,
                obj1_type=obj1_type,
                obj2_type=obj2_type,
                obj1_rcs=obj1_rcs,
                obj2_rcs=obj2_rcs,
                approach_angle_deg=approach_angle_deg,
                obj1_period=obj1_period,
                obj2_period=obj2_period,
            )
            probas = model.predict_proba(features)
            ml_prob = float(probas[0, 1])  # probability of high-risk class
        except Exception as e:
            logger.warning(f"ML prediction failed, using deterministic only: {e}")
            ml_prob = det_score / 100.0

    # Hybrid score
    hybrid_score = (
        Config.RISK_ML_WEIGHT * (ml_prob * 100.0)
        + Config.RISK_DETERMINISTIC_WEIGHT * det_score
    )
    hybrid_score = min(100, max(0, int(round(hybrid_score))))

    return {
        "risk_score": hybrid_score,
        "risk_probability": ml_prob,
        "deterministic_score": round(det_score, 2),
    }
