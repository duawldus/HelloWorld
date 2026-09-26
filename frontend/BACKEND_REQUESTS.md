# 백엔드 API 요청서 (프론트엔드 → 백엔드)

프론트에서 필요한데 아직 백엔드(`backend` 브랜치)에 없는 API를 정리했어요.
만들어 주시면 프론트는 `frontend/src/data/server/index.js`의 표시된 부분만 바꾸면 돼요.

---

## 1. 재료 소진 API ("다 먹었어요")

### 왜 필요한가요?
냉장고 화면에서 재료 카드를 누르면 **수정 / 다 먹었어요 / 버렸어요** 메뉴가 나와요.

| 버튼 | 백엔드 처리 | 상태 |
| --- | --- | --- |
| 수정 | `PATCH /ingredients/{id}` | ✅ 있음 |
| 버렸어요 | `DELETE /ingredients/{id}` → `DISCARDED`(폐기) | ✅ 있음 |
| 다 먹었어요 | 재료 하나를 `CONSUMED`(소진)로 바꾸는 API | ❌ **없음** |

지금 `CONSUMED`는 레시피 요리 완료(`POST /recipes/{id}/complete`, 아직 501)로만 바뀌어요.
요리하지 않고 그냥 먹은 재료(우유, 요거트 등)를 "폐기"와 구분해서 기록하려면 소진 API가 필요해요.

### 제안하는 모양

```
POST /api/v1/ingredients/{ingredient_id}/consume
Authorization: Bearer <token>
(본문 없음)
```

- 동작: 내 재료이고 `ACTIVE`일 때 `status = CONSUMED`, `consumed_at = now()`
- 성공: `200` + `IngredientRead` (바뀐 재료, `status: "CONSUMED"`)
- 실패: 없는 재료 / 남의 재료 / 이미 소진·폐기된 재료 → `404 NOT_FOUND` (지금 `get_owned`와 같게)
- **XP와 '제때 소진' 통계는 주지 않아요.** (프론트·기획 결정: 제때 소진은 지금처럼 요리 완료 보너스로만 셈)

### 참고: 되돌리기(복구) API는 필요 없어요
"다 먹었어요"와 "버렸어요"를 누르면 프론트가 화면에서 먼저 빼고, **3초 동안 되돌리기를 기다린 뒤에** 요청을 보내요.
되돌리기를 누르면 요청 자체를 보내지 않아서 백엔드에 복구 API는 없어도 돼요.

### 프론트 연결 방법 (API가 생기면)
`frontend/src/data/server/index.js`:

```js
export const CAN_CONSUME = true
export function consumeIngredient(id) {
  return request(`/ingredients/${id}/consume`, { method: 'POST' })
}
```

그 전까지 서버 모드에서 "다 먹었어요"를 누르면 "아직 서버에 준비되지 않은 기능이에요" 안내가 떠요. (가짜 모드는 동작)
