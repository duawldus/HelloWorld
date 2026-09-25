"""주기 실행 잡. app/scheduler.py 가 등록한다 (SCHEDULER_ENABLED=true 일 때).

[화면 9] 푸시 알림 시나리오
  - 유통기한 알림: 매일 오전 9시, 임박 재료가 있는 사용자에게 → 탭하면 레시피 추천
    예) "두부 유통기한이 내일까지예요" / "냉장고에 두부 1모가 있어요. 두부계란찜은 어때요?"
  - 생활 알림: 사용자가 설정한 요일·시각(및 N일 전)에 → 탭하면 생활 알림
    예) "지금 빨래 시간이에요" / "전기요금 납부일이 3일 남았어요"
  - 같은 날 같은 대상은 한 번만 (NotificationLog 유니크 제약)
"""

from app.common.db import SessionLocal
from app.features.notifications.sender import get_sender


def send_expiry_alerts() -> None:
    """TODO(notifications):
    1. 활성 재료 중 d_day <= IMMINENT_DAYS 인 재료가 있는 사용자 조회
    2. 사용자별로 가장 임박한 재료로 문구 생성 (+ 가능하면 recipes 추천 1개 제목)
    3. NotificationLog 중복 확인 → PushDevice 토큰으로 발송 → 로그 저장
    """
    with SessionLocal() as db:  # noqa: F841
        sender = get_sender()  # noqa: F841
        raise NotImplementedError


def send_reminder_alerts() -> None:
    """매 분 실행.

    TODO(notifications):
    1. 활성 Reminder 들의 next_notify_at(r, now-1분) 이 [now-1분, now] 구간에 들어오는지 확인
    2. notify_before_days > 0 이면 'N일 남았어요' 문구, 0 이면 '지금 ~ 시간이에요'
    3. 중복 확인 → 발송 → NotificationLog 저장
    """
    with SessionLocal() as db:  # noqa: F841
        sender = get_sender()  # noqa: F841
        raise NotImplementedError
