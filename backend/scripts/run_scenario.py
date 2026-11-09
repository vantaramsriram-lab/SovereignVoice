"""Run a demo scenario through Llama + the CRM validator, and check the result.

Uses the real Groq integration from the app. There is no fallback: if
the provider is not configured or fails, the script reports the error and exits
non-zero. Nothing is simulated.

Usage
-----
    python scripts/run_scenario.py ../demo_scenarios/scenario-01-....json
    python scripts/run_scenario.py --all ../demo_scenarios
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Make `backend/` and `backend/scripts/` importable however the script is run.
_here = Path(__file__).resolve().parent
for _candidate in (_here.parent, _here):
    if str(_candidate) not in sys.path:
        sys.path.insert(0, str(_candidate))

from app.config import settings  # noqa: E402
from app.errors import IntegrationError  # noqa: E402
from app.services.crm.validator import validate_analysis  # noqa: E402
from app.services.llm.groq import analyse  # noqa: E402

GREEN = "\033[92m"
RED = "\033[91m"
DIM = "\033[2m"
BOLD = "\033[1m"
RESET = "\033[0m"


def load(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def check(actual: dict, expected: dict) -> list[tuple[str, bool, str]]:
    results: list[tuple[str, bool, str]] = []
    crm = actual["crm"]

    for key in ("payment_commitment", "dispute_raised", "complaint_raised", "human_review_required"):
        if key in expected:
            ok = bool(crm[key]) == bool(expected[key])
            results.append((key, ok, f"expected {expected[key]}, got {crm[key]}"))

    if "promised_amount" in expected:
        value = crm.get("promised_amount")
        if expected["promised_amount"] is None:
            ok = value is None
            results.append(("promised_amount is null", ok, f"got {value!r}"))
        else:
            ok = bool(value)
            results.append(("promised_amount present", ok, f"got {value!r}"))

    if "promised_date_present" in expected:
        has_date = crm.get("promised_date") is not None
        ok = has_date == bool(expected["promised_date_present"])
        results.append(("promised_date presence", ok, f"got {crm.get('promised_date')!r}"))

    if "promised_date_normalized" in expected and expected["promised_date_normalized"] is None:
        date = crm.get("promised_date") or {}
        ok = date.get("normalized_date") is None
        results.append(
            ("uncertain date not normalised", ok, f"got {date.get('normalized_date')!r}")
        )

    if "payment_intention" in expected:
        ok = crm.get("payment_intention") == expected["payment_intention"]
        results.append(
            ("payment_intention", ok, f"expected {expected['payment_intention']}, got {crm.get('payment_intention')}")
        )

    if "sentiment" in expected:
        ok = crm.get("sentiment") == expected["sentiment"]
        results.append(("sentiment", ok, f"expected {expected['sentiment']}, got {crm.get('sentiment')}"))

    if "min_confidence" in expected:
        order = {"low": 0, "medium": 1, "high": 2}
        ok = order.get(crm.get("confidence", "low"), 0) >= order[expected["min_confidence"]]
        results.append(
            ("confidence floor", ok, f"expected >= {expected['min_confidence']}, got {crm.get('confidence')}")
        )

    return results


async def run_one(path: Path) -> bool:
    scenario = load(path)
    print(f"\n{BOLD}{scenario['id']}{RESET} — {scenario['title']}")
    print(f"{DIM}language: {scenario.get('language', '—')}{RESET}")
    print(f"{DIM}transcript: {scenario['transcript']}{RESET}\n")

    try:
        result = await analyse(
            transcript=scenario["transcript"],
            agent_context=scenario.get("agent_context"),
        )
    except IntegrationError as exc:
        print(f"{RED}PROVIDER ERROR{RESET} [{exc.service}] {exc.message}")
        if exc.detail:
            print(f"{DIM}{exc.detail}{RESET}")
        return False

    validated, rules = validate_analysis(result.analysis, scenario["transcript"])
    payload = validated.model_dump()

    print(f"{BOLD}Validator rules applied:{RESET} {rules or '(none)'}")
    print(f"{BOLD}CRM:{RESET} {json.dumps(payload['crm'], indent=2, ensure_ascii=False)}")
    print(f"{BOLD}Summary:{RESET} {payload['summary']['narrative']}")

    checks = check(payload, scenario.get("expected", {}))
    ok = True
    for label, passed, detail in checks:
        mark = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
        print(f"  [{mark}] {label} — {detail}")
        ok &= passed
    return ok


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", help="Scenario JSON file")
    parser.add_argument("--all", metavar="DIR", help="Run every scenario in a directory")
    args = parser.parse_args()

    if not settings.llm_configured:
        print(
            f"{RED}Groq is not configured.{RESET} "
            "Set GROQ_API_KEY, GROQ_MODEL and GROQ_API_URL in backend/.env first."
        )
        return 2

    if args.all:
        files = sorted(Path(args.all).glob("*.json"))
    elif args.path:
        files = [Path(args.path)]
    else:
        parser.error("provide a scenario path or --all <dir>")

    if not files:
        print(f"{RED}No scenario files found.{RESET}")
        return 2

    outcomes = [await run_one(path) for path in files]
    passed = sum(1 for outcome in outcomes if outcome)
    print(f"\n{BOLD}{passed}/{len(outcomes)} scenario(s) met all expected properties.{RESET}")
    print(
        f"{DIM}Note: model wording varies. These checks assert financial-safety "
        f"properties, not exact text.{RESET}"
    )
    return 0 if passed == len(outcomes) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
