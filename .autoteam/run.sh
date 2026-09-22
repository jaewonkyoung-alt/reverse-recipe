#!/usr/bin/env bash
# 리버스레시피 3역할 오케스트레이터
#
#   ./run.sh              드라이런 (무엇을 할지만 출력, 실제 호출 없음)
#   ./run.sh --run        실제 실행
#   ./run.sh --run dev        프로그래머 ↔ 평가자 루프만
#   ./run.sh --run release    재무부 ↔ 평가자 루프만
#   ./run.sh --run full       release 후 dev (기본값)
#
# 종료 코드: 0=PASS  1=라운드 소진  2=사람 개입 필요

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/config.sh"

DRY=1; MODE="full"
for a in "$@"; do
  case "$a" in
    --run) DRY=0 ;;
    dev|release|full) MODE="$a" ;;
    *) echo "알 수 없는 인자: $a"; exit 2 ;;
  esac
done

STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$HERE/logs/$STAMP"
mkdir -p "$LOG"
cd "$PROJECT_ROOT" || exit 2

say() { printf '\n\033[1m── %s\033[0m\n' "$*"; }
note() { printf '   %s\n' "$*"; }

# 역할 실행: $1=역할 $2=프롬프트파일 $3=추가컨텍스트 $4=출력파일
invoke() {
  local role="$1" pfile="$2" extra="$3" out="$4"
  local prompt
  prompt="$(cat "$HERE/prompts/_common.md")

---

$(cat "$HERE/prompts/$pfile")

---

## 런타임 컨텍스트
$extra"

  if [ "$DRY" -eq 1 ]; then
    note "[드라이런] $role 호출 예정 — 프롬프트 $(printf '%s' "$prompt" | wc -c | tr -d ' ')자"
    printf '%s' "$prompt" > "$out.prompt"
    printf '{"structuredOutput":{"verdict":"PASS","summary":"드라이런","p1":[]},"total_cost_usd":0}\n' > "$out"
    return 0
  fi

  printf '%s' "$prompt" > "$out.prompt"
  case "$role" in
    프로그래머) role_programmer "$prompt" ;;
    평가자)     role_evaluator  "$prompt" ;;
    재무부)     role_finance    "$prompt" ;;
  esac | tee "$out"
}

# 평가자 출력(JSON) 파싱. grok --json-schema 가 enum을 강제하므로
# verdict 가 셋 중 하나가 아닌 경우는 구조적으로 발생하지 않는다.
P="$HERE/parse.py"
verdict_of() { python3 "$P" verdict "$1" 2>/dev/null; }
p1_of()      { python3 "$P" p1      "$1" 2>/dev/null; }
cost_of()    { python3 "$P" cost    "$1" 2>/dev/null; }

# 한 역할을 평가자와 왕복시킨다. $1=역할 $2=프롬프트파일
loop_with_review() {
  local role="$1" pfile="$2" round=1 last="" v

  while [ "$round" -le "$MAX_ROUNDS" ]; do
    say "$role — $round/$MAX_ROUNDS 라운드"
    invoke "$role" "$pfile" \
      "현재 라운드: $round/$MAX_ROUNDS

### 평가자 지시 (비어있으면 BACKLOG에서 직접 고를 것)
$last" \
      "$LOG/${role}-r${round}.md"

    # ── 검증 게이트 ──────────────────────────────────────────────
    # 봇의 "검증: 실행 안 함" 자기보고를 믿지 않고 스크립트가 직접 돌린다.
    # 타입 에러가 늘었으면 평가자를 부르지 않고 바로 반려한다 (비용 절약).
    VERIFY_OUT=""
    if [ "$role" = "프로그래머" ] && [ "$DRY" -eq 0 ]; then
      say "타입체크 — 스크립트가 직접 실행"
      if VERIFY_OUT="$("$HERE/verify.sh" check 2>&1)"; then
        note "$(printf '%s' "$VERIFY_OUT" | head -1)"
      else
        note "$(printf '%s' "$VERIFY_OUT" | head -1)"
        note "타입 에러 증가 — 평가자 생략하고 반려한다."
        last="타입체크 실패. 아래 에러를 고쳐라. 이건 스크립트가 직접 실행한 결과다.

$VERIFY_OUT"
        round=$((round+1))
        continue
      fi
    fi

    say "평가자 — $role 결과 검증 ($round/$MAX_ROUNDS)"
    invoke "평가자" "evaluator.md" \
      "현재 라운드: $round/$MAX_ROUNDS
검증 대상: $role

### 스크립트가 직접 실행한 타입체크 결과 (봇 자기보고가 아님)
${VERIFY_OUT:-해당 없음}

### $role 의 이번 라운드 보고
$(cat "$LOG/${role}-r${round}.md" 2>/dev/null)" \
      "$LOG/평가자-${role}-r${round}.md"

    v="$(verdict_of "$LOG/평가자-${role}-r${round}.md")"
    # 에이전틱 취소 등으로 structuredOutput 이 비면 한 번 더 시도한다.
    if [ -z "$v" ] && [ "$DRY" -eq 0 ]; then
      note "구조화 출력 없음 — 평가자 1회 재시도"
      invoke "평가자" "evaluator.md" \
        "현재 라운드: $round/$MAX_ROUNDS
검증 대상: $role
주의: 파일을 더 읽지 말고 아래 정보만으로 즉시 판정하라.

### 스크립트가 직접 실행한 타입체크 결과
${VERIFY_OUT:-해당 없음}

### $role 의 보고
$(cat "$LOG/${role}-r${round}.md" 2>/dev/null)" \
        "$LOG/평가자-${role}-r${round}-retry.md"
      v="$(verdict_of "$LOG/평가자-${role}-r${round}-retry.md")"
    fi
    note "판정: ${v:-파싱실패}  (비용 \$$(cost_of "$LOG/평가자-${role}-r${round}.md"))"

    case "${v:-}" in
      PASS)     return 0 ;;
      ESCALATE) return 2 ;;
      REJECT)
        last="$(p1_of "$LOG/평가자-${role}-r${round}.md")"
        # REJECT인데 p1이 비면 프로그래머가 지시를 못 받는다. summary로 폴백.
        if [ -z "$last" ]; then
          last="$(python3 "$P" summary "$LOG/평가자-${role}-r${round}.md")"
          note "경고: p1이 비어 summary를 지시로 사용한다."
        fi
        ;;
      *)        note "VERDICT를 못 읽었다. 평가자 출력 형식 확인 필요."; return 2 ;;
    esac
    round=$((round+1))
  done
  return 1
}

# ── 실행 ────────────────────────────────────────────────────────────
say "리버스레시피 오케스트레이터  모드=$MODE  $([ $DRY -eq 1 ] && echo '드라이런' || echo '실행')"
note "로그: $LOG"
[ "$DRY" -eq 1 ] && note "실제로 돌리려면: ./run.sh --run $MODE"

# 실행 전 상태를 기록해 둔다. 이후 이 기준선과의 델타만 커밋한다.
BASELINE="$LOG/baseline.txt"
if [ "$DRY" -eq 0 ]; then
  "$HERE/publish.sh" baseline "$BASELINE"
else
  git -C "$PROJECT_ROOT" status --porcelain | awk '{print $NF}' | sort > "$BASELINE"
  note "[드라이런] 기준선 $(wc -l < "$BASELINE" | tr -d ' ')개 파일"
fi

rc=0
if [ "$MODE" = "release" ] || [ "$MODE" = "full" ]; then
  loop_with_review "재무부" "finance.md"; rc=$?
  [ $rc -ne 0 ] && { say "재무부 단계 중단 (코드 $rc)"; exit $rc; }
fi

if [ "$MODE" = "dev" ] || [ "$MODE" = "full" ]; then
  loop_with_review "프로그래머" "programmer.md"; rc=$?
fi

# PASS 일 때만 올린다. 반려/에스컬레이션 상태의 코드는 푸시하지 않는다.
if [ $rc -eq 0 ]; then
  say "GitHub 반영"
  if [ "$DRY" -eq 1 ]; then
    note "[드라이런] publish.sh push 호출 예정 (브랜치 autoteam/$(date +%Y%m%d))"
  else
    "$HERE/publish.sh" push "$BASELINE" "$MODE 사이클"
  fi
fi

case $rc in
  0) say "완료 — PASS" ;;
  1) say "라운드 소진. DECISIONS.md 확인 후 사람이 개입할 것." ;;
  2) say "사람 개입 필요. DECISIONS.md 확인." ;;
esac
exit $rc
