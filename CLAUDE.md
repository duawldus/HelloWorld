# CLAUDE.md

자취생을 위한 냉장고 관리·자취생활 관리 모바일 앱. 팀: 프론트엔드 2명, 백엔드 2명.
답변과 문서는 한국어로 작성한다.

## 스택

- 프론트엔드: React Native + Expo (TypeScript)
- 백엔드: FastAPI (Python), SQLAlchemy + Alembic
- DB: PostgreSQL
- LLM: Claude API — 반드시 `backend/app/common/llm` 공통 모듈을 통해서만 호출한다. 기능 코드에서 Anthropic SDK를 직접 호출하지 않는다.
- 로그인: 카카오·구글 소셜 로그인 + JWT
- 알림: Expo Push

## 폴더 구조

- `frontend/` : Expo 앱
- `backend/app/common/db` : DB 공통 모듈 (세션, Base 등)
- `backend/app/common/llm` : Claude API 공통 모듈
- `backend/app/features/` : 기능별 코드 (기능 하나당 하위 폴더 하나)
- `docs/` : 기획서, 와이어프레임, API 명세, ERD

## 공통 모듈 수정 금지 규칙

- `backend/app/common/db`, `backend/app/common/llm` 아래 파일은 담당자 외에는 수정하지 않는다.
- 작업 중 공통 모듈 수정이 필요해 보이면 **수정하지 말고** 사용자에게 먼저 알린다. (담당자에게 요청/이슈로 처리)
- 기능 코드는 공통 모듈을 import해서 쓰기만 한다.

## Git 규칙

- `main`: 완성본. 직접 push 금지 (초기 세팅 커밋만 예외였음).
- `frontend`: 프론트엔드 작업 브랜치. `frontend/` 폴더만 수정한다.
- `backend`: 백엔드 작업 브랜치. `backend/` 폴더만 수정한다.
- `frontend`, `backend`에서 `main`으로 PR → 리뷰 1명 이상 승인 후 머지.
- 작업 전 `git pull`로 최신 상태를 받고, 현재 브랜치를 확인한다. `main`에 직접 커밋·push하지 않는다.
- `.env` 등 비밀키는 커밋하지 않는다. 필요한 키 목록은 `.env.example`로 공유한다.
