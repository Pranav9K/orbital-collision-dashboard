"""Satellite catalog API routes."""

from flask import Blueprint, jsonify, request

from ..models import db, Satellite
from ..services.celestrak import sync_catalog, get_catalog_stats

satellites_bp = Blueprint("satellites", __name__)


@satellites_bp.route("/satellites", methods=["GET"])
def list_satellites():
    """List all tracked satellites with optional filtering."""
    # Query params
    object_type = request.args.get("type")
    group = request.args.get("group")
    search = request.args.get("search", "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 100, type=int)
    per_page = min(per_page, 500)  # Cap at 500

    query = Satellite.query

    if object_type:
        query = query.filter(Satellite.object_type == object_type.upper())
    if group:
        query = query.filter(Satellite.group_name == group.lower())
    if search:
        query = query.filter(
            db.or_(
                Satellite.name.ilike(f"%{search}%"),
                Satellite.norad_id == _safe_int(search),
            )
        )

    query = query.order_by(Satellite.norad_id)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "satellites": [s.to_dict() for s in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages,
        "per_page": per_page,
    })


@satellites_bp.route("/satellites/<int:norad_id>", methods=["GET"])
def get_satellite(norad_id):
    """Get a single satellite by NORAD catalog number."""
    sat = Satellite.query.filter_by(norad_id=norad_id).first()
    if sat is None:
        return jsonify({"error": "Satellite not found"}), 404
    return jsonify(sat.to_dict())


@satellites_bp.route("/satellites/stats", methods=["GET"])
def satellite_stats():
    """Get summary statistics about the satellite catalog."""
    stats = get_catalog_stats()
    return jsonify(stats)


@satellites_bp.route("/satellites/refresh", methods=["POST"])
def refresh_satellites():
    """Trigger a manual TLE re-fetch from CelesTrak."""
    try:
        summary = sync_catalog()
        return jsonify({
            "status": "ok",
            "message": "Catalog refreshed",
            "summary": summary,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _safe_int(value):
    """Safely convert to int or return -1."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return -1
