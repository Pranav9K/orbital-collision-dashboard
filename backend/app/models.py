"""SQLAlchemy database models."""

from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Satellite(db.Model):
    """Tracked orbital object (satellite, debris, or rocket body)."""

    __tablename__ = "satellites"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    norad_id = db.Column(db.Integer, unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    intl_designator = db.Column(db.String(20), nullable=True)
    object_type = db.Column(db.String(20), default="UNKNOWN")  # PAYLOAD, DEBRIS, ROCKET BODY
    group_name = db.Column(db.String(50), nullable=True, index=True)

    # TLE data
    tle_line1 = db.Column(db.String(80), nullable=False)
    tle_line2 = db.Column(db.String(80), nullable=False)
    epoch = db.Column(db.DateTime, nullable=True)

    # Orbital parameters (derived from TLE)
    inclination_deg = db.Column(db.Float, nullable=True)
    eccentricity = db.Column(db.Float, nullable=True)
    period_min = db.Column(db.Float, nullable=True)
    apogee_km = db.Column(db.Float, nullable=True)
    perigee_km = db.Column(db.Float, nullable=True)
    raan_deg = db.Column(db.Float, nullable=True)
    arg_perigee_deg = db.Column(db.Float, nullable=True)
    mean_anomaly_deg = db.Column(db.Float, nullable=True)
    mean_motion = db.Column(db.Float, nullable=True)
    rcs_size = db.Column(db.String(10), nullable=True)  # SMALL, MEDIUM, LARGE

    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    conjunctions_as_obj1 = db.relationship(
        "ConjunctionEvent",
        foreign_keys="ConjunctionEvent.object1_norad_id",
        backref="object1",
        lazy="dynamic",
    )
    conjunctions_as_obj2 = db.relationship(
        "ConjunctionEvent",
        foreign_keys="ConjunctionEvent.object2_norad_id",
        backref="object2",
        lazy="dynamic",
    )

    def to_dict(self):
        return {
            "norad_id": self.norad_id,
            "name": self.name,
            "intl_designator": self.intl_designator,
            "object_type": self.object_type,
            "group_name": self.group_name,
            "inclination_deg": self.inclination_deg,
            "eccentricity": self.eccentricity,
            "period_min": self.period_min,
            "apogee_km": self.apogee_km,
            "perigee_km": self.perigee_km,
            "raan_deg": self.raan_deg,
            "arg_perigee_deg": self.arg_perigee_deg,
            "mean_anomaly_deg": self.mean_anomaly_deg,
            "mean_motion": self.mean_motion,
            "rcs_size": self.rcs_size,
            "epoch": self.epoch.isoformat() if self.epoch else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<Satellite {self.norad_id} {self.name}>"


class ConjunctionEvent(db.Model):
    """A predicted close-approach event between two objects."""

    __tablename__ = "conjunction_events"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    object1_norad_id = db.Column(
        db.Integer, db.ForeignKey("satellites.norad_id"), nullable=False, index=True
    )
    object2_norad_id = db.Column(
        db.Integer, db.ForeignKey("satellites.norad_id"), nullable=False, index=True
    )

    # Closest approach details
    tca = db.Column(db.DateTime, nullable=False)  # Time of Closest Approach
    miss_distance_km = db.Column(db.Float, nullable=False)
    relative_velocity_km_s = db.Column(db.Float, nullable=True)
    approach_angle_deg = db.Column(db.Float, nullable=True)

    # Positions at TCA (geodetic)
    obj1_lat = db.Column(db.Float, nullable=True)
    obj1_lon = db.Column(db.Float, nullable=True)
    obj1_alt_km = db.Column(db.Float, nullable=True)
    obj2_lat = db.Column(db.Float, nullable=True)
    obj2_lon = db.Column(db.Float, nullable=True)
    obj2_alt_km = db.Column(db.Float, nullable=True)

    # Risk assessment
    risk_score = db.Column(db.Integer, default=0)  # 0-100 composite score
    risk_probability = db.Column(db.Float, default=0.0)  # ML probability

    # Status
    status = db.Column(db.String(20), default="active")  # active, expired, mitigated

    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "object1_norad_id": self.object1_norad_id,
            "object1_name": self.object1.name if self.object1 else None,
            "object2_norad_id": self.object2_norad_id,
            "object2_name": self.object2.name if self.object2 else None,
            "tca": self.tca.isoformat() if self.tca else None,
            "miss_distance_km": round(self.miss_distance_km, 3) if self.miss_distance_km else None,
            "relative_velocity_km_s": round(self.relative_velocity_km_s, 3) if self.relative_velocity_km_s else None,
            "approach_angle_deg": round(self.approach_angle_deg, 2) if self.approach_angle_deg else None,
            "obj1_lat": self.obj1_lat,
            "obj1_lon": self.obj1_lon,
            "obj1_alt_km": self.obj1_alt_km,
            "obj2_lat": self.obj2_lat,
            "obj2_lon": self.obj2_lon,
            "obj2_alt_km": self.obj2_alt_km,
            "risk_score": self.risk_score,
            "risk_probability": round(self.risk_probability, 6) if self.risk_probability else 0.0,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Conjunction {self.object1_norad_id}↔{self.object2_norad_id} @ {self.miss_distance_km:.1f}km>"
