#!/usr/bin/env bash
# 역할 ↔ CLI 어댑터
# 도구를 바꾸려면 아래 함수 본문 한 줄만 고치면 된다.
# 각 함수는 프롬프트 문자열을 $1로 받아 stdout으로 결과를 낸다.

PROJECT_ROOT="/Users/kyoungjaewon/AI결과물/리버스레시피_클로드"

# ── Gemini 인증 ────────────────────────────────────────────────────
# Code Assist 개인용 OAuth는 2026-09 기준 지원 중단됐다.
# ("This client is no longer supported for Gemini Code Assist for individuals")
# → API 키 방식을 쓴다. 키는 backend/.env 에 이미 있는 것을 재사용하며
#   이 파일에 복제하지 않는다. (.env 는 gitignore 처리되어 있음)
if [ -z "${GEMINI_API_KEY:-}" ] && [ -f "$PROJECT_ROOT/backend/.env" ]; then
  GEMINI_API_KEY="$(grep -m1 '^GEMINI_API_KEY=' "$PROJECT_ROOT/backend/.env" \
                    | cut -d= -f2- | tr -d '"'"'"' ')"
  export GEMINI_API_KEY
fi

# ── 프로그래머: 파일을 실제로 고쳐야 하므로 에이전틱 + 편집 권한 필요
role_programmer() {
  claude -p "$1" --permission-mode acceptEdits
}

# ── 평가자 ─────────────────────────────────────────────────────────
# 1순위 Grok (Claude 와 다른 계열 → 교차 검증).
# Grok 무료 한도가 소진되면 {"type":"error",...usage limit...} 을 내므로
# 그 경우 Claude 로 폴백해 사이클을 이어간다. 교차 검증 효과는 줄어든다.
GROK_BIN="${GROK_BIN:-$HOME/.grok/bin/grok}"
EVAL_SCHEMA="$PROJECT_ROOT/.autoteam/evaluator-schema.json"

role_evaluator() {
  local out
  out="$("$GROK_BIN" -p "$1" --json-schema "$(cat "$EVAL_SCHEMA")" --max-turns 4 2>/dev/null)"
  if printf '%s' "$out" | grep -q '"type":"error"'; then
    echo "[평가자] Grok 한도 소진 — Claude 로 폴백" >&2
    claude -p "$1

## 출력 형식 (엄수)
다른 말 없이 아래 스키마의 JSON 객체 하나만 출력하라. 코드펜스도 쓰지 마라.
$(cat "$EVAL_SCHEMA")" --permission-mode plan
  else
    printf '%s' "$out"
  fi
}

# ── 재무부: RELEASE.md 등 문서를 써야 하므로 편집 권한 필요.
#    코드는 건드리지 않도록 프롬프트로 막는다.
role_finance() {
  gemini -p "$1" --approval-mode auto_edit
}

# ── Grok Build 설치 후 평가자를 그록으로 바꾸려면 위를 주석 처리하고 아래를 쓴다.
#    헤드리스 플래그는 설치 후 `grok --help`로 확인할 것.
# role_evaluator() { grok -p "$1"; }

MAX_ROUNDS=3   # 프로그래머↔평가자 왕복 상한
MAX_TURNS=10   # 전체 턴 상한 (안전장치)
