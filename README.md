# 자취생 냉장고·생활 관리 앱

자취생을 위한 냉장고 관리 및 자취생활 관리 모바일 앱입니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | React Native + Expo (TypeScript) |
| 백엔드 | FastAPI (Python), SQLAlchemy + Alembic |
| DB | PostgreSQL |
| LLM | Claude API (공통 모듈로 감싸서 사용) |
| 로그인 | 카카오·구글 소셜 로그인 + JWT |
| 알림 | Expo Push |

## 폴더 구조

```
.
├── frontend/                 # Expo 앱
├── backend/
│   └── app/
│       ├── common/
│       │   ├── db/           # DB 공통 모듈 (담당자 외 수정 금지)
│       │   └── llm/          # Claude API 공통 모듈 (담당자 외 수정 금지)
│       └── features/         # 기능별 코드
└── docs/                     # 기획서, 와이어프레임, API 명세, ERD
```

## 팀 구성

- 프론트엔드 2명
- 백엔드 2명

## 브랜치 전략

| 브랜치 | 용도 |
| --- | --- |
| `main` | 완성본. 직접 push 금지 |
| `frontend` | 프론트엔드 작업 (`frontend/` 폴더) |
| `backend` | 백엔드 작업 (`backend/` 폴더) |

### 작업 흐름

1. 내 영역 브랜치(`frontend` 또는 `backend`)로 이동해 최신 상태를 받는다.
2. 작업 후 커밋·push한다.
3. GitHub에서 `main`으로 PR을 올리고, 리뷰어 1명 이상 승인 후 머지한다.

```bash
git checkout frontend        # 백엔드는 backend
git pull origin frontend
# 작업 후
git add .
git commit -m "작업 내용"
git push origin frontend
# GitHub에서 main으로 PR 생성
```

## 공통 모듈 규칙

`backend/app/common/db`, `backend/app/common/llm`은 여러 기능이 함께 쓰는 모듈입니다.
**담당자 외에는 임의로 수정하지 않습니다.** 변경이 필요하면 담당자에게 요청하거나 이슈를 남겨주세요.

## 문서

기획서, 와이어프레임, API 명세, ERD는 `docs/`에 둡니다.
