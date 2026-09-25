import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.common.config import settings
from app.common.db import SessionLocal, create_all_tables
from app.common.exceptions import register_exception_handlers
from app.features.auth.router import router as auth_router
from app.features.gamification.router import router as gamification_router
from app.features.home.router import router as home_router
from app.features.ingredients.router import router as ingredients_router
from app.features.notifications.router import router as notifications_router
from app.features.recipes.router import router as recipes_router
from app.features.reminders.router import router as reminders_router
from app.features.users.router import router as users_router
from app.features.vision.router import router as vision_router
from app.seeds import seed_all

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_all_tables()
    if settings.SEED_ON_STARTUP:
        with SessionLocal() as db:
            seed_all(db)

    scheduler = None
    if settings.SCHEDULER_ENABLED:
        from app.scheduler import create_scheduler

        scheduler = create_scheduler()
        scheduler.start()
    yield
    if scheduler:
        scheduler.shutdown()


app = FastAPI(title=settings.APP_NAME, version="0.1.0", debug=settings.DEBUG, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)

# 도메인 라우터 등록 — 새 도메인을 만들면 여기에 추가
for router in (
    auth_router,
    users_router,
    home_router,
    ingredients_router,
    vision_router,
    recipes_router,
    reminders_router,
    gamification_router,
    notifications_router,
):
    app.include_router(router, prefix=settings.API_PREFIX)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}
