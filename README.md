# 🥗 리버스 레시피 (Reverse Recipe)

> **냉장고 재료 → AI 레시피 추천** — 기존 레시피 앱의 역발상!

---

## 📌 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 기술 스택 | React + TypeScript + TailwindCSS / Node.js + Express / PostgreSQL |
| AI 엔진 | Perplexity API (sonar-pro) |
| 인증 | JWT + 카카오 OAuth + 게스트 모드 |
| 배포 | Docker Compose |

---

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
npm run install:all
```

### 2. 환경 변수 설정
```bash
# 백엔드
cp backend/.env.example backend/.env
# 편집: DB 정보, JWT_SECRET, PERPLEXITY_API_KEY

# 프론트엔드
cp frontend/.env.example frontend/.env
```

### 3. PostgreSQL 실행 (Docker)
```bash
docker-compose up -d postgres
```

### 4. 데이터베이스 마이그레이션
```bash
npm run db:setup
```

### 5. 개발 서버 실행
```bash
npm run dev
```
- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:4000
- Health Check: http://localhost:4000/health

---

## 🐳 Docker로 전체 실행
```bash
# .env 파일 설정 후
docker-compose up -d

# 로그 확인
npm run docker:logs
```

---

## 📁 프로젝트 구조

```
reverse-recipe/
├── backend/
│   ├── src/
│   │   ├── index.ts           # Express 서버 진입점
│   │   ├── types/             # TypeScript 타입 정의
│   │   ├── db/
│   │   │   ├── index.ts       # PostgreSQL 연결 풀
│   │   │   └── migrate.ts     # DB 스키마 마이그레이션
│   │   ├── middleware/
│   │   │   └── auth.ts        # JWT 인증 미들웨어
│   │   ├── routes/
│   │   │   ├── auth.ts        # 인증 API
│   │   │   ├── ingredients.ts # 냉장고 재료 CRUD
│   │   │   ├── recipes.ts     # 레시피 추천/완성/히스토리
│   │   │   ├── shopping.ts    # 쇼핑 리스트 + 가격 비교
│   │   │   ├── vision.ts      # Phase 2: 사진 인식
│   │   │   └── purchases.ts   # Phase 3: 구매내역 자동등록
│   │   └── services/
│   │       ├── ingredientService.ts  # 재료 비즈니스 로직
│   │       └── recipeService.ts      # Perplexity API + 추천 알고리즘
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # 라우터 설정
│   │   ├── main.tsx           # 진입점
│   │   ├── index.css          # Tailwind + 글로벌 스타일
│   │   ├── types/             # 공유 타입 정의
│   │   ├── store/             # Zustand 상태 관리
│   │   ├── services/
│   │   │   └── api.ts         # Axios API 클라이언트
│   │   ├── components/
│   │   │   ├── Layout.tsx         # 공통 레이아웃 + 하단 네비
│   │   │   ├── IngredientCard.tsx # 재료 카드 (유통기한 배지)
│   │   │   ├── AddIngredientModal.tsx # 재료 추가/수정 모달
│   │   │   ├── RecipeCard.tsx     # 레시피 카드
│   │   │   ├── CookingTimer.tsx   # 조리 타이머 (MM:SS + 차임)
│   │   │   └── SNSShareCard.tsx   # Phase 2: SNS 공유 카드
│   │   └── pages/
│   │       ├── HomePage.tsx       # 홈 (통계 대시보드)
│   │       ├── FridgePage.tsx     # 냉장고 관리
│   │       ├── RecommendPage.tsx  # AI 레시피 추천
│   │       ├── RecipeDetailPage.tsx # 레시피 상세 + 타이머
│   │       ├── ShoppingPage.tsx   # 쇼핑 리스트 + 가격 비교
│   │       └── ProfilePage.tsx    # 프로필 + 그린포인트
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── package.json
```

---

## 🔑 환경 변수

### 백엔드 (`backend/.env`)
| 변수 | 설명 | 필수 |
|------|------|------|
| `DB_HOST` | PostgreSQL 호스트 | ✅ |
| `DB_PASSWORD` | PostgreSQL 비밀번호 | ✅ |
| `JWT_SECRET` | JWT 서명 키 (32자 이상 권장) | ✅ |
| `PERPLEXITY_API_KEY` | Perplexity AI API 키 | 없으면 Mock 데이터 사용 |
| `KAKAO_CLIENT_ID` | 카카오 소셜 로그인 | 선택 |
| `OPENAI_API_KEY` | 냉장고 사진 인식 (Phase 2) | 선택 |

---

## 🤖 AI 추천 알고리즘

```
추천 점수 = (유통기한 긴급도 × 0.5) + (재료 매칭률 × 0.4) + (선호도 × 0.1)
```

### 유통기한 긴급도 가중치
- **≤1일** → 1.0 (RED 🔴)
- **≤3일** → 0.8
- **≤7일** → 0.5 (YELLOW 🟡)
- **>7일** → 0.2 (GREEN 🟢)

---

## 🌿 그린포인트 (환경 점수)

```
그린포인트 = (처리 비용 점수 × 0.5) + (생산 에너지 점수 × 0.5)
```
- 유통기한 임박 재료 사용 완료 시 최대 **2배 보너스** 지급

---

## 📱 구현된 기능

### Phase 1 ✅ (MVP)
- [x] 냉장고 재료 CRUD (카테고리별 자동 유통기한)
- [x] 유통기한 색상 배지 (🔴🟡🟢)
- [x] Perplexity AI 레시피 추천 (Mock 폴백 지원)
- [x] 레시피 필터 (요리종류/유형/난이도)
- [x] 조리 타이머 (MM:SS + 차임벨)
- [x] 쇼핑 리스트 + 가격 비교
- [x] JWT + 게스트 모드 인증
- [x] 그린포인트 적립

### Phase 2 ✅ (SNS + 환경)
- [x] SNS 공유 카드 (html2canvas)
- [x] 카카오 공유 API 연동
- [x] 냉장고 사진 인식 (GPT-4o Vision)
- [x] 환경 점수 대시보드

### Phase 3 ✅ (커머스)
- [x] 플랫폼 가격 비교 (쿠팡/네이버/컬리)
- [x] 구매내역 자동 등록 (NLP 파싱)
- [x] 제휴 링크 연결

---

## 🎨 디자인 토큰

```css
--primary: #10B981 (에메랄드 그린)
--primary-light: #D1FAE5
--accent: #F59E0B (앰버)
--danger: #EF4444
--bg: #FAFAF9
--surface: #FFFFFF
--text: #1C1917
--text-muted: #78716C
```

---

## 📡 API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/guest` | 게스트 로그인 |
| GET | `/api/ingredients` | 재료 목록 (유통기한 오름차순) |
| POST | `/api/ingredients` | 재료 추가 |
| PUT | `/api/ingredients/:id` | 재료 수정 |
| DELETE | `/api/ingredients/:id` | 재료 삭제 |
| GET | `/api/ingredients/expiring` | 만료 임박 재료 |
| POST | `/api/recipes/recommend` | AI 레시피 추천 |
| POST | `/api/recipes/save` | 레시피 저장 |
| POST | `/api/recipes/:id/complete` | 레시피 완성 + 그린포인트 |
| GET | `/api/recipes/green-points` | 그린포인트 조회 |
| GET | `/api/shopping` | 쇼핑 리스트 조회 |
| POST | `/api/shopping/bulk` | 일괄 추가 |
| POST | `/api/shopping/search` | 가격 비교 |
| POST | `/api/vision/fridge` | 냉장고 사진 인식 |
| POST | `/api/purchases/import/mock` | 구매내역 데모 임포트 |

---

*Built with ❤️ — Reverse Recipe v1.0.0*
