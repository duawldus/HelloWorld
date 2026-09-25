"""푸시 알림 스케줄러. SCHEDULER_ENABLED=true 일 때만 서버와 함께 뜬다."""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.common.config import settings
from app.features.notifications import jobs

logger = logging.getLogger(__name__)


def create_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone=settings.TIMEZONE)
    scheduler.add_job(
        jobs.send_expiry_alerts,
        CronTrigger(hour=settings.EXPIRY_ALERT_HOUR, minute=0),
        id="expiry_alerts",
    )
    scheduler.add_job(jobs.send_reminder_alerts, CronTrigger(minute="*"), id="reminder_alerts")
    return scheduler
