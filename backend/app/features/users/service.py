from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.common.exceptions import ValidationError
from app.features.users.models import Seasoning, User, UserSeasoning
from app.features.users.schemas import SeasoningOption, UserUpdate


def get_or_create_by_device(db: Session, device_id: str) -> User:
    """X-Device-Id 로 사용자 조회. 처음 보는 기기면 새로 만든다 (로그인 없음)."""
    user = db.scalar(select(User).where(User.device_id == device_id))
    if user is not None:
        return user
    try:
        user = User(device_id=device_id)
        db.add(user)
        db.commit()
    except IntegrityError:
        # 같은 기기의 첫 요청 여러 개가 동시에 들어온 경우
        db.rollback()
        user = db.scalar(select(User).where(User.device_id == device_id))
    return user


def update_me(db: Session, user: User, data: UserUpdate) -> User:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    return user


def get_owned_seasoning_names(db: Session, user_id: int) -> set[str]:
    """레시피 매칭에서 사용하는 공개 함수 (recipes 도메인이 호출)."""
    stmt = (
        select(Seasoning.name)
        .join(UserSeasoning, UserSeasoning.seasoning_id == Seasoning.id)
        .where(UserSeasoning.user_id == user_id)
    )
    return set(db.scalars(stmt).all())


def list_seasoning_options(db: Session, user: User) -> list[SeasoningOption]:
    owned_ids = set(db.scalars(select(UserSeasoning.seasoning_id).where(UserSeasoning.user_id == user.id)))
    seasonings = db.scalars(select(Seasoning).order_by(Seasoning.sort_order, Seasoning.id)).all()
    return [SeasoningOption(id=s.id, name=s.name, icon=s.icon, owned=s.id in owned_ids) for s in seasonings]


def replace_seasonings(db: Session, user: User, seasoning_ids: list[int]) -> list[SeasoningOption]:
    ids = set(seasoning_ids)
    valid_ids = set(db.scalars(select(Seasoning.id).where(Seasoning.id.in_(ids))))
    if invalid := ids - valid_ids:
        raise ValidationError(f"존재하지 않는 양념 ID: {sorted(invalid)}")

    db.execute(delete(UserSeasoning).where(UserSeasoning.user_id == user.id))
    db.add_all(UserSeasoning(user_id=user.id, seasoning_id=sid) for sid in ids)
    user.onboarded = True
    db.commit()
    return list_seasoning_options(db, user)
