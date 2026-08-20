"""Satellite position API routes."""

from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from ..models import Satellite
from ..services.propagator import get_positions_at_time, propagate_single

positions_bp = Blueprint("positions", __name__)


@positions_bp.route("/positions", methods=["GET"])
def all_positions():
    """
    Get current positions of all tracked satellites.

    Query params:
        time: ISO datetime (default: now)
        type: Filter by object type
        group: Filter by group name
    """
    # Parse time parameter
    time_str = request.args.get("time")
    if time_str:
        try:
            dt = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
        except ValueError:
            return jsonify({"error": "Invalid time format. Use ISO 8601."}), 400
    else:
        dt = datetime.now(timezone.utc)

    # Build satellite query
    query = Satellite.query
    object_type = request.args.get("type")
    group = request.args.get("group")

    if object_type:
        query = query.filter(Satellite.object_type == object_type.upper())
    if group:
        query = query.filter(Satellite.group_name == group.lower())

    satellites = query.all()

    sat_dicts = [
        {
            "norad_id": s.norad_id,
            "name": s.name,
            "object_type": s.object_type,
            "tle_line1": s.tle_line1,
            "tle_line2": s.tle_line2,
        }
        for s in satellites
    ]

    positions = get_positions_at_time(sat_dicts, dt)

    return jsonify({
        "time": dt.isoformat(),
        "count": len(positions),
        "positions": positions,
    })


@positions_bp.route("/positions/<int:norad_id>", methods=["GET"])
def satellite_orbit(norad_id):
    """
    Get the orbit path of a single satellite over a time range.

    Query params:
        start: ISO datetime (default: now)
        end: ISO datetime (default: start + 90 min = ~1 orbit)
        step: Time step in seconds (default: 60)
    """
    sat = Satellite.query.filter_by(norad_id=norad_id).first()
    if sat is None:
        return jsonify({"error": "Satellite not found"}), 404

    now = datetime.now(timezone.utc)

    # Parse time range
    start_str = request.args.get("start")
    end_str = request.args.get("end")
    step = request.args.get("step", 60, type=int)
    step = max(10, min(step, 600))  # Clamp to 10s–600s

    if start_str:
        try:
            start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        except ValueError:
            return jsonify({"error": "Invalid start time"}), 400
    else:
        start = now

    if end_str:
        try:
            end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
        except ValueError:
            return jsonify({"error": "Invalid end time"}), 400
    else:
        period_min = sat.period_min or 90.0
        end = start + timedelta(minutes=period_min)

    # Cap total points at 2000
    total_seconds = (end - start).total_seconds()
    n_points = int(total_seconds / step)
    if n_points > 2000:
        step = int(total_seconds / 2000)

    # Propagate
    orbit_points = []
    t = start
    while t <= end:
        result = propagate_single(sat.tle_line1, sat.tle_line2, t)
        if result:
            orbit_points.append({
                "time": t.isoformat(),
                "latitude": round(result["latitude"], 4),
                "longitude": round(result["longitude"], 4),
                "altitude_km": round(result["altitude_km"], 2),
            })
        t += timedelta(seconds=step)

    return jsonify({
        "norad_id": norad_id,
        "name": sat.name,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "step_seconds": step,
        "orbit": orbit_points,
    })
