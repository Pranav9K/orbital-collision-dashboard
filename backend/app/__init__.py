"""Flask application factory."""

import os
import logging
from flask import Flask
from flask_cors import CORS

from .config import Config
from .models import db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app(config_class=Config):
    """Create and configure the Flask application."""
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_class)

    # Ensure instance folder exists
    os.makedirs(app.instance_path, exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    CORS(app, origins=app.config.get("CORS_ORIGINS", ["*"]))

    # Create database tables
    with app.app_context():
        db.create_all()
        logger.info("Database tables created/verified.")
        from .services.celestrak import seed_catalog_if_empty
        seed_catalog_if_empty()

    # Register blueprints
    from .routes.satellites import satellites_bp
    from .routes.positions import positions_bp
    from .routes.conjunctions import conjunctions_bp

    app.register_blueprint(satellites_bp, url_prefix="/api")
    app.register_blueprint(positions_bp, url_prefix="/api")
    app.register_blueprint(conjunctions_bp, url_prefix="/api")

    # Health check
    @app.route("/api/health")
    def health():
        return {"status": "ok", "message": "Orbital API is running"}

    # Start background scheduler
    _start_scheduler(app)

    logger.info("🚀 Orbital Collision Dashboard API ready.")
    return app


def _start_scheduler(app):
    """Initialize and start APScheduler background jobs."""
    from .workers.scheduler import init_scheduler

    try:
        init_scheduler(app)
        logger.info("Background scheduler started.")
    except Exception as e:
        logger.warning(f"Scheduler failed to start: {e}. App will run without auto-refresh.")
