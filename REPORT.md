# 리버스 레시피 (Reverse Recipe) — 최종 보고서

> 학번: 2021212843 · 이름: 경재원
> 제출일: 2026.04.07
> GitHub: https://github.com/jaewonkyoung-alt/reverse-recipe

---

## 1. 실험의 목적과 범위

### 목적

냉장고에 남아 있는 재료를 입력하면 AI가 그 재료로 만들 수 있는 레시피를 추천해주는 웹 앱을 설계·구현한다. 특히 **소비기한이 임박한 재료를 우선적으로 활용**하는 레시피를 추천해 음식 낭비를 줄이는 것을 핵심 목표로 한다.

### 포함 범위

| 기능 | 설명 |
|------|------|
| 회원 인증 | 이메일/비밀번호 회원가입·로그인, 게스트 모드 |
| 냉장고 재료 관리 | 재료 CRUD, 소비기한 자동 계산, 긴급도 표시 |
| AI 레시피 추천 | Google Gemini 2.5 Flash 연동, 소비기한 가중치 기반 추천 |
| 요리 완성 처리 | 조리 단계별 타이머, 완성 후 재료 자동 차감 |
| 쇼핑리스트 | 부족한 재료 추가, 구매완료 체크 |
| 그린포인트 | 임박 재료 사용 시 환경 기여 포인트 적립. 향후 앱 내 혜택(할인 쿠폰·제휴 쇼핑몰 포인트 전환)에 활용할 수 있도록 설계된 리워드 시스템 |

### 불포함 범위

- 플레이스토어/앱스토어 배포 (PWA 구조이나 스토어 등록 미완)
- 영수증 OCR 자동 인식 (Phase 2 계획, 라우터만 준비)
- 실시간 상품 가격 비교 (Phase 3 계획, 시드 기반 Mock으로 대체)

---

## 2. 분석

### 유스케이스 다이어그램

```
                        ┌──────────────────────────────────────┐
                        │           리버스 레시피 시스템         │
                        │                                      │
  ┌──────────┐          │  ┌─────────────────────────────┐    │
  │  일반 사용자 │─────────┼─▶│ UC1. 회원가입 / 로그인       │    │
  │  (회원)   │          │  └─────────────────────────────┘    │
  └──────────┘          │  ┌─────────────────────────────┐    │
        │               │  │ UC2. 냉장고 재료 등록·수정·삭제 │    │
        ├───────────────┼─▶│                             │    │
        │               │  └─────────────────────────────┘    │
        │               │  ┌─────────────────────────────┐    │
        ├───────────────┼─▶│ UC3. AI 레시피 추천 받기      │    │
        │               │  └─────────────────────────────┘    │
        │               │  ┌─────────────────────────────┐    │
        ├───────────────┼─▶│ UC4. 요리 완성 / 재료 차감    │    │
        │               │  └─────────────────────────────┘    │
        │               │  ┌─────────────────────────────┐    │
        └───────────────┼─▶│ UC5. 쇼핑리스트 관리          │    │
                        │  └─────────────────────────────┘    │
  ┌──────────┐          │  ┌─────────────────────────────┐    │
  │  게스트   │──────────┼─▶│ UC1-G. 게스트 로그인 (제한)  │    │
  └──────────┘          │  └─────────────────────────────┘    │
                        │                                      │
                        │        ▲ Google Gemini 2.5 Flash API  │
                        └──────────────────────────────────────┘
```

### 유스케이스 명세서

#### UC1. 회원가입 / 로그인

| 항목 | 내용 |
|------|------|
| 액터 | 일반 사용자 |
| 사전 조건 | 없음 |
| 기본 흐름 | 이메일·이름·비밀번호 입력 → 서버에서 중복 확인 → bcrypt 암호화 저장 → JWT 토큰 발급 → 홈 화면 이동 |
| 대안 흐름 | 이미 가입된 이메일 → "이미 가입된 이메일입니다" 오류 표시 |
| 예외 흐름 | 비밀번호 불일치 → "비밀번호가 올바르지 않습니다" 오류 표시 |
| 사후 조건 | accessToken(7일) + refreshToken(30일) 발급, 세션 유지 |

#### UC2. 냉장고 재료 등록

| 항목 | 내용 |
|------|------|
| 액터 | 일반 사용자 |
| 사전 조건 | 로그인 상태 |
| 기본 흐름 | 재료명·카테고리 입력 → 230개 내장 DB에서 소비기한 자동 계산 → DB 저장 → 긴급도(빨강/노랑/초록) 표시 |
| 대안 흐름 | 직접 소비기한 날짜 선택 가능 |
| 사후 조건 | 재료가 유저별 냉장고 DB에 저장, 소비기한 임박 순 정렬 |

#### UC3. AI 레시피 추천

| 항목 | 내용 |
|------|------|
| 액터 | 일반 사용자 |
| 사전 조건 | 냉장고에 재료 1개 이상 등록 |
| 기본 흐름 | "레시피 추천" 탭 이동 → 서버가 냉장고 재료 조회 → 소비기한 가중치 계산 → Google Gemini 2.5 Flash 호출 → 레시피 3개 반환 |
| 대안 흐름 | API 키 없으면 Mock 레시피 10종 중 재료 매칭률 높은 3개 반환 |
| 필터 | 요리 종류(한식/일식/중식/양식), 식사 유형(메인/반찬/수프 등), 난이도, 재료 직접 선택 |

#### UC4. 요리 완성 / 재료 차감

| 항목 | 내용 |
|------|------|
| 액터 | 일반 사용자 |
| 사전 조건 | 레시피 상세 페이지 진입 |
| 기본 흐름 | "요리 시작" → 단계별 타이머 진행 → "완성" → 사용한 재료 냉장고에서 차감 → 그린포인트 적립 |
| 사후 조건 | recipe_history에 완성 기록 저장, 재료 수량 차감 |

#### UC5. 쇼핑리스트 관리

| 항목 | 내용 |
|------|------|
| 액터 | 일반 사용자 |
| 기본 흐름 | 부족한 재료 추가 → 목록 확인 → 장보기 후 "구매완료" 체크 → 냉장고로 이동 |
| 일괄 추가 | 레시피 상세에서 "부족한 재료 쇼핑리스트 추가" 버튼 1클릭 |

---

## 3. 설계

### 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트                            │
│  React 19 + TypeScript + Vite                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  홈       │ │ 냉장고   │ │ 레시피   │ │ 쇼핑     │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  Zustand 상태관리 / Framer Motion 애니메이션 / TailwindCSS   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP REST API (JWT 인증)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                        서버 (포트 4000)                       │
│  Node.js + Express.js + TypeScript                          │
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │
│  │  /auth  │ │ /ingre- │ │/recipes │ │   /shopping     │ │
│  │         │ │  dients │ │         │ │                 │ │
│  └─────────┘ └─────────┘ └────┬────┘ └─────────────────┘ │
│                                │                            │
│  ┌─────────────────────────────▼──────────────────────┐    │
│  │              ingredientService / recipeService      │    │
│  └─────────────────────────────┬──────────────────────┘    │
│                                │ (API 키 있을 때)            │
│                       ┌────────▼────────┐                  │
│                       │  Gemini 2.5     │                  │
│                       │  Flash (Google) │                  │
│                       └─────────────────┘                  │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                    SQLite DB (better-sqlite3)                │
│  reverse_recipe.db (파일 기반, 서버 불필요)                    │
└─────────────────────────────────────────────────────────────┘
```

### ERD (Entity Relationship Diagram)

```
users
  id (PK, TEXT UUID)
  email (UNIQUE)
  name
  password_hash
  kakao_id
  preferences (JSON TEXT)
  created_at

ingredients
  id (PK, TEXT UUID)
  user_id (FK → users.id)
  name
  quantity
  unit
  category  ← 채소/과일/육류/해산물/유제품/조미료/소스/기타
  expiration_date
  created_at / updated_at

recipe_history
  id (PK, TEXT UUID)
  user_id (FK → users.id)
  recipe_data (JSON TEXT)
  completed (0/1)
  completed_at
  created_at

shopping_list
  id (PK, TEXT UUID)
  user_id (FK → users.id)
  ingredient_name
  quantity / unit / recipe_title
  is_purchased (0/1)
  created_at

green_points
  id (PK, TEXT UUID)
  user_id (FK → users.id)
  ingredient_name
  points_earned
  reason
  earned_at

recipe_cache
  id (PK, TEXT UUID)
  cache_key (UNIQUE, MD5 해시)
  recipe_data (JSON TEXT)
  expires_at  ← 24시간 캐시
```

### 레시피 추천 시퀀스 다이어그램

```
사용자      프론트엔드       백엔드          SQLite        Gemini 2.5 Flash
  │              │               │               │               │
  │ "추천 받기"  │               │               │               │
  │─────────────▶│               │               │               │
  │              │ POST /recipes/recommend        │               │
  │              │───────────────▶               │               │
  │              │               │ SELECT ingredients             │
  │              │               │ WHERE user_id=?               │
  │              │               │──────────────▶│               │
  │              │               │◀──────────────│               │
  │              │               │ 소비기한 가중치 계산            │
  │              │               │ buildExpirationWeights()       │
  │              │               │                               │
  │              │               │ (API 키 있으면)                │
  │              │               │ POST /chat/completions         │
  │              │               │───────────────────────────────▶
  │              │               │◀───────────────────────────────
  │              │               │ (API 키 없으면 Mock 10종 매칭)  │
  │              │               │                               │
  │              │               │ recommendation_score 계산      │
  │              │               │ (urgency 50% + match 40% + pref 10%)
  │              │ recipes[]     │               │               │
  │              │◀──────────────│               │               │
  │ 레시피 카드  │               │               │               │
  │◀─────────────│               │               │               │
```

---

## 4. 구현

### 개발 환경

| 항목 | 내용 |
|------|------|
| OS | macOS |
| 런타임 | Node.js v22 (nvm) |
| 패키지 매니저 | npm |
| IDE | VS Code + Claude Code (AI 보조) |
| 버전 관리 | Git + GitHub |

### 기술 스택

**프론트엔드**
| 기술 | 버전 | 역할 |
|------|------|------|
| React | 19.2 | UI 프레임워크 |
| TypeScript | 5.8 | 정적 타입 |
| Vite | 6.3 | 빌드 도구 |
| TailwindCSS | 4.2 | 스타일링 |
| Zustand | - | 전역 상태관리 |
| Framer Motion | - | 애니메이션 |
| React Router | 7.13 | 클라이언트 라우팅 |
| Axios | - | HTTP 클라이언트 |

**백엔드**
| 기술 | 버전 | 역할 |
|------|------|------|
| Node.js | 22 | 서버 런타임 |
| Express.js | 4.18 | 웹 프레임워크 |
| TypeScript | 5.9 | 정적 타입 |
| better-sqlite3 | - | SQLite DB 드라이버 |
| bcryptjs | - | 비밀번호 해싱 |
| jsonwebtoken | - | JWT 인증 |
| Helmet | - | 보안 미들웨어 |
| CORS | - | 교차 출처 허용 |

### 서버/클라이언트 구조

```
frontend/
  src/
    pages/       ← 8개 페이지 컴포넌트
    components/  ← Layout, 공통 컴포넌트
    services/    ← api.ts (axios 래퍼)
    store/       ← Zustand 전역 상태
    types/       ← TypeScript 타입 정의

backend/
  src/
    routes/      ← auth, ingredients, recipes, shopping
    services/    ← ingredientService, recipeService, emailService
    middleware/  ← auth (JWT 검증)
    db/          ← index.ts (SQLite 초기화 + pg 호환 shim)
    types/       ← 공통 타입
    index.ts     ← Express 앱 진입점
```

### API 엔드포인트 목록

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | /api/auth/register | 회원가입 | ✗ |
| POST | /api/auth/login | 로그인 | ✗ |
| POST | /api/auth/guest | 게스트 로그인 | ✗ |
| GET | /api/ingredients | 재료 목록 조회 | ✓ |
| GET | /api/ingredients/expiring | 만료 임박 재료 | ✓ |
| POST | /api/ingredients | 재료 추가 | ✓ |
| PUT | /api/ingredients/:id | 재료 수정 | ✓ |
| DELETE | /api/ingredients/:id | 재료 삭제 | ✓ |
| POST | /api/ingredients/deduct | 재료 차감 | ✓ |
| POST | /api/recipes/recommend | 레시피 추천 | ✓ |
| POST | /api/recipes/save | 레시피 저장 | ✓ |
| POST | /api/recipes/:id/complete | 요리 완성 | ✓ |
| GET | /api/recipes/history | 요리 이력 | ✓ |
| GET | /api/recipes/green-points | 그린포인트 조회 | ✓ |
| GET | /api/shopping | 쇼핑리스트 조회 | ✓ |
| POST | /api/shopping | 항목 추가 | ✓ |
| POST | /api/shopping/bulk | 일괄 추가 | ✓ |
| PUT | /api/shopping/:id/purchase | 구매완료 처리 | ✓ |
| DELETE | /api/shopping/:id | 항목 삭제 | ✓ |

### Google Gemini 2.5 Flash 연동 구조

```typescript
// 시스템 프롬프트 (한국어, JSON 모드 적용)
// - "반드시 실제로 존재하는 요리만 추천" 명시
// - responseMimeType: "application/json" → 파싱 오류 없는 구조화 응답
// - temperature: 0.2 → 보수적 응답, 환각 최소화

// 사용자 프롬프트 (buildGeminiPrompt)
`사용 가능한 재료: [냉장고 재료 목록]
소비기한 우선순위: { "계란": 0.9, "시금치": 0.7, ... }  // 임박할수록 높음
소비기한이 급한 재료를 더 많이 사용하는 레시피를 우선 추천하세요.`

// 추천 점수 계산
recommendation_score =
  expiration_urgency × 0.5 +   // 소비기한 임박 재료 활용도
  ingredient_match   × 0.4 +   // 냉장고 재료 매칭률
  user_preference    × 0.1     // 사용자 요리 선호도
```

---

## 5. 실험 (테스트 데이터와 결과)

### 핵심 흐름 end-to-end 테스트

**테스트 환경:** Node.js v22, SQLite (로컬), Mock 레시피 모드

**테스트 데이터**
```json
{
  "user": { "email": "test@example.com", "name": "테스터", "password": "Test1234" },
  "ingredients": [
    { "name": "계란", "category": "유제품", "quantity": 6, "unit": "개" },
    { "name": "시금치", "category": "채소" },
    { "name": "간장", "category": "조미료" },
    { "name": "양파", "category": "채소", "quantity": 3, "unit": "개" }
  ]
}
```

**테스트 결과**

| # | 테스트 항목 | 기대 결과 | 실제 결과 | 상태 |
|---|-------------|-----------|-----------|------|
| 1 | 회원가입 | user 객체 + JWT 토큰 반환 | ✅ UUID 포함 user, accessToken 반환 | ✅ |
| 2 | 로그인 성공 | JWT 토큰 반환 | ✅ accessToken + refreshToken | ✅ |
| 3 | 로그인 실패 (없는 이메일) | "가입되지 않은 이메일" | ✅ 정확한 메시지 반환 | ✅ |
| 4 | 로그인 실패 (비밀번호 틀림) | "비밀번호가 올바르지 않습니다" | ✅ 정확한 메시지 반환 | ✅ |
| 5 | 재료 추가 | 소비기한 자동계산 포함 재료 반환 | ✅ expiration_date, urgency 포함 | ✅ |
| 6 | 만료 임박 재료 조회 | D-5 이내 재료 목록 | ✅ days_remaining 기준 필터링 | ✅ |
| 7 | 레시피 추천 | 재료 매칭률 높은 3개 | ✅ 시금치 된장국, 계란 볶음밥 등 | ✅ |
| 8 | 레시피 저장 | UUID 포함 history 레코드 | ✅ id 반환 | ✅ |
| 9 | 요리 완성 + 그린포인트 | 포인트 적립 | ✅ 11.9pt 적립 확인 | ✅ |
| 10 | 쇼핑리스트 추가 | UUID 포함 item 반환 | ✅ id 포함 정상 저장 | ✅ |
| 11 | 쇼핑리스트 일괄 추가 | 중복 제외 후 추가 | ✅ added 배열 반환 | ✅ |
| 12 | 구매완료 처리 | is_purchased = 1 | ✅ 업데이트 확인 | ✅ |

**레시피 추천 테스트 상세**

입력 재료: 계란, 시금치, 간장, 양파 (4종)

| 추천 레시피 | 매칭 재료 | 매칭률 | 추천 점수 |
|-------------|-----------|--------|-----------|
| 시금치 된장국 | 시금치, 간장 (2/4) | 50% | 0.42 |
| 계란 볶음밥 | 계란, 양파, 간장 (3/5) | 60% | 0.38 |
| 토마토 계란 볶음 | 계란 (1/4) | 25% | 0.30 |

---

## 6. 결론

### 구현 결과

4주에 걸쳐 냉장고 재료 기반 AI 레시피 추천 앱을 설계·구현하였다.

- **백엔드**: Express.js + SQLite로 REST API 19개 구현, JWT 인증 완성
- **프론트엔드**: React 19 기반 5개 페이지 (홈/냉장고/레시피/쇼핑/마이리페) 구현
- **AI 연동**: Google Gemini 2.5 Flash 실연동 완성, JSON 모드 적용 (Mock 10종 fallback 포함)
- **데이터**: 230개+ 식재료별 소비기한 DB 내장
- **핵심 흐름**: 로그인 → 재료 추가 → 레시피 추천 → 요리 완성 → 재료 차감 → 포인트 적립 전 과정 정상 동작 확인

### 아쉬운 점

| 항목 | 상태 | 사유 |
|------|------|------|
| OCR 영수증 인식 | 미구현 | Google Cloud Vision 설정 복잡도 |
| 플레이스토어 배포 | 미완 | 개발자 계정 등록 및 빌드 작업 필요 |
| 식재료 정규화 | 부분적 | "파", "대파", "쪽파" 동일 개념 처리 미완 |
| AI 응답 속도 | 개선 필요 | Gemini 2.5 Flash 평균 응답 15~30초 |

### 향후 개선 방향

1. **Google OAuth 로그인** → 기존 OAuth 구조 재사용, 소셜 로그인 추가
2. **PWA 변환 + 플레이스토어 배포** → `vite-plugin-pwa` 설정 + TWA(Trusted Web Activity)로 Android 배포
3. **식재료 정규화** → 동의어 매핑 테이블 구축 (파→대파, 적양파→양파 등)
4. **OCR 영수증 인식** → Google Cloud Vision API 연동, 마트 영수증 자동 파싱
5. **AI 응답 캐시 고도화** → 재료 조합별 24시간 캐시 활용으로 반복 요청 속도 개선

---

*본 프로젝트는 4주간의 개인 종합설계 과제로, React + Node.js + SQLite 풀스택 구현 및 Google Gemini 2.5 Flash AI를 연동하여 실제 동작하는 레시피 추천 앱을 설계·구현하였습니다.*
