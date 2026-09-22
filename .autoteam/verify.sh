#!/usr/bin/env bash
# 타입체크를 스크립트가 직접 실행한다. 봇의 자기보고를 믿지 않는다.
#
#   verify.sh baseline           현재 에러 수를 기준선으로 저장
#   verify.sh check              기준선과 비교. 늘었으면 종료코드 1 + 에러 출력
#
# 이 저장소는 backend 에 기존 타입 에러가 14건 있다 (pg 호환 shim 탓,
# REBUILD_PLAN §1.2-①). 그래서 "0건"이 아니라 "기준선 대비 증가"로 판정한다.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
BASE_FILE="$HERE/.typecheck-baseline"

count_errors() {
  local be fe
  be=$(cd "$PROJECT_ROOT/backend"  && npx tsc --noEmit 2>&1 | grep -c 'error TS')
  fe=$(cd "$PROJECT_ROOT/frontend" && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -c 'error TS')
  echo "$be $fe"
}

case "${1:-}" in
baseline)
  read -r be fe <<< "$(count_errors)"
  printf '%s %s\n' "$be" "$fe" > "$BASE_FILE"
  echo "타입체크 기준선: backend ${be}건, frontend ${fe}건"
  ;;

check)
  [ -f "$BASE_FILE" ] || { echo "기준선 없음 — verify.sh baseline 먼저"; exit 2; }
  read -r obe ofe < "$BASE_FILE"
  read -r nbe nfe <<< "$(count_errors)"
  echo "타입체크: backend ${obe}→${nbe}, frontend ${ofe}→${nfe}"
  if [ "$nbe" -gt "$obe" ] || [ "$nfe" -gt "$ofe" ]; then
    echo ""
    echo "!! 타입 에러가 늘었다. 새로 생긴 것:"
    (cd "$PROJECT_ROOT/backend"  && npx tsc --noEmit 2>&1 | grep 'error TS' | head -8)
    (cd "$PROJECT_ROOT/frontend" && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep 'error TS' | head -8)
    exit 1
  fi
  echo "통과 (증가 없음)"
  ;;

*) echo "사용법: verify.sh {baseline|check}"; exit 2 ;;
esac
