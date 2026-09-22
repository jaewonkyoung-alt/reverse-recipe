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

  # ── 무시된 파일 경고 ────────────────────────────────────────
  # 봇이 만든 파일이 .gitignore 에 걸리면 git status 에 안 잡혀
  # 그 파일을 import 하는 코드만 푸시되어 원격 빌드가 깨진다.
  # (실제 발생: backend/src/data/*.ts 가 'data/' 규칙에 걸림)
  IGNORED="$(git status --porcelain --ignored 2>/dev/null \
             | awk '$1=="!!"{print $2}' \
             | grep -E '\.(ts|tsx|js|jsx|json)$' || true)"
  if [ -n "$IGNORED" ]; then
    echo ""
    echo "!! 경고: 아래 소스 파일이 .gitignore 에 걸려 푸시에서 빠진다"
    printf '   %s\n' $IGNORED
    echo "   import 하는 코드만 올라가면 원격 빌드가 깨진다. .gitignore 확인할 것."
    exit 4
  fi

  # ── 비밀값 스캔 ──────────────────────────────────────────────
  # grep 정규식은 시스템 grep(ugrep)에서 complexity limit 으로 조용히 죽는다.
  # 에러가 나도 종료코드가 0이라 "깨끗함"으로 통과해버리므로 파이썬으로 한다.
  LEAK=0
  for f in "${DELTA[@]}"; do
    [ -f "$f" ] || continue
    case "$f" in
      *.env|*.env.*|*/.env) echo "!! 중단: $f 는 환경파일"; LEAK=1; continue ;;
    esac
    if ! python3 "$HERE/parse.py" scan "$f"; then
      LEAK=1
    fi
  done
  [ "$LEAK" -eq 1 ] && { echo "비밀값 의심으로 푸시 중단."; exit 3; }

  # ── 브랜치 ──────────────────────────────────────────────────
  # 날짜만 쓰면 같은 날 두 번째 사이클이 이전 브랜치를 재사용해
  # 이미 머지된 작업을 되돌리는 커밋이 된다 (실제 발생).
  # 매번 origin/main 에서 새로 딴다. 시각까지 붙여 충돌을 없앤다.
  BRANCH="autoteam/$(date +%Y%m%d-%H%M%S)"
  git fetch -q origin main || { echo "fetch 실패"; exit 6; }
  if ! git checkout -q -b "$BRANCH" origin/main; then
    echo "!! 브랜치 생성 실패 — main 에 커밋되는 것을 막기 위해 중단한다."
    exit 6
  fi
  # 체크아웃이 실패했는데도 진행되면 main 을 오염시킨다. 반드시 확인.
  CUR="$(git rev-parse --abbrev-ref HEAD)"
  [ "$CUR" = "$BRANCH" ] || { echo "!! 현재 브랜치가 $CUR 다. 중단."; exit 6; }

  git add -- "${DELTA[@]}"
  git diff --cached --quiet && { echo "스테이징 결과 비어있음."; exit 0; }

  git commit -q -m "auto: ${SUMMARY:-봇 자동 변경} ($(date +%Y-%m-%d))

$(printf '%s\n' "${DELTA[@]}" | sed 's/^/- /')

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" || exit 4

  git push -u origin "$BRANCH" || exit 5
  echo "푸시 완료: $BRANCH"

  if command -v gh >/dev/null 2>&1; then
    gh pr create --base main --head "$BRANCH" \
      --title "auto: ${SUMMARY:-봇 자동 변경} ($(date +%Y-%m-%d))" \
      --body "$(printf '## 변경\n%s\n\n## 검토 포인트\n- 평가자(Grok) PASS 판정 후 자동 생성됨\n- 병합 전 사람 확인 필요\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n' "$(printf '%s\n' "${DELTA[@]}" | sed 's/^/- /')")" \
      && echo "PR 생성됨"
  fi
  ;;

*) echo "사용법: publish.sh {baseline|push} <기준선파일> [요약]"; exit 2 ;;
esac
