# SovereignVoice

**Enterprise multilingual voice intelligence for BFSI collection operations.**

SovereignVoice reads a customer phone conversation, understands it even when the
customer speaks a regional language or mixes languages mid-sentence, extracts
evidence-based CRM intelligence, and generates a natural localized response for a
human collection agent to review.

```
Customer audio
   -> Gnani Prisma (STT)        transcript, verbatim
   -> Groq LLM (Qwen)      structured understanding + response script
   -> CRM validator              financial-safety gate (backend, deterministic)
   -> Gnani Timbre (TTS)         localized response audio
```

> **What this is not.** SovereignVoice neither places calls nor messages
> customers. There is no telephony, no dialer, no voice-agent loop and no
> autonomous customer interaction. It is an analysis and response-generation
> platform: every decision stays with a human.

---

## Contents

1. [Project overview](#1-project-overview)
2. [Technology stack](#2-technology-stack)
3. [Architecture and AI pipeline](#3-architecture-and-ai-pipeline)
4. [Prerequisites](#4-prerequisites)
5. [Project structure](#5-project-structure)
6. [Frontend installation](#6-frontend-installation)
7. [Backend installation](#7-backend-installation)
8. [Running the frontend](#8-running-the-frontend)
9. [Running the backend](#9-running-the-backend)
10. [Environment configuration](#10-environment-configuration)
11. [The single shared Gnani API Key ID](#11-the-single-shared-gnani-api-key-id)
12. [Connecting Gnani Prisma (STT)](#12-connecting-gnani-prisma-stt)
13. [Configuring Groq](#13-configuring-hugging-face)
14. [Connecting Groq LLM (Qwen)](#14-connecting-groq-llm-qwen)
15. [Connecting Gnani Timbre (TTS)](#15-connecting-gnani-timbre-tts)
16. [Testing each integration independently](#16-testing-each-integration-independently)
17. [Running the complete pipeline](#17-running-the-complete-pipeline)
18. [Troubleshooting](#18-troubleshooting)
19. [Known limitations](#19-known-limitations)

---

## 1. Project overview

### Pages

| Page | Purpose |
|---|---|
| **Home** (`/`) | The product. A pill-shaped capture field that takes an uploaded audio file or a live microphone recording plus optional agent context, then runs the pipeline and shows the three result sections. Below it: the conventional-bot pain points and how SovereignVoice addresses them. |
| **Demo** (`/demo`) | The saved analyses from this browser (localStorage): customer audio, generated response audio, summary and CRM record for each. |

### The three result sections

1. **Generated localized response audio** — the TTS output plus the script it
   was generated from.
2. **Customer intelligence summary** — narrative plus statements split into
   *confirmed*, *inferred*, *uncertain* and *missing*.
3. **Structured CRM information** — language, payment reason, intention,
   commitment, promised amount/date, request, sentiment, next action, dispute
   flag, complaint flag, confidence and human-review status.

The original transcript is preserved verbatim inside a collapsible
**Original transcript / View evidence** panel, so the default view stays
uncluttered without discarding the evidence.

### The financial-safety contract

The backend validator (`backend/app/services/crm/validator.py`) re-reads the raw
transcript after the model answers and *only ever removes or downgrades claims*:

| Rule | Behaviour |
|---|---|
| No invented commitments | `payment_commitment` is reset to `false` unless the transcript contains explicit commitment language. |
| Hedges are not promises | "I will try", "let's see", "dekhta hu", "chustanu" force willingness, never a commitment. |
| No invented amounts | An amount is dropped unless the customer's own words contain it; the verbatim phrase is preserved. |
| No invented dates | The customer's original phrase is always kept; `normalized_date` is nulled when the phrase is ambiguous or unfindable. |
| Concessions are never approved | Waivers/settlements in model output are flagged for a human, never granted. |
| Disputes & complaints | Raised automatically when dispute/complaint language is present, and flagged as unverified when the model raises them without evidence. |
| Low confidence | Forces `human_review_required: true`. |

If the LLM returns unusable output, the API returns an explicit error — it never
falls back to a fabricated analysis.

---

## 2. Technology stack

**Frontend** — React 18, Vite 6, TypeScript (strict), Tailwind CSS, Framer
Motion, Lucide React, React Router. Storage: browser `localStorage` only.

**Backend** — Python 3.10+, FastAPI, Pydantic v2, HTTPX, python-dotenv,
python-multipart.

**No database.** No SQLite, PostgreSQL, MongoDB, Redis or ORM anywhere in the
project.

---

## 3. Architecture and AI pipeline

```
Browser (React)                       FastAPI backend                     Providers
───────────────                       ───────────────                     ─────────
VoiceInput ──multipart──►  POST /api/analyze
                            │
                            ├─ utils/audio.py     validate size/type/duration
                            ├─ services/stt/prisma.py    ─────────────────►  Gnani Prisma
                            │        └─ transcript (verbatim)                X-API-Key-ID
                            ├─ services/llm/groq.py ───────────────►  Groq
                            │        └─ structured JSON (Groq LLM (Qwen))       Bearer GROQ_API_KEY
                            ├─ services/crm/validator.py  deterministic safety gate
                            └─ services/tts/timbre.py    ─────────────────►  Gnani Timbre
                                     └─ audio bytes                         X-API-Key-ID
                            ◄── AnalysisResponse (JSON + base64 audio)
```

Separation of concerns is strict:

| Layer | File(s) | Owns |
|---|---|---|
| Presentation | `frontend/src` | UI, recording, playback, localStorage |
| API | `backend/app/api/routes` | HTTP contracts, validation, error mapping |
| Orchestration | `backend/app/services/pipeline.py` | stage order + real stage timings |
| STT | `backend/app/services/stt/prisma.py` | Gnani Prisma only |
| LLM | `backend/app/services/llm/*` | Groq + prompts + JSON repair |
| Safety | `backend/app/services/crm/validator.py` | Evidence checks, review flags |
| TTS | `backend/app/services/tts/timbre.py` | Gnani Timbre only |
| Schemas | `backend/app/schemas/*` | Pydantic request/response models |

The browser talks *only* to the FastAPI server. No provider credential ever
reaches the frontend.

---

## 4. Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18 LTS or newer (20+ recommended) |
| npm | 9 or newer |
| Python | 3.10 or newer |
| A browser | Chrome, Edge, Firefox or Safari (microphone recording needs a secure context: `localhost` counts) |
| Gnani account | an **API Key ID** valid for both Prisma (STT) and Timbre (TTS) |
| Groq account | an access token with access to `qwen/qwen3.8-27b` |

---

## 5. Project structure

```
SovereignVoice/
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── analysis.py          # /api/analyze + integration probes
│   │   │   └── health.py            # /health
│   │   ├── services/
│   │   │   ├── stt/prisma.py        # Gnani Prisma STT
│   │   │   ├── llm/
│   │   │   │   ├── groq.py   # Groq client + JSON repair
│   │   │   │   └── prompts.py       # conservative BFSI system prompt
│   │   │   ├── tts/timbre.py        # Gnani Timbre TTS
│   │   │   ├── crm/validator.py     # financial-safety gate
│   │   │   └── pipeline.py          # orchestration + stage tracing
│   │   ├── schemas/
│   │   │   ├── requests.py
│   │   │   └── responses.py
│   │   ├── utils/audio.py           # upload validation, container sniffing
│   │   ├── config.py                # env-driven settings (single API_KEY_ID)
│   │   ├── errors.py                # typed integration errors -> HTTP codes
│   │   └── main.py                  # FastAPI app, CORS, error handlers
│   ├── scripts/
│   │   ├── verify_pipeline.py       # end-to-end wiring verification
│   │   ├── run_scenario.py          # run demo fixtures through LLM+validator
│   │   └── mock_providers.py        # DEV ONLY: offline wiring checks
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── audio/AudioPlayer.tsx
│   │   │   ├── demo/DemoEntry.tsx
│   │   │   ├── home/{PainPointsSection,ConventionalBotPhone,SolutionSection}.tsx
│   │   │   ├── results/{AnalysisResults,IntelligenceSummary,CrmFields,TranscriptPanel}.tsx
│   │   │   ├── ui/{Logo,Waveform,Pill,Notice,Spinner,EmptyState,Reveal,SectionHeading,BackgroundAura}.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── VoiceInput.tsx        # pill input: upload + recording + context
│   │   │   └── ProcessingStages.tsx
│   │   ├── hooks/{useRecorder,useAudioSource,useHealth}.ts
│   │   ├── pages/{Home,Demo}.tsx
│   │   ├── services/{api,storage}.ts
│   │   ├── types/index.ts
│   │   ├── utils/{format,crm}.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── demo_scenarios/                   # clearly-labelled illustrative fixtures
├── .gitignore
└── README.md
```

---

## 6. Frontend installation

### Windows PowerShell

```powershell
cd SovereignVoice\frontend
npm install
```

### macOS / Linux

```bash
cd SovereignVoice/frontend
npm install
```

---

## 7. Backend installation

### Windows PowerShell

```powershell
cd SovereignVoice\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> If PowerShell blocks the activation script, allow local scripts once:
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

### macOS / Linux

```bash
cd SovereignVoice/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 8. Running the frontend

### Windows PowerShell

```powershell
cd frontend
npm install
npm run dev
```

### macOS / Linux

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

`vite.config.ts` proxies `/api` and `/health` to `http://127.0.0.1:8000`, so the
frontend and backend run side by side with no CORS setup and no frontend
environment file.

Production build:

```powershell
npm run build      # emits frontend/dist
npm run preview    # serves the build on :4173 (same proxy)
```

---

## 9. Running the backend

### Windows PowerShell

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### macOS / Linux

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then:

* API base: <http://localhost:8000>
* Interactive docs: <http://localhost:8000/docs>
* Health: <http://localhost:8000/health>

On startup the log states plainly which integrations are configured. If
credentials are missing, the API returns a `503 not_configured` error with the
exact variable names it needs — it never simulates a result.

---

## 10. Environment configuration

Copy the example file and fill it in.

### Windows PowerShell

```powershell
cd backend
Copy-Item .env.example .env
```

### macOS / Linux

```bash
cd backend
cp .env.example .env
```

Then open `backend/.env` and add:

1. **`API_KEY_ID`** — your Gnani API Key ID. This single value serves *both*
   Prisma and Timbre.
2. **`GROQ_API_KEY`** — your Groq access token.
3. **`GROQ_MODEL`** — `qwen/qwen3.8-27b` (already the default).

```powershell
# Open in Notepad (Windows)
notepad .env
```

```bash
# macOS / Linux
nano .env
```

Minimal working `.env`:

```dotenv
API_KEY_ID=your-single-gnani-api-key-id

PRISMA_API_URL=https://api.vachana.ai/stt/v3
PRISMA_MODEL=prisma-v3.0
PRISMA_LANGUAGE_CODE=indic-auto

TIMBRE_API_URL=https://api.vachana.ai/api/v1/tts/inference
TIMBRE_MODEL=timbre-v3.0
TIMBRE_VOICE=Shivani
TIMBRE_LANGUAGE=auto
TIMBRE_SPEED=1.0

GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions

CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
REQUEST_TIMEOUT=90
```

**Never** put any of these values in `frontend/.env`, in `localStorage`, or in
git. `backend/.env` is git-ignored.

---

## 11. The single shared Gnani API Key ID

This is a deliberate design decision and is enforced in code:

| Requirement | Where it happens |
|---|---|
| There is exactly **one** Gnani credential: `API_KEY_ID`. | `backend/app/config.py` |
| Gnani Prisma sends it as `X-API-Key-ID`. | `services/stt/prisma.py` |
| Gnani Timbre sends it as `X-API-Key-ID`. | `services/tts/timbre.py` |
| There is no `PRISMA_API_KEY_ID` and no `TIMBRE_API_KEY_ID`. | nowhere in the codebase |
| Groq keeps its own separate `GROQ_API_KEY`. | `services/llm/groq.py` |
| `/health` reports only *whether* the key is configured, never its value. | `api/routes/health.py` |

`GET /health` makes this verifiable:

```json
"config": {
  "gnani_api_key_configured": true,
  "gnani_auth_header": "X-API-Key-ID",
  "gnani_shared_key": true,
  "prisma": { "credential_source": "API_KEY_ID", "auth_header": "X-API-Key-ID" },
  "timbre": { "credential_source": "API_KEY_ID", "auth_header": "X-API-Key-ID" }
}
```

Both integrations reading the *same* attribute is also what makes the
"one key" guarantee impossible to break by accident.

---

## 12. Connecting Gnani Prisma (STT)

* **Endpoint:** `POST https://api.vachana.ai/stt/v3`
* **Auth header:** `X-API-Key-ID: <API_KEY_ID>` (the shared key)
* **Body:** `multipart/form-data`

| Key | Type | Value |
|---|---|---|
| `audio_file` | File | the uploaded audio |
| `model` | Text | `prisma-v3.0` |
| `language_code` | Text | `indic-auto` (configurable via `PRISMA_LANGUAGE_CODE`) |

Expected response (example from the provider's own console):

```json
{
  "success": true,
  "request_id": "01a1ba33-1141-79b6-be8c-03b180056881",
  "transcript": "నాకు ఈ నెల సంబళం గట్టి సరిచే చెప్పు.",
  "model": "prisma-v3.0",
  "processing_time": 0.345,
  "end_to_end_latency": 0.346,
  "detected_language_code": "te-IN"
}
```

What the service does with it:

* `success: false` → explicit provider error.
* No non-empty `transcript` → explicit provider error.
* `401/403` → credential error that names `API_KEY_ID` and `X-API-Key-ID`.
* `429` → rate-limit error; timeouts and connection failures map to `504`/`503`.
* `detected_language_code` is passed to the LLM and stored with the transcript.
* The transcript is stored **verbatim** and is never rewritten downstream.

Configure with `PRISMA_API_URL`, `PRISMA_MODEL`, `PRISMA_LANGUAGE_CODE`,
`PRISMA_TIMEOUT`.

---

## 13. Configuring Groq

1. Create a free API key at <https://console.groq.com/keys>.
2. Put it in `backend/.env`:

```dotenv
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
GROQ_MAX_TOKENS=1600
GROQ_TEMPERATURE=0.2
GROQ_TIMEOUT=90
```

Groq uses the OpenAI-compatible chat-completions shape. `GROQ_REASONING_FORMAT=hidden` keeps Qwen's `<think>` reasoning out of the JSON reply.

---

## 14. Connecting Groq LLM (Qwen)

The integration lives entirely in `backend/app/services/llm/`.

**Responsibilities:** interpret code-mixed speech, summarise, extract CRM
fields, split confirmed/inferred/uncertain/missing, detect sentiment, disputes
and complaints, identify intention vs. commitment, extract amounts and dates
only when stated, write the localized response script, and recommend a next
action.

**Prompt design** (`prompts.py`): a conservative BFSI analyst system prompt with
a hard *Financial Accuracy and Evidence* directive — never invent a commitment,
amount or date; hedges are not promises; missing information is `null`, never
`"N/A"`; concessions are only ever *recommended* for a human; output is a single
JSON object with a fixed shape.

**Robustness** in `groq.py`:

* strips markdown fences, extracts the first balanced JSON object;
* normalises common small-model deviations (bare string script, `"yes"/"no"`
  booleans, `"N/A"` placeholders, string dates);
* validates with Pydantic (`schemas/responses.py`);
* on malformed/unparseable output raises `llm_output_invalid` (HTTP 502) with
  `human_review_required: true` — it never invents a result.

**Deterministic second pass:** `services/crm/validator.py`. See
[§1](#the-financial-safety-contract).

---

## 15. Connecting Gnani Timbre (TTS)

* **Endpoint:** `POST https://api.vachana.ai/api/v1/tts/inference`
* **Auth header:** `X-API-Key-ID: <API_KEY_ID>` — the **same** shared key
* **Body:** `application/json`

```json
{
  "text": "Localized response text",
  "model": "timbre-v3.0",
  "language": "auto",
  "voice": "Shivani",
  "speed": 1.0,
  "audio_config": {
    "sample_rate": 48000,
    "num_channels": 1,
    "sample_width": 2,
    "encoding": "linear_pcm",
    "container": "wav"
  }
}
```

Response handling is written for the reality that **this endpoint returns audio
bytes, not JSON**:

* the client sends `Accept: audio/wav, audio/mpeg, audio/ogg, application/json;q=0.5`
  and reads `response.content`;
* if a deployment instead wraps the audio in JSON, `audio_base64` / `audio` /
  `audio_content` / `data` are decoded; an `audio_url` response produces a clear
  error rather than a broken player;
* empty or truncated payloads are rejected;
* the container is detected from the magic bytes, so `audio/wav` is labelled
  correctly even if the provider omits `Content-Type`;
* WAV duration is read from the header and returned to the UI.

Configurable: `TIMBRE_API_URL`, `TIMBRE_MODEL`, `TIMBRE_VOICE`,
`TIMBRE_LANGUAGE`, `TIMBRE_SPEED`, `TIMBRE_SAMPLE_RATE`,
`TIMBRE_NUM_CHANNELS`, `TIMBRE_SAMPLE_WIDTH`, `TIMBRE_ENCODING`,
`TIMBRE_CONTAINER`, `TIMBRE_TIMEOUT`.

---

## 16. Testing each integration independently

Every integration can be exercised on its own — no full pipeline required.
All examples assume the API is running on `:8000`.

### Health / configuration

```powershell
Invoke-RestMethod http://localhost:8000/health | ConvertTo-Json -Depth 6
```

```bash
curl -s http://localhost:8000/health | python -m json.tool
```

### STT only — Gnani Prisma

```powershell
curl.exe -X POST http://localhost:8000/api/integrations/stt/test `
  -F "audio_file=@C:\path\to\customer-call.wav"
```

```bash
curl -s -X POST http://localhost:8000/api/integrations/stt/test \
  -F "audio_file=@/path/to/customer-call.wav" | python -m json.tool
```

Returns the transcript, detected language, provider request id and the exact
`auth_header` used, plus the endpoint and model it sent.

### LLM only — Groq LLM (Qwen) + the validator

```powershell
$body = @{
  transcript    = "Sir main 15 tareekh ko paanch hazaar rupaye pay karunga, pakka."
  agent_context = "Customer asked whether the EMI can be reduced."
} | ConvertTo-Json

Invoke-RestMethod -Method Post http://localhost:8000/api/integrations/llm/test `
  -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 8
```

Returns `intelligence` (validated), `validator_rules_applied`, and
`raw_model_output` so you can see exactly what the model said versus what the
safety gate allowed through.

### TTS only — Gnani Timbre

Returns real audio bytes (save them and play them):

```powershell
curl.exe -X POST http://localhost:8000/api/integrations/tts/test `
  -H "Content-Type: application/json" `
  -d "{\"text\":\"Namaskaram, mee call ki dhanyavaadalu.\"}" `
  --output response.wav
```

Or get base64 JSON instead:

```powershell
$body = @{ text = "Namaskaram, mee call ki dhavaadalu." } | ConvertTo-Json
Invoke-RestMethod -Method Post http://localhost:8000/api/integrations/tts/test-json `
  -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 5
```

### Scenario fixtures (LLM + validator, no audio needed)

```powershell
cd backend
python scripts/run_scenario.py ..\demo_scenarios\scenario-01-salary-delay-codemixed.json
python scripts/run_scenario.py --all ..\demo_scenarios
```

```bash
cd backend
python scripts/run_scenario.py ../demo_scenarios/scenario-01-salary-delay-codemixed.json
python scripts/run_scenario.py --all ../demo_scenarios
```

Each fixture asserts the *financial-safety properties* that must hold (no
fabricated commitment, amounts kept verbatim, ambiguous dates not normalised,
mandatory human review) rather than exact wording. See
[`demo_scenarios/README.md`](demo_scenarios/README.md).

### Wiring check without provider credits (developers only)

`backend/scripts/mock_providers.py` is a **development-only** local server that
impersonates the three providers so you can verify multipart field names, the
`X-API-Key-ID` header, the JSON body shape and the binary-audio path offline. It
is never imported by the application, and the app will not fall back to it — if
credentials are missing the API says so.

```powershell
# terminal 1
cd backend
python scripts/mock_providers.py            # http://127.0.0.1:9099

# terminal 2 — point a throwaway .env at the mock, then start the API
$env:API_KEY_ID="mock-key-id"
$env:PRISMA_API_URL="http://127.0.0.1:9099/stt/v3"
$env:TIMBRE_API_URL="http://127.0.0.1:9099/api/v1/tts/inference"
$env:GROQ_API_KEY="mock-token"
$env:GROQ_API_URL="http://127.0.0.1:9099/v1/chat/completions"
uvicorn app.main:app --port 8000

# terminal 3
python scripts/verify_pipeline.py
```

`verify_pipeline.py` checks the real request shapes, that both Gnani calls use
the same credential source, that all five stages report honest timings, that the
transcript is preserved verbatim, that audio round-trips as WAV, that
unverifiable claims are flagged, and that bad audio is rejected with `422`.

---

## 17. Running the complete pipeline

1. Start the backend (§9) and confirm <http://localhost:8000/health> shows
   `"pipeline_ready": true`.
2. Start the frontend (§8) and open <http://localhost:5173>.
3. In the pill field either:
   * click the paperclip and choose a WAV/MP3/M4A/OGG/WEBM/FLAC file, or
   * click the microphone, allow access, and press stop when the call ends.
4. Optionally click the prompt line and add the collection agent's question.
5. Press **Analyze** (or `Ctrl`/`⌘` + `Enter`).

You will see the five stages of the pipeline, then the results. The record is
saved to this browser and appears on **Demo**.

Pipeline stages and their real status:

| Stage | Complete only when |
|---|---|
| Processing customer audio | the upload has been validated by the backend |
| Transcribing with Gnani Prisma | Prisma returned a non-empty transcript |
| Understanding conversation with the LLM | Groq returned parseable, schema-valid JSON |
| Generating customer intelligence | the safety validator finished |
| Generating localized response with Gnani Timbre | Timbre returned valid audio bytes |

Durations shown next to each stage are measured on the backend. No percentages
and no estimated times are ever displayed.

If a stage fails, the pipeline stops, the failing stage is marked, and the UI
shows the provider message plus the missing configuration if that was the cause.

---

## 18. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `503 not_configured` naming `API_KEY_ID` | The shared Gnani key is missing. Add it to `backend/.env` and restart uvicorn (env changes need a restart; `--reload` does not pick up `.env`). |
| `503 not_configured` naming `GROQ_API_KEY` | Groq token/model/URL incomplete in `backend/.env`. |
| Prisma `401/403` | `API_KEY_ID` is not a valid Gnani key. It is sent as `X-API-Key-ID` to both Prisma and Timbre — one wrong value fails both. |
| Groq `403` | The API key is invalid, or your account has no access to `GROQ_MODEL`. |
| Groq `404` | `GROQ_MODEL` or `GROQ_API_URL` is wrong. The router expects an OpenAI-compatible path ending in `/v1/chat/completions`. |
| `llm_output_invalid` | The model returned non-JSON or schema-breaking JSON. The UI shows the reason and requires human review; retry, and keep `GROQ_TEMPERATURE` low. |
| `429` from either provider | Provider rate limit for your key/token. Wait and retry. |
| Timbre returns audio but the player is silent | Check the browser tab is not muted; verify the probe wrote a non-trivial `response.wav` (`curl` probe in §16). |
| "The uploaded file does not look like a supported audio container" | The file's magic bytes are not audio. Re-export as WAV/MP3/M4A/OGG/WEBM/FLAC. |
| "Audio file is too large" | Raise `MAX_AUDIO_BYTES` (default 25 MB) in `backend/.env`. |
| Microphone button does nothing | Microphone APIs need a secure context. Use `http://localhost:5173` (not a LAN IP over plain HTTP), and allow mic permission in the browser. |
| Mic denied message | Allow microphone access for the site in browser settings, or just upload a file instead. |
| "Backend unreachable" in the UI | The FastAPI server is not running, or it is on a different port than the Vite proxy target (`127.0.0.1:8000`). |
| CORS error when not using the proxy | Point `VITE_API_BASE_URL` at the backend **and** add the frontend origin to `CORS_ORIGINS` in `backend/.env`. |
| Demo page empty after analysis | localStorage was full or blocked (private mode / hardened settings). The Home page shows a warning when a save fails; the analysis itself still displays. |
| `Set-ExecutionPolicy` error in PowerShell | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then activate again. |

---

## 19. Known limitations

These are honest boundaries, not omissions to be papered over.

1. **Provider response shapes are modelled from the supplied API references.**
   Prisma's JSON and Timbre's body were implemented from the screenshots in this
   brief. Prisma's response is treated defensively (several transcript aliases
   accepted). Timbre's *response* is the least certain part: it is handled as
   raw audio bytes (which is what a rendered audio player implies), with a
   defensive JSON/base64 fallback and a clear error if a deployment returns a
   URL instead. **Verify with a live key** before production use.
2. **`promised_amount_value` and `normalized_date` are best-effort.** The verbatim
   customer phrase is authoritative; both normalised fields are always nullable
   and are nulled when the phrase is ambiguous or unverifiable.
3. **The validator is lexicon-based.** Commitment/hedge/dispute/complaint
   detection covers common English, Hindi, Telugu, Tamil and Kannada cues. A
   language not in that list still works end-to-end, but fewer deterministic
   corrections fire — so low-confidence output is routed to human review rather
   than being "fixed" silently.
4. **Small-model behaviour.** Groq LLM (Qwen) occasionally needs the JSON
   repairs described in §14. Larger models can be swapped in with `GROQ_MODEL`
   with no code change.
5. **Single request, whole pipeline.** The backend is one HTTP request; the UI
   advances the highlighted stage client-side while it waits, and only the
   *completed* stages come from the server. Streaming/SSE stage events are not
   implemented.
6. **TTS re-synthesis is not wired to the UI.** The response audio is generated
   once per analysis from the reviewed script. Editing the script and
   regenerating is a backend endpoint away (`/api/integrations/tts/test`) but is
   not exposed as a UI action.
7. **localStorage limits.** Records include both audio files as data URLs, so the
   library is capped at 12 records and trims the oldest half on a quota error.
   Real deployments should move this to object storage.
8. **No authentication or multi-tenancy.** This is a demonstration platform, not
   a hardened multi-tenant service. There is no login, no per-user scoping and no
   audit log — deliberately, per the brief's "no unnecessary features" rule.
9. **Language coverage depends on the provider.** Prisma's `indic-auto` is used
   as configured; the UI shows whatever language code the provider detects.
10. **Audio duration for non-WAV files** is read by the browser during upload
    preview; if the browser cannot decode the container, duration shows as `—`
    instead of a guess.

---

## Acceptance checklist

- [x] Polished, responsive Home page with a pill-shaped capture interface
- [x] Navbar with exactly Home and Demo, sticky + blurred + active state
- [x] Audio file upload with size/duration, replace and remove
- [x] Microphone recording (MediaRecorder) with live level, timer, playback, delete
- [x] Audio preview for both input and generated response
- [x] Optional collection-agent context field
- [x] Analyze calls the backend; stages reflect real server-side progress
- [x] Gnani Prisma, Groq LLM (Qwen) and Gnani Timbre implemented as separate modules
- [x] Both Gnani integrations use the single `API_KEY_ID` via `X-API-Key-ID`
- [x] CRM output validated; transcript preserved verbatim
- [x] Commitments, amounts and dates never fabricated
- [x] Results limited to the three primary sections (+ collapsible evidence)
- [x] Demo page with per-record audio, summary, CRM; delete, clear all, empty state
- [x] localStorage persistence across refreshes, quota handled gracefully
- [x] Framer Motion animation set (nav, hero, scroll, waveform, processing, page transitions)
- [x] Conventional-bot pain-point section with phone illustration
- [x] "A better way…" solution section immediately after the pain points
- [x] Footer after the solution section, following the reference's visual direction
- [x] No credentials in the frontend; no database anywhere
- [x] `.env.example`, `.gitignore`, PowerShell + bash commands, troubleshooting
- [x] Full project starts locally; frontend type-checks and builds
