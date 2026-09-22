# 리버스레시피 재설계 계획서

> 작성일: 2026-09-22
> 대상: `/Users/kyoungjaewon/AI결과물/리버스레시피_클로드/`
> 범위: 컨셉 유지, 아키텍처·데이터·알고리즘 전면 재설계

---

## 0. 한 줄 결론

**지금 앱은 "LLM에게 레시피를 지어내게 하고, 그 결과를 문자열 부분일치로 재채점"하는 구조다.
이걸 "실제 레시피 코퍼스를 임베딩으로 검색하고, 소비기한 긴급도로 재랭킹"하는 구조로 바꾼다.**

LLM의 역할은 *레시피 생성*이 아니라 *재료명 정규화*와 *설명 생성*으로 내려간다.
그 결과 정확도·속도·오프라인 동작·비용이 동시에 개선된다.

---

## 1. 유지할 것 / 버릴 것

### 1.1 유지 (자산으로 인정)

| 항목 | 위치 | 유지 이유 |
|------|------|-----------|
| **핵심 컨셉** | — | 재료→레시피 역방향 + 소비기한 우선 소비. 시장에 제대로 된 구현이 없음 |
| **식재료 소비기한 DB** | `frontend/src/utils/ingredientDB.ts` | 약 200종 수작업 큐레이션. 공공데이터에도 없는 실질 도메인 지식 |
| **신호등 긴급도 모델** | `ingredientService.ts:53-73` | red/yellow/green + urgency_score. UX 원시요소로 훌륭함 |
| **점수 공식의 *발상*** | `recipeService.ts:301-331` | 긴급도·매칭률·선호도 가중합이라는 뼈대는 옳음 (구현은 교체) |
| **그린포인트 개념** | `recipeService.ts:333-344` | 차별화 요소. 단 근거 데이터를 실측으로 교체 |
| **조리 세션 영속화** | `store/index.ts:123-140` | 화면 이동해도 조리 진행 유지. 실사용에서 체감 큰 디테일 |
| **Mock 레시피 11종** | `recipeService.ts:58-271` | 폐기 대신 **골든 테스트 픽스처**로 전환 |
| **화면 구조** | Home/Fridge/Recommend/Shopping/MyRipe | 정보 구조 자체는 타당 |
| **프론트 스택** | React 19 + TS + Vite + Tailwind 4 | 최신이고 문제없음 |

### 1.2 폐기 (구조적 결함)

#### ① pg 호환 shim — 가장 심각

`backend/src/db/index.ts:139-185`

```ts
let sql = text.replace(/\$\d+/g, '?');
sql = sql.replace(/NOW\(\)/gi, `'${new Date().toISOString()}'`);
sql = sql.replace(/ILIKE/gi, 'LIKE');
```

PostgreSQL 문법을 정규식으로 SQLite로 번역한다. 문제:

- 날짜를 **SQL 문자열에 직접 보간**한다 (프리페어드 스테이트먼트의 의미 상실)
- `ingredientService.ts:87`에서 `INTERVAL '${daysThreshold} days'` — 템플릿 리터럴이 SQL에 직접 들어간다. 현재 `daysThreshold`는 내부 호출로만 결정되지만, 쿼리 파라미터로 노출되는 순간 인젝션 경로다
- 문자열 리터럴 안의 `NOW()`나 `ILIKE`도 무차별 치환된다
- `pg` 패키지가 `package.json`에 남아있지만 실제로는 안 쓴다

→ **`better-sqlite3` 네이티브 API + Kysely(또는 Drizzle)로 교체.** 타입 안전 쿼리빌더를 쓰면 이 계층 자체가 사라진다.

#### ② 부분일치 매칭 — 조용히 틀리는 버그

동일 패턴이 4곳에 반복된다:

```ts
name.includes(key) || key.includes(name)
```

- `recipeService.ts:274-275` (매칭 점수)
- `ingredientService.ts:42-45` (소비기한 조회)
- `ingredientService.ts:169` (재료 차감, `ILIKE %name%`)
- `ingredientDB.ts:180-181, 194-195` (소비기한 + 카테고리 판정)

**객체 키 순회 순서에 의존하므로 결과가 임의적이다:**

| 입력 | 실제 결과 | 올바른 결과 | 원인 |
|------|-----------|-------------|------|
| 무염버터 | 14일 | 30일 | `무`(14)가 `버터`(30)보다 먼저 정의됨 |
| 파김치 | 7일 | 30일 | `파`(7)가 `김치`(30)보다 먼저 |
| 손질대파 | 7일 | 7일 (우연히 맞음) | — |

한국어 복합명사는 **머리명사가 뒤에 온다.** `includes`가 아니라 우측 정합 최장일치를 써야 한다.
이 한 줄 변경만으로 이 버그군 대부분이 사라진다 (§4.1).

#### ③ 소비기한 DB 이중화

`backend/src/services/ingredientService.ts:5-30` (약 90종)
`frontend/src/utils/ingredientDB.ts:4-99` (약 200종)

이미 내용이 갈라져 있다. 프론트에만 있는 항목(`멸치`, `꿀`, `호두` 등)은 백엔드에서 카테고리 기본값으로 떨어진다.
→ **단일 소스로 통합 후 DB 테이블화.**

#### ④ 가짜 데이터를 진짜처럼 노출

| 위치 | 내용 |
|------|------|
| `shopping.ts:150-184` | FNV 해시로 가격 생성 → "쿠팡 3,240원"으로 표시 |
| `RecipeDetailPage.tsx:12-20`, `RecipeCard.tsx:26-34` | 제목 해시로 칼로리 생성 → "~580 kcal" |
| `vision.ts:26-35` | 냉장고 사진 무엇을 올려도 계란/우유/당근/양파/버터 반환 |
| `vision.ts:93-97` | 영수증 OCR 항상 계란/우유/닭가슴살 |

가격·칼로리는 **실데이터 소스가 존재한다** (§3.4). 대체하거나 기능을 내린다.

#### ⑤ 캐시가 제품의 전제를 무효화

`recipeService.ts:408-411`

```ts
const cacheKey = md5({ ingredients: req.ingredients.sort(), filters: req.filters });
// TTL 24시간
```

캐시 키에 **소비기한이 없다.**
오늘 시금치가 3일 남았을 때와 이틀 뒤 1일 남았을 때, 재료 목록이 같으면 **완전히 동일한 추천**이 나온다.
긴급도 기반 추천이 이 앱의 존재 이유인데, 캐시가 그걸 지운다.

→ **검색 결과는 캐시하고, 랭킹은 매번 새로 계산** (§4.3).

#### ⑥ 기타 폐기 대상

- `backend/src/db/migrate.ts` — 존재하지 않는 `pool` export를 import. 실행 불가능한 죽은 코드
- `frontend/src/pages/ProfilePage.tsx` — `MyRipePage`의 구버전. 라우팅은 살아있으나 내비게이션에서 도달 불가
- localStorage JWT (`api.ts:17`, `store/index.ts:78`) — httpOnly 쿠키로 전환
- `docker-compose.yml` Postgres 정의 — 실런타임(SQLite)과 불일치
- `better-sqlite3`(동기)를 `async` 함수로 감싼 가짜 비동기

---

## 2. 근본 문제 진단

코드 레벨 버그를 다 고쳐도 남는 설계 문제가 셋 있다.

### 2.1 생성을 해야 할 곳에서 생성하고 있지 않다

현재 시스템 프롬프트 (`recipeService.ts:10-13`):

> "반드시 실제로 존재하는 요리만 추천하세요.
> 레시피를 임의로 창작하거나 없는 재료 조합을 만들지 마세요."

이건 **환각을 프롬프트로 막으려는 시도**다. 구조적 보장이 없다.
실존 레시피만 나와야 한다면 → **검색하면 된다.** 생성할 이유가 없다.

LLM이 실제로 잘하는 일은 따로 있다:
- 사용자가 친 "손질 대파 한단" → `대파`로 정규화
- 검색된 레시피를 사용자 상황에 맞게 설명 ("시금치가 내일까지네요, 된장국이면 한 번에 씁니다")

**생성 ↔ 검색을 맞바꾸는 것이 이 재설계의 핵심이다.**

### 2.2 점수 공식이 미션과 반대로 작동한다

`recipeService.ts:309-315`

```ts
const expiration_urgency = urgencyCount > 0 ? urgencySum / urgencyCount : 0;
```

긴급도를 **평균**낸다. 결과:

| 레시피 | 긴급 재료 | 여유 재료 | 평균 긴급도 | 실제 가치 |
|--------|-----------|-----------|-------------|-----------|
| A | 3개 (1.0) | 1개 (0.2) | **0.8** | 높음 |
| B | 1개 (1.0) | 0개 | **1.0** | 낮음 |

B가 A를 이긴다. 하지만 A가 재료를 3배 더 구한다.
**평균이 아니라 총량으로 가야 한다** (§4.2).

또한 `match_score`는 소금·간장 같은 상비 조미료를 삼겹살과 동등하게 센다.
누구나 가진 재료는 정보량이 0이므로 **IDF 가중**이 필요하다.

### 2.3 성공을 측정하지 않는다

앱의 목표는 "음식물 낭비 감소"인데, **낭비를 측정하는 코드가 없다.**

그린포인트는 조리 시점에 적립되지만, *쓰지 못하고 버려진 재료*는 아무도 세지 않는다.
`ingredients` 테이블에서 소비기한이 지난 행은 그냥 남아있거나 사용자가 조용히 지운다.

→ **북극성 지표: 소비기한 내 소진율** = 소진된 재료 / (소진 + 폐기). §6.

---

## 3. 2026년 9월 기준 가용 기술 조사

### 3.1 온디바이스 LLM

**Gemma 4** (2026-04-02, Apache 2.0) — E2B / E4B / 26B-A4B MoE / 31B Dense

E2B·E4B가 엣지 타깃이다. "E"는 effective parameters.

- **PLE**(Per-Layer Embedding) 구조: MoE 대신 토큰별 저차원 조건화 경로를 병렬로 둬서, 각 디코더 층이 필요할 때만 토큰별 정보를 받는다 → 모바일 추론에 유리
- LiteRT-LM에서 **2/4/8비트 혼합 양자화 + 층별 임베딩 메모리 매핑**으로 **1.5GB 미만** RAM 구동
- 입력 4,000토큰을 3초 내 처리
- 전 사이즈 이미지·비디오 입력, E2B/E4B는 **네이티브 오디오 입력**

> 참고: `SERVANT_DESIGN.md`의 "Gemma 4 E2B, 2.6GB, 8GB RAM 최소"는 LiteRT-LM 양자화 기준으로 갱신 가능하다 (1.5GB 미만).

### 3.2 온디바이스 임베딩 — **이 프로젝트의 핵심 부품**

**EmbeddingGemma 308M**

- 100개 이상 언어 (한국어 포함)
- **MRL**(Matryoshka Representation Learning): 출력 차원을 768 → 512 → 256 → 128로 잘라 써도 성능 유지
- MTEB 500M 미만 부문 1위
- 폰·노트북·태블릿 실행 목표로 설계

→ 256차원 int8로 쓰면 재료 1종당 256바이트. 재료 500종 = 128KB. **브라우저에서 충분히 돈다.**

### 3.3 벡터 검색

**sqlite-vec** — `sqlite-vss`의 후속 (동일 저자 Alex Garcia)

- 순수 C, 의존성 없음, SQLite 도는 곳 어디서나
- `vec0` 가상 테이블에 float / int8 / binary 벡터
- 별도 서비스 불필요 — SQLite 파일 하나 안에서 벡터 검색

> `SERVANT_DESIGN.md`가 참조하는 `sqlite-vss`는 이제 구버전이다. **sqlite-vec으로 갱신할 것.**

### 3.4 실데이터 소스 (가짜 데이터 대체)

| 대체 대상 | 소스 |
|-----------|------|
| **레시피 코퍼스** ⭐ | 농림수산식품교육문화정보원 **레시피 기본정보** (공공데이터포털 15057205). 레시피 기본정보 / 과정정보 / **재료정보** 3종 오퍼레이션 |
| 가짜 칼로리 | 식약처 **식품영양성분DB** OpenAPI (data.go.kr 15127578, K-FIND) — 매월 갱신 |
| 재료 표준명 | 농촌진흥청 한식 재료·분량 데이터 |
| 추가 코퍼스 | 한식진흥원 (농식품부·행안부 포털 개방), KADX 농식품 빅데이터 거래소 |

**최대 리스크였던 "레시피 코퍼스 확보"가 공공데이터로 해결된다.**
크롤링(만개의레시피 등)은 이용약관 위반 소지가 있으므로 배제한다.

### 3.5 구조화 출력 — 파싱 실패 제거

**llama.cpp GBNF** + `json-schema-to-grammar`

문법이 토큰 단위 마스크를 만들어 유효한 다음 토큰만 남긴다.
→ 잘못된 JSON이 **구조적으로 생성 불가능**. 생성 토큰 수도 줄어 더 빠르다.

현재 `recipeService.ts:372-379`의 방어 코드 (`Array.isArray(parsed) ? ... : parsed?.recipes ...`)가 통째로 필요 없어진다.

### 3.6 브라우저 런타임

**Transformers.js 3 + WebGPU** — 2026년 기준 프로덕션 가용
(Chrome 113+, Firefox 130+, Safari 17.4+)

- WASM 대비 10–15배
- 2GB 미만 양자화 모델은 대화형 속도
- **제약: 최초 모델 다운로드.** 1.2GB LLM은 웹에서 비현실적

→ **판단: 브라우저에는 LLM 말고 임베딩만 올린다.**
EmbeddingGemma 308M(int8, 256d) ≈ 120MB는 캐시 가능한 수준. 1.5GB LLM은 아니다.

### 3.7 온디바이스 OCR (Phase 3)

| 옵션 | 크기 | 비고 |
|------|------|------|
| ML Kit 한국어 텍스트 인식 | 번들 4MB / 언번들 260KB | 한국어는 별도 의존성 필요 |
| PaddleOCR `korean_PP-OCRv5_mobile_rec` | ~10MB | 한국어 특화 |

---

## 4. 재설계 아키텍처

### 4.0 전체 파이프라인

```
재료 입력 (타이핑 / 사진 / 영수증)
     │
     ▼ ① 정규화 ─ 3단 폴백 (별칭표 → 형태소 → 임베딩)
   canonical_id
     │
     ▼ ② 검색 ─ sqlite-vec 벡터 + 역색인 하이브리드
   후보 레시피 50~200개        ◀── 여기까지만 캐시 (긴급도 무관)
     │
     ▼ ③ 재랭킹 ─ rescue / coverage / effort / fit    ◀── 매번 새로 계산
   상위 N개
     │
     ▼ ④ 제시 ─ 선택적 LLM (설명 생성만)
   "시금치가 내일까지예요. 된장국이면 한 번에 씁니다."
```

**①②는 완전 오프라인 가능. ④만 선택적 네트워크.**
현재는 ①~④ 전부가 Gemini 한 번의 호출(타임아웃 60초)에 묶여 있다.

### 4.1 데이터 계층 — 식재료 온톨로지

`Record<string, number>` 두 개를 다음으로 교체한다.

```sql
CREATE TABLE ingredient_canonical (
  id                     TEXT PRIMARY KEY,   -- 'ing_spinach'
  name_ko                TEXT NOT NULL,      -- '시금치'
  category               TEXT NOT NULL,

  -- 보관 상태별 (현재는 냉장 하나뿐)
  shelf_life_fridge_days  INTEGER,
  shelf_life_freezer_days INTEGER,
  shelf_life_pantry_days  INTEGER,

  -- 실데이터 연결
  mfds_food_code         TEXT,               -- 식약처 영양DB 키
  kcal_per_100g          REAL,
  co2e_kg_per_kg         REAL,               -- 그린포인트 실근거

  is_pantry_staple       INTEGER DEFAULT 0,  -- 소금·간장 → IDF 가중에 사용
  embedding              BLOB                -- EmbeddingGemma 256d int8
);

CREATE TABLE ingredient_alias (
  alias         TEXT PRIMARY KEY,            -- '시금치나물', '손질시금치'
  canonical_id  TEXT NOT NULL REFERENCES ingredient_canonical(id),
  source        TEXT                         -- manual | learned | ocr
);

CREATE TABLE ingredient_substitute (
  from_id     TEXT NOT NULL REFERENCES ingredient_canonical(id),
  to_id       TEXT NOT NULL REFERENCES ingredient_canonical(id),
  ratio       REAL DEFAULT 1.0,
  confidence  REAL,
  note        TEXT,                          -- '풍미 약간 다름'
  PRIMARY KEY (from_id, to_id)
);
```

**`ingredient_substitute`는 신규 역량이다.**
"돼지고기가 없네요 → 닭고기로 대체 가능 (신뢰도 0.8)"
국내 레시피 앱 중 제대로 하는 곳이 없고, **재료를 더 사지 않고 있는 걸로 해결**하므로 낭비 감소 미션에 직결된다.

#### 3단 정규화

```
1단  별칭 테이블 정확 일치        O(1)      신뢰도 1.0
2단  한국어 복합명사 우측 최장일치  O(k)      신뢰도 0.9
     '무염버터' → 뒤에서부터 → '버터' ✓   (현 버그: '무' 오매칭)
     '파김치'   → 뒤에서부터 → '김치' ✓   (현 버그: '파' 오매칭)
3단  임베딩 최근접 (sqlite-vec)             신뢰도 = 코사인 유사도
     미등록 신규 재료 대응, 임계값 미만이면 사용자에게 확인
```

2단은 **모델 없이, 정렬 한 번으로 오늘 당장 적용 가능하다.**
별칭 키를 길이 내림차순 정렬 후 `endsWith`로 검사하면 끝이다. 비용 대비 효과가 가장 큰 단일 수정.

### 4.2 알고리즘 — 점수 재설계

```
rescue    = Σ (urgency_i × mass_i × co2e_i)        ← 평균이 아니라 총량
coverage  = Σ IDF(i) [보유]  /  Σ IDF(i) [전체]     ← 희소 재료 가중
effort    = f(부족 재료 수, 난이도, 조리시간)
fit       = 선호도 − 최근 조리 이력 패널티           ← 다양성

score = w₁·rescue + w₂·coverage − w₃·effort + w₄·fit
```

현행 대비 변경점:

| 항목 | 현행 | 변경 | 이유 |
|------|------|------|------|
| 긴급도 | 평균 | **총량** | 긴급 재료 3개 쓰는 레시피가 1개 쓰는 것보다 위에 와야 함 (§2.2) |
| 매칭률 | 단순 비율 | **IDF 가중** | 소금·간장은 정보량 0 |
| 부족 재료 | 반영 없음 | **effort 페널티** | 5개 사러 가야 하는 레시피는 실행되지 않음 |
| 이력 | 미사용 | **다양성 패널티** | `recipe_history` 테이블이 있는데 랭킹에서 안 읽음 |
| co2e | 상수 테이블 | **실측 연동** | 그린포인트에 근거 부여 |

가중치 `w₁~w₄`는 하드코딩하지 말고 설정으로 빼서 §6의 골든셋으로 튜닝한다.

### 4.3 캐시 재설계

```
캐시함   ② 검색 결과 (재료 집합 → 후보 레시피 ID 목록)
         긴급도와 무관하고 안정적. TTL 길게 가능
캐시 안함 ③ 랭킹
         긴급도는 매일 변한다. 계산 비용은 후보 200개 기준 밀리초 단위
```

이 분리만으로 §1.2-⑤ 버그가 사라지면서 캐시 이점은 그대로 남는다.

### 4.4 온디바이스 배치

| 기능 | 모델/도구 | 크기 | 실행 위치 | 도입 단계 |
|------|-----------|------|-----------|-----------|
| 재료 정규화·매칭 | EmbeddingGemma 308M (256d int8) | ~120MB | 브라우저 WebGPU | Phase 2 |
| 벡터 검색 | sqlite-vec | ~1MB | 서버 (후에 WASM) | Phase 2 |
| 구조화 출력 | GBNF 문법 | — | LLM 호출 시 | Phase 2 |
| 영양 정보 | 식약처 OpenAPI | — | 서버 (사전 적재) | Phase 2 |
| 영수증 OCR | ML Kit 한국어 | 4MB | 네이티브 | Phase 3 |
| 냉장고 사진 | Gemma 4 E2B (멀티모달) | <1.5GB | 네이티브 LiteRT-LM | Phase 3 |
| 설명 생성 | Gemini 2.5 Flash → Gemma 4 E2B | — | 클라우드 → 네이티브 | Phase 2 → 3 |

---

## 5. 단계별 실행 계획

### Phase 1 — 기반 재구축 (모델 없이, 코드만으로)

> 이 단계만 끝나도 정확도가 눈에 띄게 오른다. 외부 의존 없음.

1. **DB 계층 교체** — pg shim 제거 → Kysely + `better-sqlite3` 네이티브
   - `db/index.ts:139-185` 삭제, `db/migrate.ts` 삭제
   - `pg`, `@types/pg` 의존성 제거
   - 모든 `query()` 호출부를 타입 안전 쿼리로 이전
2. **식재료 온톨로지 구축** — §4.1 스키마, 두 DB 통합, 별칭 분리
3. **3단 정규화 중 2단까지 적용** — 우측 최장일치. §1.2-② 버그군 해소
4. **레시피 코퍼스 적재** — 공공데이터포털 15057205에서 기본정보·과정·재료 수집 → 정규화하여 로컬 DB
5. **점수 공식 교체** — §4.2. Mock 11종은 골든 픽스처로 이동
6. **캐시 분리** — §4.3
7. **가짜 데이터 정리** — 가격비교·칼로리·Mock OCR은 실데이터 연동 전까지 **UI에서 내린다**

### Phase 2 — 온디바이스 지능

1. EmbeddingGemma를 Transformers.js/WebGPU로 로드, 재료·레시피 임베딩 사전 계산
2. sqlite-vec 도입, 벡터 + 역색인 하이브리드 검색
3. 3단 정규화 완성 (임베딩 폴백)
4. 식약처 영양 API 연동 → 가짜 칼로리 제거
5. LLM 호출 전 구간에 GBNF 제약 디코딩 적용
6. `ingredient_substitute` 채우고 대체 재료 UI 노출
7. httpOnly 쿠키 전환, `ProfilePage` 삭제, docker-compose 정리

### Phase 3 — 완전 오프라인 / 네이티브

1. Android + LiteRT-LM + Gemma 4 E2B
2. ML Kit 한국어 OCR — 영수증 실인식
3. Gemma 4 멀티모달 — 냉장고 사진 실인식
4. 클라우드 완전 선택화 (네트워크 없이 전 기능 동작)

> `SERVANT_DESIGN.md`의 Android 스택(Kotlin/Compose/Hilt/Room)과 합류 지점.
> 단 거기 적힌 `sqlite-vss` → `sqlite-vec`, `Gemma 4 E2B 2.6GB` → `<1.5GB`로 갱신 필요.

---

## 6. 검증 전략

### 골든셋

| 세트 | 내용 | 통과 기준 |
|------|------|-----------|
| 재료 정규화 | 100+ 케이스. `무염버터→버터`, `파김치→김치`, `손질대파→대파`, 오타 포함 | 정확도 ≥ 95% |
| 레시피 매칭 | Mock 11종 + 실코퍼스 표본 | 상위 3개 내 적합 레시피 포함 |
| 점수 회귀 | §2.2 표의 A/B 케이스 | A가 B보다 상위 |

### 북극성 지표

**소비기한 내 소진율** = 소진 재료 / (소진 + 폐기)

이를 위해 필요한 것:
- `ingredients`에 `disposed_at`, `disposal_reason` 컬럼 추가
- 소비기한 경과 재료에 "드셨나요 / 버렸나요" 확인 플로우
- 그린포인트를 이 실측치에 연동 (현재는 조리 시점 일방 적립)

**지금은 앱이 목표를 달성하고 있는지 알 방법이 전혀 없다.** 이게 가장 시급한 계측 공백이다.

---

## 7. 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 공공 레시피 코퍼스의 품질·수량이 기대 이하 | 높음 | **Phase 1 착수 전 표본 수집해서 먼저 검증.** 부족하면 큐레이션 + LLM 증강(검수 필수) |
| EmbeddingGemma 한국어 식재료 성능 | 중간 | 골든셋으로 조기 측정. 미달 시 한국어 특화 임베딩으로 교체 |
| 브라우저 모델 최초 다운로드 이탈 | 중간 | 임베딩만 올려 120MB 유지. 백그라운드 프리페치 + 미로드 시 2단 폴백으로 동작 |
| 온톨로지 구축 공수 | 중간 | 기존 200종에서 시작. 전수 완성 대기하지 않고 점진 확장 |
| Phase 3 네이티브 전환 범위 | 높음 | Phase 1–2를 웹에서 완결시켜 독립적으로 가치 확보. Phase 3는 별도 결정 |

---

## 8. 출처

- [Gemma 4 | Google AI Edge | LiteRT-LM](https://developers.google.com/edge/litert-lm/models/gemma-4)
- [Google Pushes Multimodal AI Further Onto Edge Devices with Gemma 4 — Edge AI and Vision Alliance](https://www.edge-ai-vision.com/2026/04/google-pushes-multimodal-ai-further-onto-edge-devices-with-gemma-4/)
- [Gemma 4 Guide: E2B, E4B, 26B MoE & 31B Open Weights (2026)](https://codersera.com/blog/gemma-4-complete-guide-2026/)
- [EmbeddingGemma model overview | Google AI for Developers](https://ai.google.dev/gemma/docs/embeddinggemma)
- [Introducing EmbeddingGemma — Google Developers Blog](https://developers.googleblog.com/en/introducing-embeddinggemma/)
- [sqlite-vec — SQLite 벡터 검색](https://github.com/asg017/sqlite-vss)
- [The State of Vector Search in SQLite](https://marcobambini.substack.com/p/the-state-of-vector-search-in-sqlite)
- [llama.cpp GBNF 문법 문서](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md)
- [A Guide to Structured Generation Using Constrained Decoding](https://www.aidancooper.co.uk/constrained-decoding/)
- [Running models on WebGPU | Transformers.js](https://huggingface.co/docs/transformers.js/guides/webgpu)
- [Running Gemma 4 in the Browser with Transformers.js and WebGPU](https://pyimagesearch.com/2026/07/27/running-gemma-4-in-the-browser-with-transformers-js-and-webgpu/)
- [농림수산식품교육문화정보원 레시피 기본정보 (공공데이터포털 15057205)](https://www.data.go.kr/dataset/15000158/openapi.do)
- [식품의약품안전처 식품영양성분DB정보 (공공데이터포털 15127578)](https://www.data.go.kr/data/15127578/openapi.do)
- [K-FIND 식품영양성분 데이터베이스](https://www.foodsafetykorea.go.kr/fcdb/)
- [ML Kit 텍스트 인식 v2 (Android)](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
- [PaddlePaddle/korean_PP-OCRv5_mobile_rec](https://huggingface.co/PaddlePaddle/korean_PP-OCRv5_mobile_rec)
