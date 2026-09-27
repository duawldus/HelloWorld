from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """환경 변수(.env)로 덮어쓸 수 있는 전역 설정."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "방구석 매니저 API"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"
    CORS_ORIGINS: list[str] = ["*"]

    # DB
    DATABASE_URL: str = "sqlite:///./bangguseok.db"
    SEED_ON_STARTUP: bool = True

    # 시간
    TIMEZONE: str = "Asia/Seoul"

    # 도메인 규칙
    IMMINENT_DAYS: int = 3  # D-3 이하를 '임박'으로 본다

    # LLM (Gemini API) — app/common/llm 에서만 사용
    GEMINI_API_KEY: str = ""
    LLM_MODEL: str = "gemini-3.8-flash"  # 무료 등급 사용 가능
    # AI가 답하기 전에 '생각하는' 양: minimal < low < medium < high. 낮을수록 빠르다 (레시피·재료 인식은 low 로 충분)
    LLM_THINKING_LEVEL: str = "low"
    LLM_TIMEOUT_SECONDS: int = 30  # 이 시간 안에 답이 없으면 실패 처리 (레시피 추천은 AI 없이 기존 레시피로 응답)

    # AI 사진 인식
    AI_MOCK: bool = True  # True면 Gemini 호출 없이 고정된 가짜 결과를 돌려준다 (프론트 개발용, 비용 0)

    # AI 레시피 실시간 생성 — 추천 결과가 부족하면 Gemini가 내 재료로 레시피를 만들어 DB에 저장
    AI_RECIPE_ENABLED: bool = True
    AI_RECIPE_MIN_RESULTS: int = 3  # (바로 가능 + 1~2개 부족) 결과가 이보다 적으면 생성
    AI_RECIPE_COUNT: int = 2  # 한 번에 생성할 레시피 수
    AI_LOW_CONFIDENCE: float = 0.80  # 이 값 미만이면 needs_review=True (와이어프레임: 72% → 확인 필요)

    # 푸시 알림 스케줄러
    SCHEDULER_ENABLED: bool = False
    EXPIRY_ALERT_HOUR: int = 9  # 유통기한 알림 발송 시각 (매일 오전 9시)
    PUSH_ENABLED: bool = False  # True면 Expo Push 로 실제 발송, False면 로그만 남긴다
    EXPO_ACCESS_TOKEN: str = ""  # Expo 대시보드에서 'Enhanced push security'를 켠 경우에만 필요


settings = Settings()
