#SovereignVoice
##Multilingual AI Voice Intelligence for BFSI Collection Operations

## 1. Project Overview
SovereignVoice is an AI-powered platform that understands multilingual and code-mixed customer conversations, extracts financial intelligence, and generates natural localized voice responses.

It addresses the limitations of traditional collection bots, especially with regional languages, noisy audio and customer intent detection.

##2. Technology Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Python, FastAPI
- **STT:** Gnani Prisma – multilingual speech-to-text
- **LLM:** Qwen via Groq – conversation understanding and CRM extraction
- **Validation:** Python CRM Validator – financial accuracy checks
- **TTS:** Gnani Timbre – localized voice generation

##3. How the Website Works

1. **Audio Input:** User uploads a customer call recording or records audio through the microphone.
2. **Transcription:** Gnani Prisma converts speech into text and detects the language.
3. **AI Analysis:** Qwen identifies customer intent, payment commitments, amounts, dates, sentiment and disputes.
4. **Validation:** Backend checks extracted information against the original transcript to prevent fabricated financial commitments.
5. **Voice Generation:** Gnani Timbre generates a localized response.
6. **Results:** Website displays generated audio, customer intelligence, CRM information and the original transcript.

**Website Pages:**
- **Home:** Audio input and conversation analysis.
- **Demo:** Previously analyzed conversations and their results.

## 4. Real-World Calling System Integration

The existing AI pipeline can be connected to banking dialers and telephony platforms to process actual customer calls.

**Proposed workflow:**

Customer Call → Telephony Platform → SovereignVoice Backend → AI Processing → Response / CRM

1. A banking dialer initiates the customer call.
2. Telephony platform streams call audio to the backend using SIP or real-time media streaming.
3. Gnani Prisma transcribes the conversation.
4. LLM understands customer intent and extracts financial information.
5. CRM Validator verifies the information.
6. Gnani Timbre generates a localized voice response.
7. Response audio is routed back through the telephony platform, and validated information is updated in the banking CRM.


## 5. Financial Safety

- No fabricated payment commitments, amounts or dates.
- Uncertain statements are not treated as confirmed promises.
- Disputes and complaints are flagged.
- Low-confidence results require human review.
- Financial concessions are never automatically approved.

## 6. Implementation Status

**Implemented:** Audio upload/recording, multilingual transcription, AI analysis, financial validation, localized voice generation and structured CRM output.

**Future Scope:** Live telephony integration, real-time audio streaming, automated CRM synchronization and voice-agent capabilities.

**SovereignVoice transforms multilingual customer conversations into actionable financial intelligence, enabling smarter and more localized BFSI collection operations.**
