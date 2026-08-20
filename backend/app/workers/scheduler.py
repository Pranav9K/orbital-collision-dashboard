"""Background task scheduler using APScheduler.

Runs recurring jobs for:
  1. TLE catalog sync from CelesTrak (every 6 hours)
  2. Conjunction screening (every 2 hours)
  3. Cache/event cleanup (daily)
"""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from ..config import Config

logger = logging.getLogger(__name__)

_scheduler = None


def init_scheduler(app):
    """Initialize and start the APScheduler with configured jobs."""
    global _scheduler

    if _scheduler is not None:
        logger.info("Scheduler already running, skipping init.")
        return

    _scheduler = BackgroundScheduler(daemon=True)

    # Job 1: TLE catalog sync
    _scheduler.add_job(
        func=_job_sync_catalog,
        trigger="interval",
        hours=Config.SCHEDULER_TLE_SYNC_HOURS,
        id="tle_sync",
        name="TLE Catalog Sync",
        replace_existing=True,
        kwargs={"app": app},
    )

    # Job 2: Conjunction screening
    _scheduler.add_job(
        func=_job_screen_conjunctions,
        trigger="interval",
        hours=Config.SCHEDULER_CONJUNCTION_SCREEN_HOURS,
        id="conjunction_screen",
        name="Conjunction Screening",
        replace_existing=True,
        kwargs={"app": app},
    )

    # Job 3: Cleanup old data
    _scheduler.add_job(
        func=_job_cleanup,
        trigger="interval",
        hours=Config.SCHEDULER_CACHE_CLEANUP_HOURS,
        id="cleanup",
        name="Data Cleanup",
        replace_existing=True,
        kwargs={"app": app},
    )

    _scheduler.start()
    logger.info("APScheduler started with 3 recurring jobs.")

    # Run initial data load immediately (in background thread)
    _scheduler.add_job(
        func=_job_initial_load,
        trigger="date",
        id="initial_load",
        name="Initial Data Load",
        kwargs={"app": app},
    )


def _job_initial_load(app):
    """Initial data load on startup: fetch TLEs, train ML model, run screening."""
    with app.app_context():
        logger.info("=== INITIAL DATA LOAD ===")

        # 1. Sync catalog
        try:
            from ..services.celestrak import sync_catalog
            summary = sync_catalog()
            logger.info(f"Initial catalog sync: {summary}")
        except Exception as e:
            logger.error(f"Initial catalog sync failed: {e}")
            return

        # 2. Train ML model
        try:
            from ..services.risk_scorer import train_risk_model
            train_risk_model()
        except Exception as e:
            logger.warning(f"ML model training failed: {e}")

        # 3. Run conjunction screening
        try:
            from ..services.conjunction import screen_conjunctions
            events = screen_conjunctions()
            logger.info(f"Initial screening found {len(events)} conjunction events.")
        except Exception as e:
            logger.error(f"Initial conjunction screening failed: {e}")

        logger.info("=== INITIAL DATA LOAD COMPLETE ===")


def _job_sync_catalog(app):
    """Scheduled job: re-fetch TLE data from CelesTrak."""
    with app.app_context():
        logger.info("[Scheduler] Running TLE catalog sync...")
        try:
            from ..services.celestrak import sync_catalog
            summary = sync_catalog()
            logger.info(f"[Scheduler] Catalog sync complete: {summary}")
        except Exception as e:
            logger.error(f"[Scheduler] Catalog sync failed: {e}")


def _job_screen_conjunctions(app):
    """Scheduled job: re-run conjunction screening."""
    with app.app_context():
        logger.info("[Scheduler] Running conjunction screening...")
        try:
            from ..services.conjunction import screen_conjunctions
            events = screen_conjunctions()
            logger.info(f"[Scheduler] Screening complete: {len(events)} events.")
        except Exception as e:
            logger.error(f"[Scheduler] Conjunction screening failed: {e}")


def _job_cleanup(app):
    """Scheduled job: clean up expired conjunction events."""
    with app.app_context():
        logger.info("[Scheduler] Running cleanup...")
        try:
            from ..models import db, ConjunctionEvent
            deleted = (
                ConjunctionEvent.query
                .filter_by(status="expired")
                .delete()
            )
            db.session.commit()
            logger.info(f"[Scheduler] Cleaned up {deleted} expired events.")
        except Exception as e:
            db.session.rollback()
            logger.error(f"[Scheduler] Cleanup failed: {e}")
