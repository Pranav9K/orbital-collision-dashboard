"""Conjunction event API routes."""

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..models import db, ConjunctionEvent
from ..config import Config
from ..services.conjunction import screen_conjunctions

conjunctions_bp = Blueprint("conjunctions", __name__)


@conjunctions_bp.route("/conjunctions", methods=["GET"])
def list_conjunctions():
    """
    List all conjunction events, sorted by risk score descending.

    Query params:
        status: Filter by status (active, expired, mitigated)
        min_risk: Minimum risk score (0-100)
        limit: Max results (default: 100)
    """
    status = request.args.get("status", "active")
    min_risk = request.args.get("min_risk", 0, type=int)
    limit = request.args.get("limit", 100, type=int)
    limit = min(limit, 500)

    query = ConjunctionEvent.query

    if status:
        query = query.filter(ConjunctionEvent.status == status)
    if min_risk > 0:
        query = query.filter(ConjunctionEvent.risk_score >= min_risk)

    events = (
        query.order_by(ConjunctionEvent.risk_score.desc())
        .limit(limit)
        .all()
    )

    return jsonify({
        "count": len(events),
        "conjunctions": [e.to_dict() for e in events],
    })


@conjunctions_bp.route("/conjunctions/<int:event_id>", methods=["GET"])
def get_conjunction(event_id):
    """Get a single conjunction event by ID."""
    event = ConjunctionEvent.query.get(event_id)
    if event is None:
        return jsonify({"error": "Conjunction event not found"}), 404
    return jsonify(event.to_dict())


@conjunctions_bp.route("/conjunctions/alerts", methods=["GET"])
def get_alerts():
    """Get high-risk conjunction events (risk_score >= threshold)."""
    threshold = request.args.get("threshold", Config.RISK_HIGH_THRESHOLD, type=int)

    events = (
        ConjunctionEvent.query.filter(
            ConjunctionEvent.status == "active",
            ConjunctionEvent.risk_score >= threshold,
        )
        .order_by(ConjunctionEvent.risk_score.desc())
        .all()
    )

    return jsonify({
        "threshold": threshold,
        "count": len(events),
        "alerts": [e.to_dict() for e in events],
    })


@conjunctions_bp.route("/conjunctions/screen", methods=["POST"])
def trigger_screening():
    """Trigger a manual conjunction screening."""
    # Parse optional params from request body
    data = request.get_json(silent=True) or {}
    horizon = data.get("horizon_hours", Config.PROPAGATION_HORIZON_HOURS)
    threshold = data.get("threshold_km", Config.CONJUNCTION_THRESHOLD_KM)

    try:
        events = screen_conjunctions(
            horizon_hours=horizon,
            threshold_km=threshold,
        )
        return jsonify({
            "status": "ok",
            "message": f"Screening complete. Found {len(events)} events.",
            "count": len(events),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@conjunctions_bp.route("/conjunctions/timeline", methods=["GET"])
def risk_timeline():
    """
    Get risk timeline data for chart visualization.

    Returns conjunction events binned by time with max risk per bin.

    Query params:
        start: ISO datetime (default: now)
        end: ISO datetime (default: start + 24h)
        bins: Number of time bins (default: 48)
    """
    now = datetime.now(timezone.utc)

    start_str = request.args.get("start")
    end_str = request.args.get("end")
    n_bins = request.args.get("bins", 48, type=int)

    if start_str:
        try:
            start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        except ValueError:
            start = now
    else:
        start = now

    if end_str:
        try:
            end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
        except ValueError:
            end = now
    else:
        end = start + __import__("datetime").timedelta(hours=24)

    # Get active events in the time range
    events = (
        ConjunctionEvent.query.filter(
            ConjunctionEvent.status == "active",
            ConjunctionEvent.tca >= start,
            ConjunctionEvent.tca <= end,
        )
        .order_by(ConjunctionEvent.tca)
        .all()
    )

    # Bin events
    bin_duration = (end - start) / n_bins
    timeline = []

    for i in range(n_bins):
        bin_start = start + i * bin_duration
        bin_end = bin_start + bin_duration

        bin_events = [
            e for e in events
            if e.tca and bin_start <= e.tca < bin_end
        ]

        max_risk = max((e.risk_score for e in bin_events), default=0)
        event_count = len(bin_events)

        timeline.append({
            "time": bin_start.isoformat(),
            "max_risk_score": max_risk,
            "event_count": event_count,
        })

    return jsonify({
        "start": start.isoformat(),
        "end": end.isoformat(),
        "bins": n_bins,
        "timeline": timeline,
    })
