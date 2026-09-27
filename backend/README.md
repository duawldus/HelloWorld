# 🏠 방구석 매니저 — Backend

> 자취생이 냉장고 재료를 빠르게 등록하고, **유통기한 임박 재료부터 소진하는 맞춤 레시피**를 추천받아 실제 요리까지 이어지게 돕는 서비스.
> 청소 · 빨래 · 공과금 같은 **생활 루틴 알림**과 **레벨 · 뱃지**로 꾸준한 사용을 유도합니다.

- 와이어프레임: https://claude.ai/artifact/DAF8NvnekfBwcPBf7xCVKT
- 기획안(Notion): https://app.notion.com/p/IDLE-3e35a77378fe8001a701e568e433f90b
- 팀 공통 규칙: 루트의 [`CLAUDE.md`](../CLAUDE.md), [`README.md`](../README.md)
- **프론트엔드 요청서:** [`FRONTEND_REQUESTS.md`](FRONTEND_REQUESTS.md) — 백엔드 변경으로 프론트에서 수정이 필요한 부분 (⚠️ `X-Device-Id` 헤더)

---

## 목차

1. [기술 스택](#-기술-스택)
2. [빠른 시작](#-빠른-시작)
3. [폴더 구조](#-폴더-구조)
4. [기능별 담당 · 진행 상황](#-기능별-담당--진행-상황)
5. [API 목록](#-api-목록)
6. [코드 작성 규칙](#-코드-작성-규칙)
7. [협업 규칙 (Git)](#-협업-규칙-git)
8. [자주 묻는 것](#-자주-묻는-것)

---

## 🛠 기술 스택

| 구분 | 사용 |
| --- | --- |
| Language | Python 3.11+ |
| Framework | FastAPI |
| ORM | SQLAlchemy 2.0 |
| DB | **SQLite** (개발 단계. 추후 PostgreSQL + Alembic 전환 예정 — `DATABASE_URL`만 바꾸면 됨) |
| LLM | **Gemini API** (`google-genai` SDK, 무료 등급) — `app/common/llm`을 통해서만 호출 |
| 사용자 식별 | **로그인 없음** — 기기 고유 ID를 `X-Device-Id` 헤더로 전송 |
| 푸시 알림 | Expo Push (발송 로직은 TODO) |
| 스케줄러 | APScheduler |
| Lint / Test | Ruff / pytest |

---

## 🚀 빠른 시작

모든 명령은 `backend/` 폴더에서 실행합니다.

```bash
cd backend

# 1. 가상환경 만들기
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 2. 패키지 설치
pip install -r requirements-dev.txt

# 3. 환경 변수 파일 만들기
cp .env.example .env

# 4. 서버 실행 (코드 수정 시 자동 재시작)
uvicorn app.main:app --reload
```

- Swagger 문서: http://localhost:8000/docs ← **프론트와 API 확인은 여기서**
- 서버가 처음 뜰 때 테이블 생성 + 기본 데이터(양념 12종, 재료 프리셋 27종, 레시피 28개, 뱃지 6개)가 자동으로 들어갑니다.

### 사용자 구분 (로그인 없음)

로그인·회원가입이 없습니다. 앱이 설치될 때 기기 고유 ID(UUID)를 한 번 만들어 저장해두고, **모든 요청에 `X-Device-Id` 헤더로 보내면** 됩니다.

- 처음 보는 ID면 서버가 사용자를 자동으로 만들고, 이후엔 같은 사용자로 취급해요.
- 앱 시작 시 `GET /api/v1/users/me` → `onboarded`가 `false`면 온보딩(기본 양념 설정) 화면으로.
- Swagger에서는 오른쪽 위 **Authorize** 버튼 → `X-Device-Id`에 아무 값(8자 이상, 예: `my-test-device-01`) 입력.
- 앱을 지웠다 다시 깔면 새 ID가 생겨서 데이터가 이어지지 않아요. (필요해지면 그때 로그인 도입)

### 테스트 · 린트

```bash
pytest                                  # 전체 테스트
pytest tests/test_reminders.py -v       # 특정 기능만
ruff check . --fix && ruff format .     # 린트 + 자동 정리 (PR 전에 꼭!)
```

---

## 📁 폴더 구조

**기능 단위**로 폴더를 나눴습니다. 각자 맡은 기능 폴더 안에서 작업하면 충돌이 거의 나지 않아요.

```
backend/
├── app/
│   ├── main.py               # 앱 생성, 라우터 등록
│   ├── models.py             # 모든 모델 import (테이블 생성용)
│   ├── scheduler.py          # 푸시 알림 스케줄러
│   ├── common/
│   │   ├── db/               # 🔒 DB 공통 모듈 (엔진, 세션, Base) — 담당자 외 수정 금지
│   │   ├── llm/              # 🔒 LLM(Gemini) 공통 모듈 — 담당자 외 수정 금지
│   │   ├── config.py         #   환경 변수 설정
│   │   ├── deps.py           #   DbSession, CurrentUser(X-Device-Id) 의존성
│   │   ├── exceptions.py     #   공통 예외 → {"code", "message"} 응답
│   │   ├── time.py           #   now(), today(), d_day() — 항상 KST
│   │   ├── models.py         #   created_at / updated_at 믹스인
│   │   └── schemas.py        #   ORMModel 등
│   ├── features/             # 🧩 기능별 코드 (기능 하나당 폴더 하나)
│   │   ├── users/            #   내 정보, 기본 양념(온보딩)
│   │   ├── home/             #   홈 대시보드 (다른 기능 조합)
│   │   ├── ingredients/      #   냉장고 재료, 프리셋
│   │   ├── vision/           #   AI 사진 인식 (Gemini)
│   │   ├── recipes/          #   레시피 추천, 상세, 요리 완료
│   │   ├── reminders/        #   생활 알림 (세탁·청소·공과금)
│   │   ├── gamification/     #   XP, 레벨, 연속 기록, 뱃지
│   │   └── notifications/    #   푸시 토큰, 발송 잡
│   └── seeds/                # 🌱 초기 데이터 (양념, 프리셋, 레시피, 뱃지)
└── tests/                    # 기능별 테스트
```

### 기능 폴더 하나의 구성

| 파일 | 역할 |
| --- | --- |
| `router.py` | API 엔드포인트. **얇게** 유지 — 요청 받고 service 호출만 |
| `schemas.py` | 요청/응답 Pydantic 모델 = **프론트와의 약속(API 스펙)** |
| `models.py` | DB 테이블 (SQLAlchemy) |
| `service.py` | 비즈니스 로직. 실제 코드는 대부분 여기에 |
| (기타) | `schedule.py`, `rules.py`, `client.py` 등 기능 전용 모듈 |

---

## 👥 기능별 담당 · 진행 상황

> 담당자 칸은 채워서 커밋해주세요. ✅ 구현 완료 / 🚧 TODO 남음

| 기능 | 관련 화면 | 담당 | 상태 | 남은 TODO |
| --- | --- | --- | --- | --- |
| `ingredients` | 2 냉장고, 3 식재료 추가 | 염지연 | ✅ | 동의어 매칭은 `PRESET_ALIASES`에 계속 추가 |
| `vision` | 3-1 사진 촬영, 3-2 인식 결과 | 염지연 | ✅ | 실제 사진 인식 확인 완료 (응답 10~25초). 사진을 더 모아 `needs_review` 기준(0.8) 조정 |
| `users` | 0 온보딩 · 기본 양념 | 우시연 | ✅ | |
| `home` | 1 홈 대시보드 | 우시연 | ✅ | |
| `recipes` | 4 레시피 추천, 5 레시피 상세 | 우시연 | 🚧 | 추천·AI 생성·인분 조절·요리 완료·실행 취소 완료 → **`ingredients` 복구 함수 합치기 대기**(실행 취소), AI 프롬프트 튜닝 |
| `reminders` | 6 생활 알림, 7 알림 추가 | 우시연 | ✅ | 같은 회차 중복 완료 방지 |
| `gamification` | 8 성과 · 뱃지 | 우시연 | ✅ | |
| `notifications` | 9 푸시 알림 | 우시연 | 🚧 | **유통기한/생활 알림 발송 잡** (`jobs.py`), **Expo Push 연동** (`sender.py`) |

- 아직 구현 안 된 기능은 `raise NotImplementedError` → API가 **501**을 돌려줍니다. 요청/응답 스키마는 이미 정의돼 있어서 **프론트는 Swagger 보고 먼저 붙일 수 있어요.**
- 코드에서 할 일 찾기: `grep -rn "TODO(" app/` → `TODO(recipes)`처럼 기능 이름이 붙어 있습니다.
- 사진 인식은 `.env`의 `AI_MOCK=true`(기본값)면 Gemini를 호출하지 않고 와이어프레임과 같은 가짜 결과(두부 98%, 계란 95%, 대파 72%)를 돌려줍니다. **API 비용 0원.**

### 경계가 겹치는 곳

- `recipes`(우시연)는 냉장고 재료를 `ingredients.list_active()`로 읽고, 요리 완료 때 **`ingredients.consume_ingredients(db, user, ids)`**(염지연, 합쳐짐)로 재료를 소진해요. 실행 취소에 쓸 **복구 함수는 아직 없어서** 지금은 501이 나가고, 아래 모양으로 합쳐지면 코드 수정 없이 바로 동작해요.
  ```python
  # app/features/ingredients/service.py (염지연)
  def restore_ingredients(db, user: User, snapshots: list[dict]) -> list[int]:
      """스냅샷([{"ingredient_id", "name", "expires_on", "prev_quantity", "prev_status"}])대로 status·quantity 복구, consumed_at=None. commit 하지 않음. 복구한 id 반환"""
  ```
  합친 뒤에는 `tests/test_cooking.py`의 `fake_restore` 픽스처와 501 테스트를 지우면 돼요.
- `ingredients`·`vision`(염지연)이 XP를 줄 때는 `gamification.award_xp()`만 호출해요. XP 수치는 우시연이 `rules.py`에서 관리.

---

## 📡 API 목록

모든 경로 앞에 `/api/v1`이 붙고, 전부 `X-Device-Id: <기기 ID>` 헤더가 필요합니다.

| 기능 | Method | Path | 설명 | 상태 |
| --- | --- | --- | --- | --- |
| users | GET | `/users/me` | 내 정보 (처음 보는 기기면 자동 생성) | ✅ |
| | PATCH | `/users/me` | 닉네임 수정 | ✅ |
| | GET | `/users/me/seasonings` | 기본 양념 목록 + 보유 여부 | ✅ |
| | PUT | `/users/me/seasonings` | 보유 양념 저장 (온보딩 완료 처리) | ✅ |
| home | GET | `/home` | 홈 대시보드 한 번에 | ✅ |
| ingredients | GET | `/ingredients/presets?frequent=&q=` | 자주 쓰는 재료 / 재료 검색 | ✅ |
| | GET | `/ingredients?storage=` | 내 냉장고 (임박순, 보관위치 필터) | ✅ |
| | POST | `/ingredients?source=` | 재료 1개 등록 (유통기한 자동) | ✅ |
| | POST | `/ingredients/batch` | 여러 개 일괄 등록 (사진이면 +15 XP) | ✅ |
| | GET / PATCH / DELETE | `/ingredients/{id}` | 조회 / 수정 / 삭제(폐기, '버렸어요') | ✅ |
| | POST | `/ingredients/{id}/consume` | 소진 ('다 먹었어요', XP 없음) | ✅ |
| | POST | `/ingredients/deduct` | 수량 차감 (여러 개 한 번에, 0이 되면 소진, XP 없음) | ✅ |
| vision | POST | `/vision/recognize` | 사진 → 재료 후보 + 신뢰도 (multipart `image`) | ✅ (튜닝 TODO) |
| recipes | GET | `/recipes/recommendations` | 추천 (바로 가능 / 1~2개 부족, 부족하면 AI 생성) | ✅ |
| | GET | `/recipes/{id}?servings=` | 상세 (인분 환산된 재료, 보유/부족/대체재, 조리 순서) | ✅ |
| | POST | `/recipes/{id}/complete` | 요리 완료 → 재료 소진 + XP (임박 재료면 보너스) | ✅ (소진 함수 합치기 전엔 501) |
| | POST | `/recipes/cook-logs/{id}/undo` | 요리 완료 실행 취소 → 재료 복구 + XP 회수 | ✅ (복구 함수 합치기 전엔 501) |
| reminders | GET | `/reminders` | 카테고리별 목록 + 다음 알림 | ✅ |
| | POST | `/reminders` | 알림 추가 | ✅ |
| | GET / PATCH / DELETE | `/reminders/{id}` | 조회 / 수정·토글 / 삭제 | ✅ |
| | POST | `/reminders/{id}/complete` | 집안일 완료 (+5 XP) | ✅ |
| gamification | GET | `/gamification/stats` | 레벨, XP, 연속 기록, 절약 식비 | ✅ |
| | GET | `/gamification/badges` | 뱃지 목록 + 진행도 | ✅ |
| | GET | `/gamification/xp-logs` | 최근 XP 로그 | ✅ |
| notifications | POST | `/notifications/devices` | Expo 푸시 토큰 등록 | ✅ |
| | DELETE | `/notifications/devices/{token}` | 푸시 토큰 해제 | ✅ |
| | GET | `/notifications` | 받은 알림 이력 | ✅ |

### 공통 응답 규칙

- 성공: 스키마 그대로 JSON (감싸는 `data` 없음)
- 실패: `{"code": "NOT_FOUND", "message": "재료를 찾을 수 없습니다."}`

| HTTP | code | 언제 |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | `X-Device-Id` 헤더 없음 |
| 404 | `NOT_FOUND` | 없는 리소스, 남의 리소스 |
| 422 | `VALIDATION_ERROR` | 비즈니스 검증 실패 (지난 유통기한 등) |
| 422 | (FastAPI 기본) | 요청 형식 오류 → `detail` 배열 |
| 501 | `NOT_IMPLEMENTED` | 아직 TODO인 기능 |
| 502 | `LLM_ERROR` | Gemini 호출 실패 (무료 등급 한도 초과 포함) |

### 주요 값(enum)

| 이름 | 값 |
| --- | --- |
| 보관 위치 `StorageType` | `FRIDGE` 냉장 · `FREEZER` 냉동 · `ROOM` 실온 |
| 등록 경로 `RegisterSource` | `PRESET` · `MANUAL` · `PHOTO` |
| 알림 종류 `ReminderCategory` | `LAUNDRY` 세탁 · `CLEANING` 청소 · `BILL` 공과금 · `ETC` |
| 반복 `RepeatType` | `DAILY` · `WEEKLY`(weekdays: 0=월~6=일) · `MONTHLY`(day_of_month) |
| 난이도 `Difficulty` | `EASY` · `NORMAL` · `HARD` |

---

## ✍️ 코드 작성 규칙

### 1. 공통 모듈 (`common/db`, `common/llm`)

- **담당자 외 수정 금지.** 기능 코드는 import해서 쓰기만 합니다. 수정이 필요하면 담당자에게 요청하거나 이슈를 남겨주세요.
- **LLM은 `app.common.llm`으로만 호출**합니다. 기능 코드에서 `from google import genai` 금지. (나중에 공급자를 바꿔도 이 파일만 고치면 됨)
  ```python
  from pydantic import BaseModel
  from app.common.llm import generate_structured

  class Result(BaseModel):
      titles: list[str]

  result = generate_structured(Result, "두부로 만들 수 있는 요리 3개", images=[(image_bytes, "image/jpeg")])
  ```
  응답은 Pydantic 모델로 검증돼서 돌아오고, 실패하면 `LLMError`(502)가 납니다.

### 2. 기능 사이 의존 규칙

- 다른 기능의 **service 공개 함수**만 호출합니다. 다른 기능의 테이블을 직접 쿼리하거나 수정하지 않아요.
  ```python
  # ✅ 좋음
  from app.features.ingredients import service as ingredients
  active = ingredients.list_active(db, user.id)

  # ❌ 나쁨 — ingredients 담당자가 모델을 바꾸면 깨짐
  db.scalars(select(Ingredient).where(...))
  ```
- **XP는 무조건 `gamification.service.award_xp()`로만** 바꿉니다. XP 수치는 `gamification/rules.py` 한 곳에서 관리해요.
- 현재 공개 함수: `ingredients.list_active`, `ingredients.consume_ingredients`(요리 완료 시 재료 소진), `ingredients.deduct_ingredients`(수량 차감), `ingredients.find_preset_by_name`, `users.get_owned_seasoning_names`, `reminders.list_enabled`, `gamification.award_xp` / `evaluate_badges` / `get_level_summary`

### 3. 레이어 규칙

- `router.py`: 입력을 받아 service를 부르는 것까지만. 로직을 넣지 않아요.
- `service.py`: 로직 + `db.commit()`. 에러는 `app.common.exceptions`의 `NotFoundError`, `ValidationError` 등을 raise.
- 요청한 사용자는 `user: CurrentUser`, DB는 `db: DbSession`으로 받습니다 (`app.common.deps`).

### 4. 날짜 · 시간

- `datetime.now()` 대신 **`app.common.time`의 `now()`, `today()`, `d_day()`**를 씁니다 (서버가 어디 있든 KST 기준).

### 5. 새 기능 추가 순서

1. `app/features/<이름>/`에 `__init__.py`, `router.py`, `schemas.py`, `service.py` (+ `models.py`) 만들기
2. 모델이 있으면 `app/models.py`에 import 추가
3. `app/main.py`의 라우터 목록에 추가
4. `tests/test_<이름>.py` 작성

### 6. DB 스키마 변경

지금은 서버 시작 때 `create_all`로 테이블을 만듭니다. **이미 있는 테이블에 컬럼을 추가/변경하면 반영되지 않아요.**
→ 모델을 바꿨다면 로컬에서 `rm bangguseok.db` 후 서버를 재시작하고, PR 설명에 "DB 삭제 필요"라고 적어주세요.
(PostgreSQL로 전환할 때 Alembic 마이그레이션을 도입합니다.)

---

## 🌿 협업 규칙 (Git)

루트 `README.md`의 브랜치 전략을 따릅니다.

| 브랜치 | 용도 |
| --- | --- |
| `main` | 완성본. 직접 push 금지 |
| `backend` | 백엔드 작업 브랜치. **`backend/` 폴더만 수정** |

```bash
git checkout backend
git pull origin backend                         # 1. 작업 전 최신 상태 받기
# ... 작업 ...
ruff check . --fix && ruff format . && pytest   # 2. 린트 + 테스트 (backend/ 에서)
git add backend
git commit -m "feat(recipes): 임박 재료 우선 추천 알고리즘 구현"
git push origin backend                         # 3. push → GitHub에서 main으로 PR, 리뷰 1명 승인 후 머지
```

- 백엔드 2명이 같은 `backend` 브랜치를 쓰므로 **자주 pull, 작게 커밋**하세요. push가 거절되면 `git pull --rebase origin backend` 후 다시 push.
- 서로 다른 기능 폴더만 만지면 충돌이 거의 없어요. `common/`, `main.py`, `models.py`, `requirements.txt` 같은 공용 파일은 바꾸기 전에 한마디 해주기.
- 커밋 메시지: `<타입>(<기능>): <내용>` — 타입은 `feat` · `fix` · `refactor` · `test` · `docs` · `chore`
  ```
  feat(recipes): 레시피 추천 필터(조리시간, 인분) 적용
  fix(reminders): 2주 반복 알림 다음 날짜 계산 오류 수정
  ```
- `.env`는 커밋 금지. 새 환경 변수를 추가하면 `.env.example`에도 추가.

---

## ❓ 자주 묻는 것

**Q. 서버는 켜지는데 테이블 구조가 이상해요 / 컬럼이 없대요.**
→ `rm bangguseok.db` 후 재시작. (모델 변경이 기존 DB에 반영되지 않아서예요.)

**Q. 레시피 · 프리셋 데이터를 바꾸고 싶어요.**
→ `app/seeds/data.py` 수정 → `rm bangguseok.db` → 재시작.

**Q. 레시피 추천은 어떻게 동작해요?**
→ `app/features/recipes/service.py`의 `recommend()`
1. 내 냉장고 재료 + 기본 양념으로 레시피마다 부족 재료를 계산 (대체재가 있으면 가진 걸로, 선택 재료는 제외)
2. 부족 0개 → `ready`(바로 가능), 1~2개 → `almost`, 3개 이상이거나 내 재료를 하나도 안 쓰면 제외
3. 정렬: 임박 재료를 많이 쓸수록 → 더 급한 재료를 쓸수록 → 부족한 게 적을수록 → 빨리 만들수록
4. 결과가 `AI_RECIPE_MIN_RESULTS`(기본 3)개보다 적으면 **Gemini가 내 재료로 레시피를 만들어 DB에 저장**하고 다시 추천 (`source=AI`, 다른 사용자도 재사용)
   - 홈 화면의 '오늘의 추천 레시피'는 빨리 떠야 해서 AI 생성 없이 추천만 해요
   - Gemini 호출이 실패해도(한도 초과 등) 추천은 기존 레시피로 정상 응답

**Q. 레시피 재료 양을 인분별로 어떻게 저장해요?**
→ `recipe_ingredients`에 1인분 기준 `quantity`(0.5) + `unit`(모)로 저장하고, `GET /recipes/{id}?servings=3`이면 3배 해서 `"1과 1/2모"`처럼 보여줘요. `quantity`가 없으면(`약간`, `적당량`) 그대로 표시.

**Q. 실제 Gemini로 사진 인식 · 레시피 생성을 테스트하려면?**
→ `.env`에 `AI_MOCK=false`, `GEMINI_API_KEY=...` 설정 후 (키는 https://aistudio.google.com/apikey 에서 무료 발급) Swagger에서 `/vision/recognize`에 사진 업로드, 또는 레시피에 잘 안 나오는 재료(예: 고추)만 등록하고 `/recipes/recommendations` 호출.
`AI_MOCK=true`(기본)면 레시피 생성도 가짜("<재료> 볶음")로 만들어져요. 모델은 `LLM_MODEL`(기본 `gemini-3.8-flash`)로 바꿀 수 있어요.

**Q. Gemini 무료 등급 주의사항은?**
- 결제 등록 없이 무료로 쓸 수 있지만 **분당·하루 호출 수 한도**가 있어요 (정확한 수치는 AI Studio에서 확인). 넘으면 429 → `LLM_ERROR`
- 무료 등급은 **보낸 내용(냉장고 사진, 재료 목록)이 Google 제품 개선에 사용**될 수 있어요. 실제 서비스로 운영하면 유료 등급 전환을 검토하세요.
- 한도를 아끼려고 개발 중엔 `AI_MOCK=true`로 두는 걸 추천해요.

**Q. 푸시 알림 잡을 로컬에서 돌려보려면?**
→ `.env`에 `SCHEDULER_ENABLED=true`. 지금은 `LoggingPushSender`라서 실제 발송 없이 로그만 찍혀요.

---

## 📝 기획 확정이 필요한 것 (백엔드 관점)

- [x] XP 수치: 요리 완료 10 + 유통기한 내 소진 보너스 10 = 20, 사진 등록 15, 집안일 5 (`gamification/rules.py`) — 확정
- [x] 레벨 구간 · 칭호: Lv.1 0 / Lv.2 100 / Lv.3 200 / Lv.4 390 / Lv.5 600 / Lv.6 900 XP (`gamification/rules.py`의 `LEVELS`) — 확정
- [ ] "연속 기록"을 이어주는 행동: 지금은 **XP를 받는 모든 활동**(요리 완료 · 사진 등록 · 집안일 완료)
- [ ] 요리 완료 시 재료를 **통째로 소진**할지 **수량만 차감**할지
- [ ] 절약 추정 식비: 지금은 보너스 받은 요리의 **임박 재료값 합계** (`rules.py`의 `INGREDIENT_PRICES`, 없는 재료 2,300원)
