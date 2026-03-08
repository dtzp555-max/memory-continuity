# 2026-03-08 model fallback hard rule

User reported: a previous PR to enable GPT-5.4 support was broken again; today gateway logs show `FailoverError: Unknown model: openai-codex/gpt-5.4`. Tao assumed main + workers were still running 5.4.

New hard rule requested by Tao:
- If main or any execution agent falls back from `openai-codex/gpt-5.4` (or 5.4 becomes unknown/unavailable), **main must notify Tao immediately**.
- Execution agents must be fixed to 5.4 and **must not silently fall back**. If 5.4 is unavailable, pause and ask Tao for model decision.
- If an execution agent is not responding, main must treat **fallback/unavailability** as a primary suspected cause and tell Tao (not just assume “stuck”).
