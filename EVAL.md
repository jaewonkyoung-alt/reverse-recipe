---
## 평가일: 2026-08-28 (사이클 1)

이전 평가(2026-07-01) 이후 사이클 2·3에서 쇼핑 가격비교 500 에러, `requireAuth` 미적용, CORS ngrok 와일드카드, 401 인터셉터의 세션 정리 누락 4건이 실제로 수정된 것을 코드로 확인했다. 이번 사이클은 프론트엔드 전체 페이지/컴포넌트와 백엔드 전체 라우트/서비스/DB 계층을 다시 처음부터 읽고 새로 평가한다.

### 종합 점수
| 항목 | 점수 | 비고 |
|------|------|------|
| UI/UX | 7/10 | 지난 평가와 동일 — 죽은 설정 버튼, 브랜드 컬러 이탈, 중복 프로필 페이지 모두 미해결 |
| 보안 | 5/10 | 인증 강제·CORS는 고쳐졌으나 게스트 계정이 전 세계 모든 게스트 사용자와 공유되는 더 심각한 결함을 발견 |
| AI 레시피 품질 | 6/10 | 지난 평가와 동일 — 가짜 칼로리 수치 노출 미해결 |
| 출시 준비도 | 5/10 | 핵심 크래시(가격비교) 해소로 소폭 상승, 게스트 계정 공유·docker-compose 불일치·미사용 라우트의 스키마 크래시가 여전히 발목 |
| 기능 완성도 | 8/10 | 가격비교·세션 만료 버그 해소로 핵심 플로우 안정성 향상 |
| **종합** | **6.2/10** | |

### 시급한 개선 필요 (P1)
1. **모든 게스트 사용자가 동일한 계정을 공유 — 사실상 전역 공용 냉장고** - `backend/src/routes/auth.ts:90-98` - `POST /api/auth/guest`가 매번 하드코딩된 고정 UUID(`00000000-0000-0000-0000-000000000001`)로 토큰을 발급한다. "게스트로 시작하기" 버튼을 누른 모든 기기·모든 사용자가 DB상 동일한 `user_id`로 귀결되므로, 한 사람이 넣은 냉장고 재료·저장한 레시피·그린포인트·쇼핑리스트가 전혀 모르는 다른 게스트 사용자에게 그대로 보이거나 그 사용자가 지우고 바꿀 수 있다. `backend/src/db/index.ts:98-104`의 시드 데이터도 이 계정을 미리 만들어 둔다. 랜딩 페이지 카피(`HomePage.tsx`: "🚀 지금 바로 시작하기 (게스트)")는 개인화된 경험을 약속하지만 실제로는 다인용 공유 계정이라, 출시 시 가장 먼저 터질 개인정보 노출 이슈다. **개선 방향**: `guestLogin`에서 매 호출마다 새 UUID로 게스트 유저 행을 `INSERT`하고 그 ID로 토큰을 발급하도록 변경.
2. **JWT를 localStorage에 저장 (XSS 토큰 탈취 위험)** - `frontend/src/services/api.ts:17`, `frontend/src/store/index.ts:78` - 지난 평가에서 지적된 뒤 아직 손대지 않음. 7일짜리 accessToken이 XSS 한 번으로 탈취 가능한 상태 그대로. **개선 방향**: 서버가 httpOnly+SameSite 쿠키로 토큰을 내려주는 구조로 단계적 전환.
3. **`purchase_imports` 테이블의 실제 DB 스키마와 INSERT 컬럼이 완전히 불일치** - `backend/src/db/index.ts:76-82`(스키마: `id, user_id, store_name, items, imported_at`) vs `backend/src/routes/purchases.ts:91-97`(INSERT 대상: `user_id, platform, raw_product_name, parsed_ingredient, quantity, unit`, `id` 컬럼 자체를 넣지 않음) - `POST /api/purchases/import/mock` 호출 시 SQLite가 `no such column: platform`으로 즉시 예외를 던진다. 현재 `frontend/src/services/api.ts`에 이 엔드포인트를 호출하는 코드가 없어 사용자에게 당장 노출되진 않지만, 라우트 자체는 `backend/src/index.ts`에 이미 마운트되어 있어 누구든 직접 호출하면 500이 난다. **개선 방향**: 스키마를 라우트가 기대하는 컬럼(`platform`, `raw_product_name`, `parsed_ingredient`, `quantity`, `unit`, `id`)에 맞춰 다시 정의하거나, 미완성 기능이면 라우트를 index.ts에서 내림.

### 개선 권장 (P2)
1. **가짜 칼로리 수치 중복 구현 및 실제 정보처럼 노출** - `frontend/src/pages/RecipeDetailPage.tsx:12-20`, `frontend/src/components/RecipeCard.tsx:26-34` - 미해결. 동일한 `estimateCalories()`가 두 파일에 중복되어 있고 제목 해시 기반 의사난수를 "~580 kcal"로 노출.
2. **설정 메뉴 항목이 죽은 버튼** - `frontend/src/pages/MyRipePage.tsx:275-277`, `frontend/src/pages/ProfilePage.tsx:166-180` - 미해결. "개인정보 처리방침" 등은 플레이스토어 등록 필수 요건이라 이대로는 출시 불가.
3. **카카오톡 공유가 안내 토스트만 띄우는 미완성 기능** - `frontend/src/pages/RecipeDetailPage.tsx:173-175` - 미해결.
4. **중복 프로필 페이지 공존** - `frontend/src/pages/ProfilePage.tsx` vs `frontend/src/pages/MyRipePage.tsx` - 미해결. `App.tsx:38-39`에 둘 다 라우팅되어 있고 `Layout.tsx`의 하단 내비게이션은 `/myripe`만 가리킴.
5. **필터/카테고리 선택 색상이 브랜드 그린(`var(--primary)`)에서 이탈** - `frontend/src/pages/RecommendPage.tsx`, `frontend/src/pages/FridgePage.tsx` - 미해결. `#2563EB` 블루가 여전히 하드코딩.
6. **docker-compose.yml이 실제 런타임(SQLite)과 불일치** - `docker-compose.yml` - 미해결. Postgres 컨테이너 정의가 그대로 남아있어 배포 시 혼선 소지.

### 장기 개선 (P3)
1. 서버 측 비밀번호 정책 부재 - `backend/src/routes/auth.ts:9-16` register는 값 존재 여부만 확인, 길이·복잡도 검증 없음. 프론트(`LoginPage.tsx:80`)만 6자 이상을 강제하므로 API 직접 호출 시 우회 가능.
2. 네트워크 실패·검증 실패·서버 오류가 모두 동일한 일반 토스트로 뭉뚱그려져 원인 구분 불가 - 미해결.
3. 재료 이름·recipe_title 등 입력값의 길이/형식 서버 검증이 존재 유무 체크 수준 - 미해결.

### 시장 앱 대비 부족한 점 요약
- **토스 대비**: 토스는 실패 원인을 항상 구체적으로 보여주고 서비스 전반의 강조색을 하나로 고정하는데, 본 앱은 여전히 일반 오류 토스트와 이탈된 블루 강조색이 남아있다.
- **당근마켓 대비**: 당근마켓이라면 사용자별 데이터 격리가 당연한 전제인데, 본 앱은 게스트 로그인 자체가 전역 계정 공유 구조라 "내 냉장고"라는 개인화 경험이 실은 다인용 공용 냉장고다. 이는 UI 완성도 문제가 아니라 서비스 신뢰의 근본 전제가 깨진 것이라 최우선 수정 대상이다.
- **컬리 대비**: 가격비교 기능은 지난 사이클에서 크래시가 해소되어 실제로 동작하기 시작했다. 다만 컬리 수준의 신뢰도를 갖추려면 여전히 해시 기반 가짜 가격/칼로리 대신 실데이터 연동이 필요하다.

---

## 평가일: 2026-07-01 (사이클 1)

### 종합 점수
| 항목 | 점수 | 비고 |
|------|------|------|
| UI/UX | 7/10 | 톤/모션은 준수하나 브랜드 컬러 일관성·죽은 UI 존재 |
| 보안 | 4/10 | 인증 미들웨어가 사실상 무력화되어 있음 (가장 시급) |
| AI 레시피 품질 | 6/10 | 환각 방지 프롬프트는 양호, 가짜 칼로리 수치가 진짜처럼 노출 |
| 출시 준비도 | 4/10 | DB/배포 설정 불일치, 미완성 기능이 버튼으로 노출 |
| 기능 완성도 | 7/10 | 핵심 플로우는 안정적이나 쇼핑 가격비교가 서버 버그로 항상 실패 |
| **종합** | **5.6/10** | |

### 시급한 개선 필요 (P1)
1. **쇼핑 가격비교가 항상 500 에러로 실패** - `backend/src/routes/shopping.ts:186-191` - `/api/shopping/search`가 매 호출마다 `analytics_events` 테이블에 INSERT하지만, 실제 런타임 DB 초기화 코드인 `backend/src/db/index.ts`의 SQLite 스키마에는 해당 테이블이 없음 (`backend/src/db/migrate.ts`에만 존재하는 옛 PostgreSQL 마이그레이션이며 `migrate.ts`는 어디서도 import되지 않는 죽은 코드, `pool`이라는 존재하지 않는 export까지 import하고 있어 실행 자체가 불가능함). 결과적으로 사용자가 쇼핑 리스트 항목을 탭해 가격을 볼 때마다 서버에서 예외가 발생하고 프론트는 "가격 정보를 불러오지 못했습니다" 토스트만 보여줌 → 컬리 대비 핵심 기능인 가격비교가 출시 시점에 100% 미동작. **개선 방향**: `query()` 호출을 제거하거나, `db/index.ts`의 `db.exec()` 스키마에 `analytics_events` 테이블을 추가.

2. **인증 미들웨어가 사실상 모든 요청을 비인증으로 통과시킴** - `backend/src/middleware/auth.ts:11-19` - `authenticate()`는 `Authorization` 헤더가 없으면 에러를 내지 않고 조용히 공유 게스트 계정(`00000000-0000-0000-0000-000000000001`)으로 요청을 통과시킴. 같은 파일에 진짜 거부 로직을 가진 `requireAuth()`가 정의돼 있지만 `backend/src/index.ts`를 비롯해 어떤 라우트에서도 사용되지 않는 죽은 코드임. 즉 `/api/ingredients`, `/api/recipes`, `/api/shopping` 등 개인 데이터를 다루는 모든 라우트가 헤더 없이 호출되면 그대로 게스트 데이터를 노출/변조함. **개선 방향**: 로그인이 필수인 라우트는 `requireAuth`로 교체하거나, 최소한 게스트 폴백을 `/api/auth/guest`가 발급한 토큰에 한정.

3. **CORS 허용 목록에 개인 ngrok 터널과 와일드카드 정규식이 하드코딩됨** - `backend/src/index.ts:24-29` - `https://kaila-untempering-reconditely.ngrok-free.dev` 같은 특정 개발자의 ngrok 호스트와 `/\.ngrok-free\.app$/`, `/\.ngrok-free\.dev$/` 정규식이 `credentials: true`와 함께 허용되어 있음. 이 정규식은 임의의 제3자가 띄운 ngrok 터널 도메인과도 매치되므로, 프로덕션에서는 출처 검증이 사실상 무의미해짐. **개선 방향**: 개발용 ngrok 허용은 `NODE_ENV !== 'production'`일 때만 적용하고, 운영 환경은 명시적 도메인 화이트리스트만 사용.

4. **JWT를 localStorage에 저장 (XSS 토큰 탈취 위험)** - `frontend/src/services/api.ts:16`, `frontend/src/store/index.ts:78` - XSS 한 번이면 7일짜리 accessToken이 그대로 탈취 가능. 토스/당근마켓 등 시장 앱은 대부분 httpOnly 쿠키 기반 세션을 사용함. **개선 방향**: 백엔드에서 httpOnly+SameSite 쿠키로 토큰을 내려주고 프론트는 쿠키 자동 전송에 의존하도록 전환 (중기 작업, 사이클 2/3에서 단계적으로).

### 개선 권장 (P2)
1. **가짜 칼로리 수치를 실제 정보처럼 노출** - `frontend/src/pages/RecipeDetailPage.tsx:12-20`, `frontend/src/components/RecipeCard.tsx:26-34` - 두 파일에 동일한 `estimateCalories()` 함수가 중복 구현되어 있으며, 레시피 제목 문자 해시 기반의 의사난수를 "~580 kcal"처럼 실제 영양 정보인 것처럼 표시함. 사용자가 진짜 칼로리로 오인할 수 있어 신뢰도 문제. 공유 유틸로 통합하고, 가능하면 "예상" 라벨을 더 명확히 하거나 실제 칼로리 DB로 교체.
2. **설정 메뉴 항목이 죽은 버튼** - `frontend/src/pages/ProfilePage.tsx:166-180`, `frontend/src/pages/MyRipePage.tsx:275-277` - "앱 정보", "개인정보 처리방침", "이용약관"에 `onClick`이 없거나 빈 함수. 플레이스토어 등록 시 개인정보처리방침 링크는 필수 요건이라 이대로는 출시 불가.
3. **카카오톡 공유가 안내 토스트만 띄우는 미완성 기능** - `frontend/src/pages/RecipeDetailPage.tsx:173-175` - 공유 시트에 버튼은 노출되지만 클릭 시 "카카오 SDK 연동 후 사용 가능해요"만 표시. 당근마켓이라면 완성 전엔 버튼 자체를 숨김. 구현 전까지 숨기거나 베타 표시 권장.
4. **중복 프로필 페이지 공존** - `frontend/src/pages/ProfilePage.tsx` vs `frontend/src/pages/MyRipePage.tsx` - 둘 다 `App.tsx`에 라우팅되어 있지만 하단 내비게이션(`Layout.tsx`)은 `/myripe`만 가리킴. `ProfilePage`는 아바타 업로드·적립내역 바텀시트가 빠진 구버전으로 보이며 `/profile` 직접 접근 시에만 노출되는 사실상 죽은 코드. 유지보수 시 둘 중 하나만 고치고 잊어버리는 사고가 나기 쉬움 — 삭제 또는 리다이렉트 권장.
5. **필터 선택 색상이 브랜드 컬러(#2d6a4f 계열)에서 이탈** - `frontend/src/pages/RecommendPage.tsx`, `frontend/src/pages/FridgePage.tsx` - 카테고리/필터 버튼 선택 상태에 `#2563EB`(블루)가 하드코딩되어 `var(--primary)` 그린 톤과 따로 놂. 토스 스타일의 단일 강조색 원칙과 어긋남.
6. **docker-compose.yml이 실제 런타임과 불일치** - `docker-compose.yml` - Postgres 컨테이너를 정의하지만 실제 백엔드는 `better-sqlite3` 단일 파일 DB(`backend/src/db/index.ts`)로 동작 중. 배포 직전 혼선을 막기 위해 compose 파일을 SQLite 볼륨 마운트 기준으로 갱신하거나 제거 필요.

### 장기 개선 (P3)
1. 서버 측 비밀번호 정책 부재(`backend/src/routes/auth.ts` register는 존재 여부만 검사) - 프론트는 6자 이상을 강제하지만 API를 직접 호출하면 1자 비밀번호도 통과됨. 서버에서도 동일 정책 검증 필요.
2. 네트워크 실패와 입력 검증 실패가 동일한 일반 토스트 문구로 뭉뚱그려져 있어 사용자가 원인을 구분할 수 없음 - 오프라인 감지/재시도 UX 도입 권장.
3. 입력값 길이/형식 서버 검증이 존재 유무 체크 수준에 그침(재료 이름, recipe_title 등) - 과도하게 긴 페이로드나 비정상 문자열에 대한 방어 추가 권장.

### 시장 앱 대비 부족한 점 요약
- **토스 대비**: 단일 그라데이션 강조색 원칙을 철저히 지키는 토스와 달리, 필터 버튼 등에 별도 블루(#2563EB)가 섞여 브랜드 일관성이 떨어짐. 또한 토스는 실패 시 항상 구체적 원인을 보여주는 반면, 본 앱은 네트워크 오류·검증 실패·서버 버그가 모두 같은 일반 토스트로 처리됨.
- **당근마켓 대비**: 빈 상태·다음 행동 유도는 당근마켓 수준으로 잘 구현되어 있음(빈 냉장고/쇼핑리스트 CTA 우수). 다만 설정 메뉴의 죽은 버튼(개인정보처리방침 미연결)이나 미구현 카카오 공유처럼, 당근마켓이라면 노출하지 않았을 "반쯤 완성된" UI가 그대로 사용자에게 보임.
- **컬리 대비**: 컬리는 상품 카드의 가격 정보 신뢰도와 타이포 위계가 핵심 경쟁력인데, 본 앱은 가격비교 기능이 서버 스키마 누락 버그로 애초에 동작하지 않아(`analytics_events` 테이블 부재) 비교 자체가 불가능한 상태. 우선 동작부터 고친 뒤 디자인 비교가 의미를 가짐.

---

## 개선 완료: 2026-07-02 (사이클 2)
- `backend/src/routes/shopping.ts`: `/api/shopping/search` 호출 시마다 존재하지 않는 `analytics_events` 테이블에 INSERT하던 코드 제거 → 가격비교 기능 500 에러 해소
- `backend/src/index.ts`: 개인 데이터 라우트(`/api/ingredients`, `/api/recipes`, `/api/shopping`, `/api/vision`, `/api/purchases`)를 `authenticate`(게스트 폴백 허용)에서 `requireAuth`(미인증 요청 즉시 거부)로 교체 → 인증 없이 타인 데이터에 접근 가능하던 취약점 수정
- `backend/src/index.ts`: CORS ngrok 도메인 허용(`kaila-untempering-reconditely.ngrok-free.dev` 및 와일드카드 정규식)을 `NODE_ENV !== 'production'` 조건으로 래핑 → 프로덕션 배포 시 임의 제3자 ngrok 터널에서의 credentialed 요청 차단

## 버그 수정: 2026-08-17 (사이클 3)
- `frontend/src/services/api.ts`: 401 응답 인터셉터가 느슨한 `localStorage`의 `accessToken`/`user` 키만 지우고, 실제 세션이 들어있는 Zustand `persist` 스토어(`reverse-recipe-storage`)는 그대로 두고 있었음. 토큰 만료 후 인터셉터가 `window.location.href = '/'`로 새로고침하면 Zustand가 만료된 `user`를 그대로 복원하지만 인터셉터가 지운 `accessToken`은 복원되지 않아, 앱이 "로그인된 상태"로 영구히 멈춘 채 모든 API 요청이 계속 401을 반환하는 상태에 빠짐 (재료 목록·추천 등 전부 로딩 실패, 로그인 화면으로 돌아갈 방법 없음). → 인터셉터가 개별 키를 지우는 대신 스토어의 `logout()` 액션(`useAppStore.getState().logout()`)을 호출하도록 수정하여 persist된 상태까지 함께 정리되도록 함. `frontend/src/services/api.ts`, `frontend/src/store/index.ts` 대상으로 `tsc -p tsconfig.app.json --noEmit` 통과 확인.
