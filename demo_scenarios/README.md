# Demo scenarios (illustrative fixtures)

> **These are NOT real customer analyses.** Every file here is a hand-written,
> clearly labelled illustration of the kind of conversation SovereignVoice is
> designed for. They exist so you can exercise the LLM + CRM validator without
> needing your own call recordings, and so reviewers can see the safety rules in
> action.
>
> Nothing in this folder is loaded automatically by the application, and nothing
> here is presented as a completed analysis of a real customer.

## What is in each file

| Field | Meaning |
|---|---|
| `illustrative` | Always `true`. These are fixtures, not records. |
| `id` | Fixture id. |
| `title` | Short human label. |
| `language` | Language / code-mixing described in the fixture. |
| `transcript` | A synthetic transcript written for this fixture. |
| `agent_context` | Optional context an agent might supply, or `null`. |
| `expected` | What a correct, conservative analysis should produce. |
| `why` | The reasoning the validator should follow. |

`expected` is **not** an exact-match assertion — real model output varies in
wording. It states the properties that must hold:
`payment_commitment`, `promised_amount`, `promised_date_present`,
`dispute_raised`, `human_review_required`, `min_confidence`.

## How to run a scenario

The scenarios only need the Groq integration (LLM + validator), not
Prisma or Timbre:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python scripts/run_scenario.py ..\demo_scenarios\scenario-01-salary-delay-codemixed.json
```

```bash
cd backend
source venv/bin/activate
python scripts/run_scenario.py ../demo_scenarios/scenario-01-salary-delay-codemixed.json
```

Run all of them:

```powershell
python scripts/run_scenario.py --all ..\demo_scenarios
```

The script prints the structured intelligence, the validator rules that fired,
and a PASS/FAIL summary against `expected`. A provider failure is reported as a
failure — the script never substitutes a canned analysis.

To run the same fixture through the HTTP API instead:

```powershell
Invoke-RestMethod -Method Post http://localhost:8000/api/integrations/llm/test `
  -ContentType 'application/json' `
  -Body (@{ transcript = '<paste transcript>'; agent_context = $null } | ConvertTo-Json)
```

## Adding a scenario for your own audio

1. Record or upload audio through the Home page.
2. Copy the verbatim transcript from the **Original transcript / View evidence**
   panel.
3. Save it as a new JSON file here, keeping `"illustrative": true`.
4. Never commit real customer audio, names, phone numbers or account numbers.
