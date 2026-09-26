# 방구석 매니저 — 프론트엔드 (frontend/)

자취생 냉장고 관리 + 레시피 추천 앱의 Expo 앱. 답변과 문서는 한국어로 쓴다.

## 규칙
- **Expo + JavaScript** 사용. TypeScript(.ts/.tsx)는 쓰지 않는다. (루트 CLAUDE.md의 "TypeScript"보다 이 규칙이 우선: 팀 결정으로 JavaScript로 변경)
- **데이터 코드는 한 곳에**: 재료·레시피·알림·XP 등 데이터와 데이터를 다루는 코드는 `src/data/`에만 둔다. 화면에서는 `src/data/index.js`(`../data`)로만 가져다 쓴다. 사용법은 `USAGE.md`
- **가짜 모드 / 서버 모드**: `src/data/config.js`의 `DATA_MODE`(`'mock'` 기본 / `'server'`) 한 줄로 바꾼다. 두 모드는 같은 이름·모양의 함수를 내보내서 화면 코드는 모드를 모른다. 모든 데이터 함수는 async이고 실패하면 에러를 던진다
- **데이터 모양은 백엔드 API 응답 그대로** (`backend` 브랜치의 `backend/README.md`, `schemas.py`가 기준): `id`는 숫자, `expires_on`·`d_day`·`is_imminent` 같은 snake_case, 보관 위치는 `FRIDGE`/`FREEZER`/`ROOM`로 저장하고 화면에는 `storageLabel()`로 냉장/냉동/실온을 보여 준다
- **백엔드에 없는 API**는 `BACKEND_REQUESTS.md`에 요청서로 정리하고, 서버 모드에서는 안내 에러를 낸다 (예: 소진 `CAN_CONSUME`)
- **저장/통신은 두 파일에서만**: 가짜 모드는 `src/data/mock/storage.js`(AsyncStorage), 서버 모드는 `src/data/server/api.js`(fetch + 게스트 로그인 토큰)
- **색상은 테마 파일에서만**: `src/theme/colors.js`에만 색 코드를 쓴다. 다른 파일은 `colors.primary`처럼 불러서 쓰고 `'#4a5ae8'` 같은 색 코드를 직접 쓰지 않는다
- 아이콘은 이모지 대신 선 아이콘(react-native-svg)을 쓰고 `src/components/Icons.js`에 모은다

## Git
- `frontend` 브랜치에서만 작업하고 `frontend/` 폴더만 수정한다. `main`에는 push 하지 않는다 (PR로 머지)
- `backend/`, `docs/`, 루트의 `CLAUDE.md`·`README.md`·`.gitignore`는 수정하지 않는다

## 구조
- `src/app/`: 화면 경로 (expo-router). 파일 하나가 화면 하나이고, `_layout.js`는 화면 틀
  - `_layout.js`: 앱 전체 틀 (웹에서는 가운데 휴대폰 모양 틀)
  - `(tabs)/_layout.js`: 하단 탭바 (홈/냉장고/레시피/생활알림)
  - `(tabs)/`: 탭바가 보이는 화면 (`index.js` 홈, `fridge.js` 냉장고, `recipe.js`, `alert.js`)
  - `ingredient/`: 탭바 없는 하위 화면 (`add.js` 식재료 추가, `form.js` 직접 입력·수정, `photo.js` 사진으로 등록, `review.js` 인식 결과 확인)
- `src/screens/`: 실제 화면 코드. `src/app/`의 파일은 여기 화면을 연결만 한다
- `src/components/`: 여러 화면이 같이 쓰는 부품 (`Screen.js` 바탕·제목·뒤로 가기 헤더, `SearchBar.js` 검색창, `Toast.js` 아래 알림, `FormFields.js` 입력칸·칩·유통기한 선택, `BottomSheet.js` 아래에서 올라오는 창, `Icons.js` 아이콘)
- `src/theme/colors.js`: 공통 색상
- `src/data/`: 앱 데이터
  - `config.js`: 모드 스위치(`DATA_MODE`)와 백엔드 주소(`API_BASE_URL`, 폰은 PC IP)
  - `index.js`: 화면이 가져다 쓰는 입구. 모드에 따라 `mock/` 또는 `server/` 구현을 연결
  - `utils.js`: 두 모드 공통 도구 (날짜, `storageLabel`, `matchesName`)
  - `server/`: 서버 모드. `api.js`(통신·토큰·에러), `index.js`(API별 함수)
  - `mock/`: 가짜 모드. 백엔드와 똑같이 동작하도록 흉내 냄
    - `rules.js`(XP·레벨·뱃지·임박·인식 기준), `presets.js`(재료 프리셋): 백엔드 `gamification/rules.py`, `seeds/data.py`와 같은 값으로 유지한다. 가짜 모드에서만 쓴다
    - `dummyData.js`: 처음 시작 데이터. 바꾸면 `mock/storage.js`의 `DATA_VERSION`을 1 올린다 (예전 데이터가 새 더미로 초기화됨)
    - `KEEP_DATES_FROM_TODAY = true`(`mock/storage.js`): 저장된 날짜를 매일 오늘 기준으로 옮겨 D-day가 항상 같게 보임 (발표용)

## 화면 이동
- `import { router } from 'expo-router'` 후 `router.push('/ingredient/add')`, 뒤로는 `router.back()`
- 탭바를 숨길 하위 화면은 `(tabs)/` 밖(예: `ingredient/`)에 두고, `<Screen edges={['top', 'bottom']}>` + `<BackHeader title="..." />`를 쓴다
- 화면이 다시 보일 때 데이터를 새로 불러오려면 `useFocusEffect`를 쓴다 (`FridgeScreen.js` 참고)

## 명령어 (frontend/ 폴더에서)
- `npx expo start`: 개발 서버 (폰은 Expo Go 앱으로 QR 스캔, 브라우저는 `w` 키)
- `npx expo start --web`: 웹 브라우저로 바로 열기
- `npx expo install <패키지>`: 패키지 설치는 npm install 대신 항상 이것으로 (SDK에 맞는 버전 설치)
- `npx expo-doctor`: 설정·패키지 버전 문제 검사

## Expo 주의
- Expo SDK 57. Expo는 버전마다 API가 바뀌므로 코드를 쓰기 전에 `https://docs.expo.dev/versions/v57.0.0/` 문서를 확인한다
- `ios/`, `android/` 폴더는 직접 만들거나 고치지 않는다. 네이티브 설정은 `app.json`에서 한다
