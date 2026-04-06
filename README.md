# 리버스 레시피 (Reverse Recipe)

> 냉장고에 있는 재료를 입력하면 AI가 만들 수 있는 레시피를 추천해주는 웹 앱

**2021212843 경재원 | 종합설계 프로젝트**

---

## 프로젝트 소개

보통 레시피 앱은 "만들고 싶은 요리 → 필요한 재료"를 알려준다.
이 앱은 반대로 **"냉장고에 있는 재료 → 만들 수 있는 레시피"** 를 AI가 추천한다.
특히 소비기한이 임박한 재료를 우선 활용해 음식 낭비를 줄이는 것을 목표로 한다.

---

## 핵심 기능

- **회원가입 / 로그인** — 이메일+비밀번호, 게스트 모드 지원
- **냉장고 재료 관리** — 재료 추가/수정/삭제, 소비기한 자동 계산 (230개 식재료 DB 내장)
- **AI 레시피 추천** — Google Gemini 2.5 Flash 연동, 소비기한 임박 재료 우선 추천
- **요리 완성** — 단계별 조리 타이머, 완성 시 재료 자동 차감
- **쇼핑 리스트** — 부족한 재료 추가, 구매완료 체크
- **그린포인트** — 임박 재료 사용 시 환경 기여 포인트 적립

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 19, TypeScript, Vite, TailwindCSS, Zustand, Framer Motion |
| 백엔드 | Node.js, Express.js, TypeScript |
| 데이터베이스 | SQLite (better-sqlite3) |
| 인증 | JWT (accessToken 7일, refreshToken 30일) |
| AI | Google Gemini 2.5 Flash API |

---

## 실행 방법

**Node.js v22 필요 (nvm 사용 권장)**

```bash
# 1. 백엔드
cd backend
nvm use 22
npm install
npm rebuild better-sqlite3
# backend/.env 파일 생성 후 GEMINI_API_KEY 설정
node dist/index.js

# 2. 프론트엔드 (새 터미널)
cd frontend
npm install
npx vite --port 3000
```

접속: http://localhost:3000

### 환경 변수 (`backend/.env`)
```
PORT=4000
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key   # 없으면 Mock 레시피 10종으로 동작
```

> Gemini API 키는 https://aistudio.google.com 에서 무료 발급 가능

---

## 폴더 구조

```
reverse-recipe/
├── backend/
│   └── src/
│       ├── routes/       # auth, ingredients, recipes, shopping
│       ├── services/     # recipeService (Gemini 연동), ingredientService
│       ├── middleware/   # JWT 인증
│       └── db/           # SQLite 초기화 및 마이그레이션
├── frontend/
│   └── src/
│       ├── pages/        # HomePage, FridgePage, RecommendPage, ShoppingPage 등
│       ├── components/   # Layout, RecipeCard, IngredientCard 등
│       ├── store/        # Zustand 전역 상태
│       └── services/     # axios API 클라이언트
├── REPORT.md             # 최종 보고서
└── README.md
```

---

## AI 추천 점수 계산

```
추천 점수 = (소비기한 긴급도 × 0.5) + (재료 매칭률 × 0.4) + (선호도 × 0.1)
```

소비기한 긴급도: 1일 이하 → 1.0 / 3일 이하 → 0.8 / 7일 이하 → 0.5 / 그 이상 → 0.2

---

## 구현 범위

**완료한 기능**
- 회원 인증 (회원가입, 로그인, 게스트)
- 냉장고 재료 CRUD + 소비기한 자동 계산
- Google Gemini AI 레시피 추천
- 조리 타이머 + 요리 완성 처리
- 쇼핑 리스트 관리
- 그린포인트 적립

**시간 부족으로 제외한 기능**
- 영수증/냉장고 사진 자동 인식 (OCR)
- 쿠팡/네이버 쇼핑 가격 비교 연동
- 소셜 로그인 (카카오/구글 OAuth)
- 플레이스토어 배포

---

GitHub: https://github.com/jaewonkyoung-alt/reverse-recipe
