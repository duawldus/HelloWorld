from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.db import Base
from app.common.models import TimestampMixin


class Difficulty(StrEnum):
    EASY = "EASY"  # 쉬움
    NORMAL = "NORMAL"  # 보통
    HARD = "HARD"  # 어려움


class Cookware(StrEnum):
    """자취생 조리도구 필터 (Notion: 원팬/전자레인지 조리법)."""

    ANY = "ANY"
    ONE_PAN = "ONE_PAN"
    MICROWAVE = "MICROWAVE"
    POT = "POT"


class RecipeSource(StrEnum):
    CURATED = "CURATED"  # 자체 큐레이션 (seeds)
    AI = "AI"  # 추천할 레시피가 부족할 때 AI(Gemini)가 실시간 생성해서 저장


class Recipe(TimestampMixin, Base):
    """레시피. 재료 수량은 servings(기본 1인분) 기준이고, 상세 조회 시 원하는 인분으로 환산한다."""

    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(String(200), default=None)
    image_url: Mapped[str | None] = mapped_column(String(300), default=None)
    cook_minutes: Mapped[int]
    difficulty: Mapped[Difficulty] = mapped_column(String(10), default=Difficulty.EASY)
    servings: Mapped[int] = mapped_column(default=1)
    cookware: Mapped[Cookware] = mapped_column(String(10), default=Cookware.ANY)
    source: Mapped[RecipeSource] = mapped_column(String(10), default=RecipeSource.CURATED, index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), default=None)

    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan", order_by="RecipeIngredient.id"
    )
    steps: Mapped[list["RecipeStep"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan", order_by="RecipeStep.step_no"
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(30))  # 사용자 재료/양념과 이름으로 매칭
    # 기준 인분(Recipe.servings)의 양. quantity=None 이면 '약간', '적당량' 처럼 unit만 표시
    quantity: Mapped[float | None] = mapped_column(default=None)  # 0.5
    unit: Mapped[str | None] = mapped_column(String(10), default=None)  # "모", "큰술", "약간"
    is_seasoning: Mapped[bool] = mapped_column(default=False)
    is_optional: Mapped[bool] = mapped_column(default=False)
    substitutes: Mapped[list[str]] = mapped_column(JSON, default=list)  # 대체 가능 재료 ["쪽파", "양파"]

    recipe: Mapped[Recipe] = relationship(back_populates="ingredients")


class RecipeStep(Base):
    __tablename__ = "recipe_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    step_no: Mapped[int]
    description: Mapped[str] = mapped_column(Text)

    recipe: Mapped[Recipe] = relationship(back_populates="steps")


class CookLog(TimestampMixin, Base):
    """요리 완료 기록. 실행 취소를 위해 소진 전 재료 상태를 스냅샷으로 저장한다."""

    __tablename__ = "cook_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"))
    xp_awarded: Mapped[int] = mapped_column(default=0)
    # [{"ingredient_id": 1, "prev_quantity": 1.0, "prev_status": "ACTIVE"}, ...]
    consumed_snapshot: Mapped[list[dict]] = mapped_column(JSON, default=list)
    undone_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
