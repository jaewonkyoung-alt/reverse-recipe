#!/usr/bin/env bash
# 봇이 변경한 것만 골라 브랜치에 커밋하고 PR을 연다.
#
#   publish.sh baseline <파일>   실행 전 상태를 기록
#   publish.sh push <파일> <요약> 델타만 커밋 + 푸시 + PR
#
# 안전장치
#   - main 에 직접 푸시하지 않는다 (autoteam/<날짜> 브랜치)
#   - force push 하지 않는다
#   - 실행 전부터 있던 미커밋 작업은 건드리지 않는다 (baseline 델타만)
#   - 커밋 전 비밀값 스캔
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
cd "$PROJECT_ROOT" || exit 2

MODE="${1:-}"; BASE="${2:-}"; SUMMARY="${3:-}"

case "$MODE" in
baseline)
  git status --porcelain | awk '{print $NF}' | sort > "$BASE"
  echo "기준선 기록: $(wc -l < "$BASE" | tr -d ' ')개 파일이 이미 미커밋 상태"
  ;;

push)
  [ -f "$BASE" ] || { echo "기준선 파일 없음: $BASE"; exit 2; }

  # 지금 바뀐 것 중 기준선에 없던 것 = 봇이 만든 델타
  # (macOS 기본 bash 3.2 에는 mapfile 이 없으므로 while-read 로 채운다)
  DELTA=()
  while IFS= read -r line; do
    [ -n "$line" ] && DELTA+=("$line")
  done < <(git status --porcelain | awk '{print $NF}' | sort | comm -23 - "$BASE")

  if [ "${#DELTA[@]}" -eq 0 ]; then
    echo "봇이 바꾼 파일 없음. 커밋 생략."
    exit 0
  fi

  echo "봇 변경 파일 ${#DELTA[@]}개:"
  printf '  %s\n' "${DELTA[@]}"

  # ── 비밀값 스캔 ──────────────────────────────────────────────
  LEAK=0
  for f in "${DELTA[@]}"; do
    [ -f "$f" ] || continue
    case "$f" in *.env|*.env.*|*/.env) echo "!! 중단: $f 는 환경파일"; LEAK=1; continue;; esac
    if grep -qE '(AIza[0-9A-Za-z_-]{35}|gh[pousr]_[0-9A-Za-z]{36}|xai-[0-9A-Za-z]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' "$f" 2>/dev/null; then
      echo "!! 중단: $f 에 비밀값으로 보이는 문자열"
      LEAK=1
    fi
  done
  [ "$LEAK" -eq 1 ] && { echo "비밀값 의심으로 푸시 중단."; exit 3; }

  BRANCH="autoteam/$(date +%Y%m%d)"
  git rev-parse --verify "$BRANCH" >/dev/null 2>&1 \
    && git checkout "$BRANCH" >/dev/null 2>&1 \
    || git checkout -b "$BRANCH" >/dev/null 2>&1

  git add -- "${DELTA[@]}"
  git diff --cached --quiet && { echo "스테이징 결과 비어있음."; exit 0; }

  git commit -q -m "auto: ${SUMMARY:-봇 자동 변경} ($(date +%Y-%m-%d))

$(printf '%s\n' "${DELTA[@]}" | sed 's/^/- /')

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" || exit 4

  git push -u origin "$BRANCH" || exit 5
  echo "푸시 완료: $BRANCH"

  if command -v gh >/dev/null 2>&1; then
    gh pr view "$BRANCH" >/dev/null 2>&1 && { echo "PR 이미 존재 — 커밋만 추가됨"; exit 0; }
    gh pr create --base main --head "$BRANCH" \
      --title "auto: ${SUMMARY:-봇 자동 변경} ($(date +%Y-%m-%d))" \
      --body "$(printf '## 변경\n%s\n\n## 검토 포인트\n- 평가자(Grok) PASS 판정 후 자동 생성됨\n- 병합 전 사람 확인 필요\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n' "$(printf '%s\n' "${DELTA[@]}" | sed 's/^/- /')")" \
      && echo "PR 생성됨"
  fi
  ;;

*) echo "사용법: publish.sh {baseline|push} <기준선파일> [요약]"; exit 2 ;;
esac
