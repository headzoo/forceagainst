#!/usr/bin/env bash
# Walk each state through `pnpm state-bills:sync` with a pause between runs.
# Scoped syncs avoid loading the full pending-detail backlog in one query.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STATES=(
  AL AK AZ AR CA CO CT DE FL GA
  HI ID IL IN IA KS KY LA ME MD
  MA MI MN MS MO MT NE NV NH NJ
  NM NY NC ND OH OK OR PA RI SC
  SD TN TX UT VT VA WA WV WI WY
)

SLEEP_SECONDS=300
DETAIL_BUDGET=100
FROM=""
DRY_RUN=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

  --sleep=SECONDS        Pause between states (default: ${SLEEP_SECONDS})
  --detail-budget=N      Passed to state-bills:sync (default: ${DETAIL_BUDGET})
  --from=STATE           Start at this two-letter code (inclusive)
  --dry-run              Forward --dry-run to each sync
  -h, --help             Show this help

Example:
  $(basename "$0") --sleep=600 --detail-budget=100 --from=NY
EOF
}

for argument in "$@"; do
  case "$argument" in
    --sleep=*)
      SLEEP_SECONDS="${argument#--sleep=}"
      if ! [[ "$SLEEP_SECONDS" =~ ^[0-9]+$ ]]; then
        echo "error: --sleep must be a non-negative integer" >&2
        exit 1
      fi
      ;;
    --detail-budget=*)
      DETAIL_BUDGET="${argument#--detail-budget=}"
      if ! [[ "$DETAIL_BUDGET" =~ ^[0-9]+$ ]] || (( DETAIL_BUDGET > 10000 )); then
        echo "error: --detail-budget must be a whole number between 0 and 10000" >&2
        exit 1
      fi
      ;;
    --from=*)
      FROM="${argument#--from=}"
      FROM="${FROM^^}"
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $argument" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -n "$FROM" ]]; then
  found=0
  for state in "${STATES[@]}"; do
    if [[ "$state" == "$FROM" ]]; then
      found=1
      break
    fi
  done
  if (( found == 0 )); then
    echo "error: --from=$FROM is not a supported state page code" >&2
    exit 1
  fi
fi

started=0
if [[ -z "$FROM" ]]; then
  started=1
fi

failed_states=()
ran=0
total="${#STATES[@]}"

echo "Syncing ${total} states with ${SLEEP_SECONDS}s pauses and --detail-budget=${DETAIL_BUDGET}"
if (( DRY_RUN == 1 )); then
  echo "Dry run: no database writes"
fi
echo

for state in "${STATES[@]}"; do
  if (( started == 0 )); then
    if [[ "$state" == "$FROM" ]]; then
      started=1
    else
      echo "skip ${state} (before --from=${FROM})"
      continue
    fi
  fi

  if (( ran > 0 && SLEEP_SECONDS > 0 )); then
    echo "pausing ${SLEEP_SECONDS}s before ${state}..."
    sleep "$SLEEP_SECONDS"
  fi

  echo "=== ${state} ($(date -Iseconds)) ==="
  args=(--state="$state" --detail-budget="$DETAIL_BUDGET")
  if (( DRY_RUN == 1 )); then
    args+=(--dry-run)
  fi

  if pnpm state-bills:sync -- "${args[@]}"; then
    echo "${state}: ok"
  else
    echo "${state}: failed" >&2
    failed_states+=("$state")
  fi
  echo
  ran=$((ran + 1))
done

if (( ${#failed_states[@]} > 0 )); then
  echo "Finished with ${#failed_states[@]} failed state(s): ${failed_states[*]}" >&2
  exit 1
fi

echo "Finished ${ran} state(s) with no failures."
