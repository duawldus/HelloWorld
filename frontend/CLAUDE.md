# 방구석 매니저 — 프론트엔드 (frontend/)

자취생 냉장고 관리 + 레시피 추천 앱의 Expo 앱. 답변과 문서는 한국어로 쓴다.

## 규칙
- **Expo + JavaScript** 사용. TypeScript(.ts/.tsx)는 쓰지 않는다. (루트 CLAUDE.md의 "TypeScript"보다 이 규칙이 우선: 팀 결정으로 JavaScript로 변경)
- **데이터 코드는 한 곳에**: 재료·레시피·알림·XP 등 데이터와 데이터를 다루는 코드는 `src/data/`에만 둔다. 화면에서는 `src/data/index.js`(`../data`)로만 가져다 쓴다. 사용법은 `USAGE.md`
- **저장/불러오기는 `src/data/storage.js` 한 파일에서만** 한다. 지금은 AsyncStorage, 나중에 백엔드 API로 이 파일만 바꾼다. 모든 데이터 함수는 async
- **색상은 테마 파일에서만**: `src/theme/colors.js`에만 색 코드를 쓴다. 다른 파일은 `colors.primary`처럼 불러서 쓰고 `'#4a5ae8'` 같은 색 코드를 직접 쓰지 않는다
- 아이콘은 이모지 대신 선 아이콘(react-native-svg)을 쓰고 `src/components/Icons.js`에 모은다

## Git
- `frontend` 브랜치에서만 작업하고 `frontend/` 폴더만 수정한다. `main`에는 push 하지 않는다 (PR로 머지)
- `backend/`, `docs/`, 루트의 `CLAUDE.md`·`README.md`·`.gitignore`는 수정하지 않는다

## 구조
- `src/app/`: 화면 경로 (expo-router). 파일 하나가 화면 하나이고, `_layout.js`는 화면 틀
  - `_layout.js`: 앱 전체 틀 (웹에서는 가운데 휴대폰 모양 틀)
  - `(tabs)/_layout.js`: 하단 탭바 (홈/냉장고/레시피/생활알림)
  - `(tabs)/fridge/`: 냉장고 탭 안의 화면들 (`index.js` 목록, `add.js` 재료 추가)
- `src/screens/`: 실제 화면 코드. `src/app/`의 파일은 여기 화면을 연결만 한다
- `src/components/`: 여러 화면이 같이 쓰는 부품 (`Screen.js` 바탕·제목, `Icons.js` 아이콘)
- `src/theme/colors.js`: 공통 색상
- `src/data/`: 앱 데이터
  - `rules.js`: XP·레벨·뱃지 규칙 / `presets.js`: 재료 프리셋 / `dummyData.js`: 처음 시작 데이터
  - 더미 데이터를 바꾸면 `storage.js`의 `DATA_VERSION`을 1 올린다 (예전 데이터가 새 더미로 초기화됨)
  - `KEEP_DATES_FROM_TODAY = true`: 저장된 날짜를 매일 오늘 기준으로 옮겨 D-day가 항상 같게 보임 (발표용, 실제 서비스에선 false)

## 화면 이동
- `import { router } from 'expo-router'` 후 `router.push('/fridge/add')`, 뒤로는 `router.back()`
- 화면이 다시 보일 때 데이터를 새로 불러오려면 `useFocusEffect`를 쓴다 (`FridgeScreen.js` 참고)

## 명령어 (frontend/ 폴더에서)
- `npx expo start`: 개발 서버 (폰은 Expo Go 앱으로 QR 스캔, 브라우저는 `w` 키)
- `npx expo start --web`: 웹 브라우저로 바로 열기
- `npx expo install <패키지>`: 패키지 설치는 npm install 대신 항상 이것으로 (SDK에 맞는 버전 설치)
- `npx expo-doctor`: 설정·패키지 버전 문제 검사

## Expo 주의
- Expo SDK 57. Expo는 버전마다 API가 바뀌므로 코드를 쓰기 전에 `https://docs.expo.dev/versions/v57.0.0/` 문서를 확인한다
- `ios/`, `android/` 폴더는 직접 만들거나 고치지 않는다. 네이티브 설정은 `app.json`에서 한다
