# Design: Rewrite Backend with OpenAI Agents SDK

**Date:** 2026-03-08
**Branch:** `rewrite/openai-agents`
**Status:** Approved

## Motivation

1. Eliminate the fragile 500-line manual state management in the Telegram bot handler (`context.user_data` with `pending_action`, `pending_choice`, `pending_partial`, `create_session`)
2. Move to a tool-based agent architecture where the LLM calls tools directly instead of parsing intents and routing manually
3. Enable smarter multi-turn conversations, disambiguation, and clarification — all handled natively by the agent

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| SDK | OpenAI Agents SDK | Tool-calling, sessions, tracing built in |
| LLM | OpenAI models (gpt-4o-mini) | Native support, no extra config |
| Architecture | Single agent + 6 tools | Sufficient for current needs, simple |
| Database | SQLite via SQLAlchemy | Proper SQL, better querying, handles concurrency |
| Session storage | SDK built-in with SQLite backend | Persistent across restarts |
| Entity naming | "Debt" replaces "Obligation" | Clearer, more natural |
| Telegram bot | Pure conversational, no slash commands | Natural language is the primary interface |
| Frontend | No changes except `api.js` URL updates | `/obligations` → `/debts` |

## Architecture

```
backend/
├── main.py              → FastAPI app + Telegram bot startup
├── agent.py             → Agent definition + system prompt
├── tools.py             → All 6 tools
├── db/
│   ├── models.py        → SQLAlchemy ORM models (Debt, Transaction)
│   ├── database.py      → Engine, session factory, init
│   └── repository.py    → CRUD functions the tools call
├── api/
│   └── routes.py        → REST endpoints (for React frontend)
├── bot/
│   └── handler.py       → Thin Telegram adapter (~50 lines)
├── models/
│   └── schemas.py       → Pydantic schemas for API request/response
└── config.py            → Settings (env vars)
```

### Data Flow

1. **Telegram:** User message → `handler.py` → `Runner.run(agent, message, session_id=user_id)` → Agent calls tools → tools call `repository.py` → SQLite → Agent formats response → reply to user
2. **Frontend:** React app → `routes.py` → `repository.py` → SQLite (direct CRUD, no agent)

## Data Model

### Debt Table

| Column | Type | Notes |
|---|---|---|
| id | Integer, PK | Auto-increment |
| trxn_id | String, nullable | UUID linking split group |
| person_name | String | The other party |
| type | Enum: `recurring`, `one_time` | |
| direction | Enum: `owes_me`, `i_owe` | |
| total_amount | Float | Original amount |
| expected_per_cycle | Float, nullable | Monthly deduction (recurring) |
| remaining_amount | Float | Current outstanding |
| status | Enum: `active`, `settled` | |
| created_at | DateTime | Auto-set |
| note | String, nullable | Free text |

### Transaction Table

| Column | Type | Notes |
|---|---|---|
| id | Integer, PK | Auto-increment |
| debt_id | Integer, FK → Debt.id | |
| amount | Float | Payment amount |
| paid_at | DateTime | Auto-set |
| note | String, nullable | |

## Agent & Tools

### Agent (`agent.py`)

- Single `Agent` instance
- System prompt covers: Hinglish support, currency parsing (5k→5000), split math, personality/tone, disambiguation behavior, clarification rules
- Model: `gpt-4o-mini`
- SDK SQLite-backed session storage keyed by Telegram user ID

### Tools (`tools.py`)

| Tool | Parameters | Purpose |
|---|---|---|
| `create_debt` | person_name(s), amount, direction, type, expected_per_cycle?, note?, split? | Create one or more debts, handles multi-person splits via shared trxn_id |
| `edit_debt` | debt_id, fields to update | Update person_name, amount, note, direction, type |
| `settle_debt` | debt_id | Set status=settled, remaining=0, record final transaction |
| `delete_debt` | debt_id | Hard delete |
| `record_payment` | debt_id, amount, note? | Record transaction, reduce remaining, auto-settle if remaining hits 0 |
| `query_debts` | status?, person_name?, direction? | Return filtered list of debts |

### What the Agent Handles Natively

- **Disambiguation:** "Settle Rahul" with 3 active debts → agent queries first, asks user which one
- **Confirmation:** Agent naturally asks before mutating actions
- **Clarification:** Vague input → agent asks for missing info
- **Chitchat:** Responds without calling tools
- **Multi-turn:** SDK session storage handles context

## Telegram Bot Handler

~50 lines. No state machine:

```python
async def handle_message(update, context):
    user_id = update.effective_user.id
    message = update.message.text
    result = await Runner.run(agent, message, session_id=str(user_id))
    await update.message.reply_text(result.final_output)
```

## REST API (Frontend)

Same endpoints, renamed:

| Method | Path | Purpose |
|---|---|---|
| POST | `/debts` | Create debt(s) |
| GET | `/debts` | List/filter debts |
| GET | `/debts/{id}` | Get single debt |
| PATCH | `/debts/{id}` | Update debt |
| DELETE | `/debts/{id}` | Delete debt |
| POST | `/debts/{id}/transactions` | Record payment |
| POST | `/debts/{id}/settle` | Settle debt |

## Frontend Changes

Only `api.js`: update `/obligations` → `/debts`. Same JSON shape.

## Testing Strategy

1. **`docs/scenarios.md`** — Written before any code. Exhaustive conversational scenarios with expected agent behavior:
   - Clear inputs, vague inputs, Hinglish, splits, ambiguous settle/edit
   - Partial payments, queries, chitchat, off-topic, multi-turn
   - Currency parsing edge cases, zero/negative amounts, duplicates
2. Each scenario specifies: user message, expected behavior, expected response shape
3. Scenarios serve as the behavioral spec for the agent's system prompt
4. Can later be turned into automated tests using SDK tracing/evaluation

## What Gets Deleted

- `app/llm/parser.py` — No more manual intent parsing
- `app/llm/prompts.py` — Replaced by agent system prompt
- `app/bot/handler.py` — Rewritten from 500 lines to ~50
- `app/agents.py` — Empty placeholder
- `app/deps.py` — Dependency injection no longer needed
- `memory_ledger.json` — TinyDB replaced by SQLite
- `tests/test_scenarios.py` — Replaced by scenarios.md + future automated tests
