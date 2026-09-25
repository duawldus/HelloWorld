# 🏠 방구석 매니저 — Backend

> 자취생이 냉장고 재료를 빠르게 등록하고, **유통기한 임박 재료부터 소진하는 맞춤 레시피**를 추천받아 실제 요리까지 이어지게 돕는 서비스.
> 청소 · 빨래 · 공과금 같은 **생활 루틴 알림**과 **레벨 · 뱃지**로 꾸준한 사용을 유도합니다.

- 와이어프레임: https://claude.ai/artifact/DAF8NvnekfBwcPBf7xCVKT
- 기획안(Notion): https://app.notion.com/p/IDLE-3e35a77378fe8001a701e568e433f90b
- 팀 공통 규칙: 루트의 [`CLAUDE.md`](../CLAUDE.md), [`README.md`](../README.md)

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
| LLM | Claude API (`anthropic` SDK) — `app/common/llm`을 통해서만 호출 |
| 인증 | 기기 ID 기반 게스트 로그인 + JWT (카카오·구글 소셜 로그인은 TODO) |
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
- 서버가 처음 뜰 때 테이블 생성 + 기본 데이터(양념 12종, 재료 프리셋 27종, 레시피 7개, 뱃지 6개)가 자동으로 들어갑니다.

### Swagger에서 인증하기

1. `POST /api/v1/auth/guest`에 `{"device_id": "my-test-device-01"}` 전송
2. 응답의 `access_token` 복사
3. 오른쪽 위 **Authorize** 버튼 → 토큰 붙여넣기

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
│   │   ├── llm/              # 🔒 Claude API 공통 모듈 — 담당자 외 수정 금지
│   │   ├── config.py         #   환경 변수 설정
│   │   ├── deps.py           #   DbSession, CurrentUser 의존성
│   │   ├── security.py       #   JWT
│   │   ├── exceptions.py     #   공통 예외 → {"code", "message"} 응답
│   │   ├── time.py           #   now(), today(), d_day() — 항상 KST
│   │   ├── models.py         #   created_at / updated_at 믹스인
│   │   └── schemas.py        #   ORMModel 등
│   ├── features/             # 🧩 기능별 코드 (기능 하나당 폴더 하나)
│   │   ├── auth/             #   게스트 로그인
│   │   ├── users/            #   내 정보, 기본 양념(온보딩)
│   │   ├── home/             #   홈 대시보드 (다른 기능 조합)
│   │   ├── ingredients/      #   냉장고 재료, 프리셋
│   │   ├── vision/           #   AI 사진 인식 (Claude)
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
| `auth` | 최초 진입 | | ✅ | **카카오·구글 소셜 로그인** (지금은 게스트 로그인) |
| `users` | 0 온보딩 · 기본 양념 | | ✅ | |
| `ingredients` | 2 냉장고, 3 식재료 추가 | | ✅ | 재료명 동의어 매칭 (`파`→`대파`) |
| `vision` | 3-1 사진 촬영, 3-2 인식 결과 | | 🚧 | Claude 연동 코드는 있음 → **실제 사진으로 프롬프트 튜닝**, 중복 인식 합치기 |
| `recipes` | 4 레시피 추천, 5 레시피 상세 | | 🚧 | **추천 알고리즘**, **요리 완료(재료 소진 + XP)**, **실행 취소** |
| `reminders` | 6 생활 알림, 7 알림 추가 | | ✅ | 같은 회차 중복 완료 방지 |
| `gamification` | 8 성과 · 뱃지 | | 🚧 | **연속 기록(streak) 갱신**, **뱃지 지급**, 절약 식비 계산 |
| `home` | 1 홈 대시보드 | | ✅ | recipes 추천 완성되면 `_today_recipe`의 try 제거 |
| `notifications` | 9 푸시 알림 | | 🚧 | **유통기한/생활 알림 발송 잡** (`jobs.py`), **Expo Push 연동** (`sender.py`) |

- 아직 구현 안 된 기능은 `raise NotImplementedError` → API가 **501**을 돌려줍니다. 요청/응답 스키마는 이미 정의돼 있어서 **프론트는 Swagger 보고 먼저 붙일 수 있어요.**
- 코드에서 할 일 찾기: `grep -rn "TODO(" app/` → `TODO(recipes)`처럼 기능 이름이 붙어 있습니다.
- 사진 인식은 `.env`의 `AI_MOCK=true`(기본값)면 Claude를 호출하지 않고 와이어프레임과 같은 가짜 결과(두부 98%, 계란 95%, 대파 72%)를 돌려줍니다. **API 비용 0원.**

### 추천 분담 예시 (백엔드 2명)

| A | B |
| --- | --- |
| `ingredients`, `vision`, `recipes` (냉장고 → 레시피 흐름) | `reminders`, `notifications`, `gamification`, `home` (알림 · 성과 흐름) |

---

## 📡 API 목록

모든 경로 앞에 `/api/v1`이 붙고, `auth/guest`를 뺀 전부 `Authorization: Bearer <token>`이 필요합니다.

| 기능 | Method | Path | 설명 | 상태 |
| --- | --- | --- | --- | --- |
| auth | POST | `/auth/guest` | 기기 ID로 로그인/가입 → 토큰 | ✅ |
| users | GET | `/users/me` | 내 정보 | ✅ |
| | PATCH | `/users/me` | 닉네임 수정 | ✅ |
| | GET | `/users/me/seasonings` | 기본 양념 목록 + 보유 여부 | ✅ |
| | PUT | `/users/me/seasonings` | 보유 양념 저장 (온보딩 완료 처리) | ✅ |
| home | GET | `/home` | 홈 대시보드 한 번에 | ✅ |
| ingredients | GET | `/ingredients/presets?frequent=&q=` | 자주 쓰는 재료 / 재료 검색 | ✅ |
| | GET | `/ingredients?storage=` | 내 냉장고 (임박순, 보관위치 필터) | ✅ |
| | POST | `/ingredients?source=` | 재료 1개 등록 (유통기한 자동) | ✅ |
| | POST | `/ingredients/batch` | 여러 개 일괄 등록 (사진이면 +15 XP) | ✅ |
| | GET / PATCH / DELETE | `/ingredients/{id}` | 조회 / 수정 / 삭제 | ✅ |
| vision | POST | `/vision/recognize` | 사진 → 재료 후보 + 신뢰도 (multipart `image`) | ✅ (튜닝 TODO) |
| recipes | GET | `/recipes/recommendations` | 추천 (바로 가능 / 1~2개 부족) | 🚧 |
| | GET | `/recipes/{id}` | 상세 (보유/부족/대체재 체크리스트, 조리 순서) | ✅ |
| | POST | `/recipes/{id}/complete` | 요리 완료 → 재료 소진 + XP | 🚧 |
| | POST | `/recipes/cook-logs/{id}/undo` | 요리 완료 실행 취소 | 🚧 |
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
| 401 | `UNAUTHORIZED` | 토큰 없음/만료 |
| 404 | `NOT_FOUND` | 없는 리소스, 남의 리소스 |
| 422 | `VALIDATION_ERROR` | 비즈니스 검증 실패 (지난 유통기한 등) |
| 422 | (FastAPI 기본) | 요청 형식 오류 → `detail` 배열 |
| 501 | `NOT_IMPLEMENTED` | 아직 TODO인 기능 |
| 502 | `LLM_ERROR` | Claude 호출 실패 |

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
- **Claude는 `app.common.llm`으로만 호출**합니다. 기능 코드에서 `import anthropic` 금지.
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
- 현재 공개 함수: `ingredients.list_active`, `ingredients.find_preset_by_name`, `users.get_owned_seasoning_names`, `reminders.list_enabled`, `gamification.award_xp` / `evaluate_badges` / `get_level_summary`

### 3. 레이어 규칙

- `router.py`: 입력을 받아 service를 부르는 것까지만. 로직을 넣지 않아요.
- `service.py`: 로직 + `db.commit()`. 에러는 `app.common.exceptions`의 `NotFoundError`, `ValidationError` 등을 raise.
- 로그인한 사용자는 `user: CurrentUser`, DB는 `db: DbSession`으로 받습니다 (`app.common.deps`).

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

**Q. 추천 API가 501을 줘요.**
→ 아직 TODO입니다. `app/features/recipes/service.py`의 `recommend()` docstring에 구현 순서가 정리돼 있어요.

**Q. 실제 Claude로 사진 인식을 테스트하려면?**
→ `.env`에 `AI_MOCK=false`, `ANTHROPIC_API_KEY=...` 설정 후 Swagger에서 `/vision/recognize`에 사진 업로드. 모델은 `LLM_MODEL`(기본 `claude-opus-5`)로 바꿀 수 있어요. 호출할 때마다 API 비용이 나가니 평소엔 `AI_MOCK=true`로 두세요.

**Q. 푸시 알림 잡을 로컬에서 돌려보려면?**
→ `.env`에 `SCHEDULER_ENABLED=true`. 지금은 `LoggingPushSender`라서 실제 발송 없이 로그만 찍혀요.

---

## 📝 기획 확정이 필요한 것 (백엔드 관점)

- [ ] XP 수치: 지금은 요리 완료 10 + 유통기한 내 소진 보너스 10 = 20, 사진 등록 15, 집안일 5 (`gamification/rules.py`)
- [ ] 레벨 구간 · 칭호 (`gamification/rules.py`의 `LEVELS`)
- [ ] "연속 기록"을 이어주는 행동이 무엇인지 (요리만? 재료 등록·집안일 포함?)
- [ ] 요리 완료 시 재료를 **통째로 소진**할지 **수량만 차감**할지
- [ ] 레시피: 자체 큐레이션(지금 7개 → 목표 20~30개)만 쓸지, Claude 실시간 생성도 할지
- [ ] 절약 추정 식비 계산 기준 (지금은 1회당 2,300원 가정)
- [ ] 사진 인식 모델: 비용을 줄이려면 `LLM_MODEL`을 더 저렴한 모델로 바꿀지
