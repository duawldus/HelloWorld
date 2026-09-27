"""시간 관련 유틸. 서버 시간대와 무관하게 항상 한국 시간(KST) 기준으로 계산한다.

DB에는 tz 정보 없는(naive) KST 시각을 저장한다.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.common.config import settings

TZ = ZoneInfo(settings.TIMEZONE)


def now() -> datetime:
    return datetime.now(TZ).replace(tzinfo=None)


def today() -> date:
    return now().date()


def d_day(target: date, base: date | None = None) -> int:
    """남은 일수. 오늘이 만료일이면 0, 지났으면 음수."""
    return (target - (base or today())).days
