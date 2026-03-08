# OpenAI Agents SDK Rewrite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the Memory Logger backend to use the OpenAI Agents SDK with a single agent + 6 tools, SQLite via SQLAlchemy, and a thin Telegram bot handler — replacing the manual intent parsing and state management.

**Architecture:** Single OpenAI Agent with tools (create_debt, edit_debt, settle_debt, delete_debt, record_payment, query_debts). FastAPI serves REST endpoints for the React frontend. Telegram bot is a thin adapter that passes messages to Runner.run(). SQLite via SQLAlchemy replaces TinyDB.

**Tech Stack:** Python 3.10+, OpenAI Agents SDK, FastAPI, SQLAlchemy (SQLite), python-telegram-bot, Pydantic, loguru

---

### Task 1: Write Conversational Scenarios Doc

**Files:**
- Create: `docs/scenarios.md`

**Step 1: Write the scenarios file**

```markdown
# Agent Conversational Scenarios

Behavioral spec for the Memory Logger agent. Each scenario defines user input, expected agent behavior, and expected response characteristics.

---

## 1. Clear Inputs

### 1.1 Simple one-time debt (owes_me)
**User:** "Gave Rahul 5000 for groceries"
**Expected behavior:** Agent calls `create_debt(person_name="Rahul", amount=5000, direction="owes_me", type="one_time", note="Groceries")`
**Expected response:** Confirms creation with amount and person name

### 1.2 Simple one-time debt (i_owe)
**User:** "I owe Priya 2000 for movie tickets"
**Expected behavior:** Agent calls `create_debt(person_name="Priya", amount=2000, direction="i_owe", type="one_time", note="Movie tickets")`
**Expected response:** Confirms creation with amount and person name

### 1.3 Recurring debt with monthly deduction
**User:** "Gave Sunita 5k advance, deduct 1k monthly"
**Expected behavior:** Agent calls `create_debt(person_name="Sunita", amount=5000, direction="owes_me", type="recurring", expected_per_cycle=1000, note="Advance")`
**Expected response:** Confirms advance amount, monthly deduction, and estimated duration (~5 months)

---

## 2. Currency Parsing

### 2.1 "k" notation
**User:** "Rahul owes me 5k"
**Expected behavior:** Agent interprets 5k as 5000, calls `create_debt` with amount=5000
**Expected response:** Shows ₹5,000

### 2.2 Decimal k notation
**User:** "Lent Priya 1.5k"
**Expected behavior:** Agent interprets 1.5k as 1500
**Expected response:** Shows ₹1,500

### 2.3 Rupee symbol with commas
**User:** "Sunita owes ₹3,200"
**Expected behavior:** Agent interprets ₹3,200 as 3200
**Expected response:** Shows ₹3,200

### 2.4 Plain number
**User:** "Gave Shivam 500"
**Expected behavior:** Agent interprets 500 as 500
**Expected response:** Shows ₹500

---

## 3. Hinglish Support

### 3.1 Hindi verb for giving
**User:** "Sunita ko 5k diya"
**Expected behavior:** Agent understands "diya" = gave, direction=owes_me, calls `create_debt`
**Expected response:** Confirms Sunita owes ₹5,000

### 3.2 Hindi verb for owing
**User:** "Mujhe Rahul ko 3k dena hai"
**Expected behavior:** Agent understands "mujhe dena hai" = I owe, direction=i_owe
**Expected response:** Confirms you owe Rahul ₹3,000

### 3.3 Mixed sentence
**User:** "Priya se 2k liya tha, wapas karna hai"
**Expected behavior:** Agent understands "liya" + "wapas karna hai" = I owe, direction=i_owe
**Expected response:** Confirms you owe Priya ₹2,000

---

## 4. Multi-Person Splits

### 4.1 Equal split, user paid
**User:** "Dinner with Rahul and Priya, 3200, I paid"
**Expected behavior:** Agent calculates per-person share = 3200 / 3 = 1067 (3 people including user). Calls `create_debt` twice: once for Rahul (1067, owes_me) and once for Priya (1067, owes_me), with shared trxn_id
**Expected response:** "Rahul owes ₹1,067, Priya owes ₹1,067" — confirms both

### 4.2 Equal split, someone else paid
**User:** "Lunch was 2400, Rahul paid for me and Priya"
**Expected behavior:** Per-person share = 2400 / 3 = 800. Agent calls `create_debt(person_name="Rahul", amount=800, direction="i_owe", note="Lunch")`
**Expected response:** Confirms you owe Rahul ₹800

### 4.3 Ambiguous split
**User:** "Dinner with Rahul, 3000"
**Expected behavior:** Agent asks: "Did you pay? Or does someone else owe you?" — needs direction
**Expected response:** Clarifying question about who paid

---

## 5. Vague / Ambiguous Inputs

### 5.1 Missing person
**User:** "Gave 5000 advance"
**Expected behavior:** Agent asks "Who did you give the advance to?"
**Expected response:** Clarifying question for person name

### 5.2 Missing amount
**User:** "Rahul owes me"
**Expected behavior:** Agent asks "How much does Rahul owe you?"
**Expected response:** Clarifying question for amount

### 5.3 Missing direction
**User:** "Add Rahul 5k"
**Expected behavior:** Agent asks "Does Rahul owe you ₹5,000, or do you owe Rahul?"
**Expected response:** Clarifying question for direction

### 5.4 Completely vague
**User:** "paid something to someone"
**Expected behavior:** Agent asks "Who did you pay, and how much was it?"
**Expected response:** Clarifying question for both person and amount

### 5.5 Follow-up after clarification
**User (turn 1):** "Rahul owes me"
**Agent:** "How much does Rahul owe you?"
**User (turn 2):** "5000 for dinner"
**Expected behavior:** Agent combines context from both turns, calls `create_debt(person_name="Rahul", amount=5000, direction="owes_me", note="Dinner")`
**Expected response:** Confirms creation

---

## 6. Queries

### 6.1 General query
**User:** "What's pending?"
**Expected behavior:** Agent calls `query_debts(status="active")`, formats and returns all active debts
**Expected response:** List of all active debts with names, amounts, and directions

### 6.2 Person-specific query
**User:** "How much does Sunita owe me?"
**Expected behavior:** Agent calls `query_debts(person_name="Sunita", status="active")`, sums up amounts
**Expected response:** Shows Sunita's active debts with remaining amounts

### 6.3 Direction-specific query
**User:** "Who do I owe money to?"
**Expected behavior:** Agent calls `query_debts(direction="i_owe", status="active")`
**Expected response:** List of people user owes money to

### 6.4 Settled query
**User:** "Show all settled debts"
**Expected behavior:** Agent calls `query_debts(status="settled")`
**Expected response:** List of settled debts

---

## 7. Settle Operations

### 7.1 Clear settle
**User:** "Mark Shivam's debt as settled"
**Expected behavior:** Agent calls `query_debts(person_name="Shivam", status="active")`. If one result, calls `settle_debt(debt_id=X)`. If multiple, asks which one.
**Expected response:** Confirms settlement

### 7.2 Ambiguous settle (multiple debts)
**User:** "Settle Rahul"
**Agent finds 3 active debts for Rahul:**
- #1: ₹5,000 (one_time, Groceries)
- #2: ₹3,000 (recurring, Advance)
- #3: ₹1,067 (one_time, Dinner split)
**Expected behavior:** Agent lists all 3 and asks which one to settle
**Expected response:** "Rahul has 3 active debts: 1) ₹5,000 for Groceries, 2) ₹3,000 Advance, 3) ₹1,067 Dinner split. Which one should I settle?"

### 7.3 Settle with no active debts
**User:** "Settle Amit"
**Expected behavior:** Agent calls `query_debts(person_name="Amit", status="active")`, finds nothing
**Expected response:** "Amit has no active debts to settle."

---

## 8. Partial Payments

### 8.1 Clear payment
**User:** "Rahul paid 2000"
**Expected behavior:** Agent calls `query_debts(person_name="Rahul", status="active")`. If one result, calls `record_payment(debt_id=X, amount=2000)`. If multiple, asks which one.
**Expected response:** Confirms payment recorded, shows remaining amount

### 8.2 Overpayment
**User:** "Sunita paid 10000" (but remaining is 5000)
**Expected behavior:** Agent warns that the payment exceeds the remaining amount and asks for confirmation or correction
**Expected response:** "Sunita's remaining balance is ₹5,000. Did you mean ₹5,000?"

---

## 9. Edit Operations

### 9.1 Edit amount
**User:** "Change Rahul's amount to 6000"
**Expected behavior:** If single active debt for Rahul, calls `edit_debt(debt_id=X, total_amount=6000)`. If multiple, asks which one.
**Expected response:** Confirms update

### 9.2 Edit note
**User:** "Update the note on Priya's debt to 'Birthday gift'"
**Expected behavior:** Agent finds Priya's debt, calls `edit_debt(debt_id=X, note="Birthday gift")`
**Expected response:** Confirms note updated

### 9.3 Edit monthly deduction
**User:** "Change Sunita's monthly deduction to 1500"
**Expected behavior:** Agent finds Sunita's recurring debt, calls `edit_debt(debt_id=X, expected_per_cycle=1500)`
**Expected response:** Confirms deduction updated

---

## 10. Delete Operations

### 10.1 Clear delete
**User:** "Delete Rahul's dinner debt"
**Expected behavior:** Agent finds the matching debt, confirms before deleting: "Delete Rahul's ₹1,067 dinner split debt? This can't be undone."
**Expected response:** Asks for confirmation first

### 10.2 Confirmed delete
**User (turn 1):** "Delete Rahul's dinner debt"
**Agent:** "Delete Rahul's ₹1,067 dinner split debt? This can't be undone."
**User (turn 2):** "Yes"
**Expected behavior:** Agent calls `delete_debt(debt_id=X)`
**Expected response:** Confirms deletion

---

## 11. Chitchat

### 11.1 Greeting
**User:** "Hey!"
**Expected behavior:** Agent responds conversationally without calling any tools
**Expected response:** Friendly greeting, mentions it can help with expense tracking

### 11.2 Thanks
**User:** "Thanks!"
**Expected behavior:** No tool call
**Expected response:** Friendly acknowledgment

### 11.3 How are you
**User:** "How are you?"
**Expected behavior:** No tool call
**Expected response:** Friendly response, stays in character

---

## 12. Off-Topic

### 12.1 Non-financial request
**User:** "Remind me to call mom tomorrow"
**Expected behavior:** No tool call
**Expected response:** Politely explains it only handles financial tracking, suggests what it can do

### 12.2 General knowledge
**User:** "What's the capital of France?"
**Expected behavior:** No tool call
**Expected response:** Politely redirects to financial features

---

## 13. Edge Cases

### 13.1 Zero amount
**User:** "Rahul owes me 0"
**Expected behavior:** Agent asks if they meant a different amount — zero debt doesn't make sense
**Expected response:** Clarifying question

### 13.2 Negative amount
**User:** "Rahul owes me -500"
**Expected behavior:** Agent asks for clarification — perhaps they meant "I owe Rahul 500"?
**Expected response:** Clarifying question about direction

### 13.3 Settling already settled debt
**User:** "Settle Rahul" (all Rahul's debts are already settled)
**Expected behavior:** Agent informs no active debts found
**Expected response:** "Rahul has no active debts to settle."

### 13.4 Duplicate detection
**User:** "Gave Rahul 5000 for groceries" (exact same debt already exists)
**Expected behavior:** Agent notices a very similar active debt exists, asks if this is a new one or duplicate
**Expected response:** "There's already an active debt from Rahul for ₹5,000 (Groceries). Is this a new one?"

### 13.5 Very large amount
**User:** "Priya owes me 50 lakhs"
**Expected behavior:** Agent confirms the large amount: "That's ₹50,00,000 — want me to log this?"
**Expected response:** Confirmation with formatted amount
```

**Step 2: Commit**

```bash
git add docs/scenarios.md
git commit -m "Add conversational scenarios spec for agent behavior"
```

---

### Task 2: Update Project Dependencies

**Files:**
- Modify: `backend/pyproject.toml`

**Step 1: Update pyproject.toml**

Replace the current dependencies with:

```toml
[project]
name = "memory-logger"
version = "0.2.0"
description = "Personal financial memory logger with AI agent-powered natural language input"
readme = "README.md"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "sqlalchemy>=2.0.0",
    "openai-agents>=0.1.0",
    "pydantic-settings>=2.5.0",
    "loguru>=0.7.0",
    "python-telegram-bot>=21.0",
]
```

Changes: removed `tinydb` and `openai`, added `sqlalchemy` and `openai-agents`.

**Step 2: Install dependencies**

Run: `cd /Users/rohil/rohil-workspace/memory-logger/backend && uv sync`

**Step 3: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock
git commit -m "Update dependencies: add openai-agents + sqlalchemy, remove tinydb"
```

---

### Task 3: Update Config

**Files:**
- Modify: `backend/app/config.py`

**Step 1: Update config.py**

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    openai_api_key: str = ""
    telegram_bot_token: str = ""
    db_path: str = "memory_ledger.db"
    llm_model: str = "gpt-4o-mini"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

Changes: `openrouter_api_key` → `openai_api_key`, `db_path` default → `memory_ledger.db`, `llm_model` → `gpt-4o-mini`.

**Step 2: Update .env file**

Replace `OPENROUTER_API_KEY` with `OPENAI_API_KEY`. Remove `LLM_MODEL` if present (default is fine).

**Step 3: Commit**

```bash
git add backend/app/config.py
git commit -m "Update config for OpenAI + SQLite"
```

---

### Task 4: Create SQLAlchemy Database Layer

**Files:**
- Create: `backend/app/db/database.py`
- Create: `backend/app/db/models.py`
- Modify: `backend/app/db/repository.py`
- Create: `backend/app/db/__init__.py`

**Step 1: Create database.py (engine + session factory)**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    f"sqlite:///{get_settings().db_path}",
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Step 2: Create models.py (ORM models)**

```python
from datetime import datetime

from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Debt(Base):
    __tablename__ = "debts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trxn_id: Mapped[str | None] = mapped_column(String, nullable=True)
    person_name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(SAEnum("recurring", "one_time"), nullable=False)
    direction: Mapped[str] = mapped_column(SAEnum("owes_me", "i_owe"), nullable=False, default="owes_me")
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    expected_per_cycle: Mapped[float | None] = mapped_column(Float, nullable=True)
    remaining_amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(SAEnum("active", "settled"), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    note: Mapped[str | None] = mapped_column(String, nullable=True)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="debt", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debt_id: Mapped[int] = mapped_column(Integer, ForeignKey("debts.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    note: Mapped[str | None] = mapped_column(String, nullable=True)

    debt: Mapped["Debt"] = relationship(back_populates="transactions")
```

**Step 3: Rewrite repository.py**

```python
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import Debt, Transaction


class DebtRepository:
    def __init__(self, db: Session):
        self.db = db

    def add(self, debt: Debt) -> Debt:
        self.db.add(debt)
        self.db.commit()
        self.db.refresh(debt)
        return debt

    def get(self, debt_id: int) -> Debt | None:
        return self.db.get(Debt, debt_id)

    def get_by_person(self, name: str, status: str = "active") -> list[Debt]:
        return (
            self.db.query(Debt)
            .filter(Debt.person_name.ilike(name), Debt.status == status)
            .all()
        )

    def get_all(self, status: str | None = None, direction: str | None = None) -> list[Debt]:
        query = self.db.query(Debt)
        if status:
            query = query.filter(Debt.status == status)
        if direction:
            query = query.filter(Debt.direction == direction)
        return query.order_by(Debt.created_at.desc()).all()

    def update(self, debt_id: int, **fields) -> Debt | None:
        debt = self.get(debt_id)
        if debt is None:
            return None
        for key, value in fields.items():
            if value is not None:
                setattr(debt, key, value)
        self.db.commit()
        self.db.refresh(debt)
        return debt

    def add_transaction(self, debt_id: int, amount: float, note: str | None = None) -> Debt | None:
        debt = self.get(debt_id)
        if debt is None:
            return None

        txn = Transaction(debt_id=debt_id, amount=amount, paid_at=datetime.now(), note=note)
        self.db.add(txn)

        debt.remaining_amount = max(debt.remaining_amount - amount, 0)
        if debt.remaining_amount == 0:
            debt.status = "settled"

        self.db.commit()
        self.db.refresh(debt)
        return debt

    def settle(self, debt_id: int) -> Debt | None:
        debt = self.get(debt_id)
        if debt is None:
            return None

        if debt.remaining_amount > 0:
            txn = Transaction(
                debt_id=debt_id,
                amount=debt.remaining_amount,
                paid_at=datetime.now(),
                note="Full settlement",
            )
            self.db.add(txn)

        debt.remaining_amount = 0
        debt.status = "settled"
        self.db.commit()
        self.db.refresh(debt)
        return debt

    def delete(self, debt_id: int) -> bool:
        debt = self.get(debt_id)
        if debt is None:
            return False
        self.db.delete(debt)
        self.db.commit()
        return True
```

**Step 4: Create `__init__.py`**

```python
# empty
```

**Step 5: Commit**

```bash
git add backend/app/db/
git commit -m "Add SQLAlchemy database layer with Debt and Transaction models"
```

---

### Task 5: Update Pydantic Schemas

**Files:**
- Modify: `backend/app/models/schemas.py`

**Step 1: Rewrite schemas.py**

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TransactionSchema(BaseModel):
    id: int | None = None
    amount: float
    paid_at: datetime
    note: str | None = None

    class Config:
        from_attributes = True


class DebtSchema(BaseModel):
    id: int | None = None
    trxn_id: str | None = None
    person_name: str
    type: Literal["recurring", "one_time"]
    direction: Literal["owes_me", "i_owe"] = "owes_me"
    total_amount: float
    expected_per_cycle: float | None = None
    remaining_amount: float
    status: Literal["active", "settled"] = "active"
    created_at: datetime = Field(default_factory=datetime.now)
    note: str | None = None
    transactions: list[TransactionSchema] = []

    class Config:
        from_attributes = True


class CreateDebtRequest(BaseModel):
    person_name: str
    type: Literal["recurring", "one_time"]
    direction: Literal["owes_me", "i_owe"] = "owes_me"
    trxn_id: str | None = None
    total_amount: float
    expected_per_cycle: float | None = None
    note: str | None = None


class UpdateDebtRequest(BaseModel):
    person_name: str | None = None
    total_amount: float | None = None
    expected_per_cycle: float | None = None
    remaining_amount: float | None = None
    note: str | None = None


class AddTransactionRequest(BaseModel):
    amount: float
    note: str | None = None
```

Removed: `ParsedIntent`, `LLMResponse`, `ParseRequest` (no longer needed — the agent handles parsing).
Renamed: `Obligation` → `DebtSchema`, `CreateObligationRequest` → `CreateDebtRequest`, etc.
Added: `from_attributes = True` for ORM compatibility.

**Step 2: Commit**

```bash
git add backend/app/models/schemas.py
git commit -m "Update Pydantic schemas: rename obligation to debt, add ORM config"
```

---

### Task 6: Create Agent Tools

**Files:**
- Create: `backend/app/tools.py`

**Step 1: Write tools.py**

```python
import uuid
from datetime import datetime

from agents import RunContextWrapper, function_tool

from app.db.database import SessionLocal
from app.db.models import Debt
from app.db.repository import DebtRepository


def _get_repo() -> DebtRepository:
    return DebtRepository(SessionLocal())


def _format_debt(debt: Debt) -> str:
    direction = "owes you" if debt.direction == "owes_me" else "you owe"
    line = f"[#{debt.id}] {debt.person_name} — {direction} ₹{debt.remaining_amount:,.0f}"
    if debt.type == "recurring" and debt.expected_per_cycle:
        line += f" (₹{debt.expected_per_cycle:,.0f}/month)"
    if debt.note:
        line += f" — {debt.note}"
    return line


@function_tool
def create_debt(
    person_name: str,
    amount: float,
    direction: str,
    type: str,
    expected_per_cycle: float | None = None,
    note: str | None = None,
) -> str:
    """Create a new debt record.

    Args:
        person_name: Name of the other person.
        amount: The total amount of the debt.
        direction: Either "owes_me" (they owe the user) or "i_owe" (user owes them).
        type: Either "recurring" (with monthly deductions) or "one_time".
        expected_per_cycle: Monthly deduction amount (only for recurring debts).
        note: Optional description of what the debt is for.
    """
    repo = _get_repo()
    debt = Debt(
        person_name=person_name,
        type=type,
        direction=direction,
        total_amount=amount,
        expected_per_cycle=expected_per_cycle,
        remaining_amount=amount,
        note=note,
        created_at=datetime.now(),
    )
    created = repo.add(debt)
    return f"Created debt #{created.id}: {_format_debt(created)}"


@function_tool
def create_split_debts(
    person_names: list[str],
    total_amount: float,
    direction: str,
    note: str | None = None,
) -> str:
    """Create multiple debt records for a group expense split equally.

    The total_amount is divided by (number of persons + 1) to include the user.
    Each person gets one debt record linked by a shared transaction ID.

    Args:
        person_names: List of people who owe (or are owed).
        total_amount: The total bill amount before splitting.
        direction: Either "owes_me" or "i_owe".
        note: Optional description.
    """
    repo = _get_repo()
    headcount = len(person_names) + 1  # +1 for the user
    per_person = round(total_amount / headcount)
    trxn_id = str(uuid.uuid4())

    created = []
    for name in person_names:
        debt = Debt(
            trxn_id=trxn_id,
            person_name=name,
            type="one_time",
            direction=direction,
            total_amount=per_person,
            remaining_amount=per_person,
            note=note,
            created_at=datetime.now(),
        )
        created.append(repo.add(debt))

    lines = [f"  {_format_debt(d)}" for d in created]
    return f"Created split (₹{total_amount:,.0f} total, ₹{per_person:,.0f}/person):\n" + "\n".join(lines)


@function_tool
def query_debts(
    person_name: str | None = None,
    status: str | None = None,
    direction: str | None = None,
) -> str:
    """Query debts with optional filters.

    Args:
        person_name: Filter by person name (case-insensitive).
        status: Filter by status: "active" or "settled".
        direction: Filter by direction: "owes_me" or "i_owe".
    """
    repo = _get_repo()
    if person_name:
        debts = repo.get_by_person(person_name, status=status or "active")
    else:
        debts = repo.get_all(status=status, direction=direction)

    if not debts:
        filters = []
        if person_name:
            filters.append(f"person={person_name}")
        if status:
            filters.append(f"status={status}")
        if direction:
            filters.append(f"direction={direction}")
        filter_str = ", ".join(filters) if filters else "any"
        return f"No debts found ({filter_str})."

    lines = [_format_debt(d) for d in debts]
    return f"Found {len(debts)} debt(s):\n" + "\n".join(lines)


@function_tool
def edit_debt(
    debt_id: int,
    person_name: str | None = None,
    total_amount: float | None = None,
    expected_per_cycle: float | None = None,
    note: str | None = None,
) -> str:
    """Edit an existing debt's fields.

    Args:
        debt_id: The ID of the debt to edit.
        person_name: New person name (optional).
        total_amount: New total amount — also recalculates remaining (optional).
        expected_per_cycle: New monthly deduction amount (optional).
        note: New note (optional).
    """
    repo = _get_repo()
    debt = repo.get(debt_id)
    if debt is None:
        return f"Debt #{debt_id} not found."

    updates = {}
    if person_name is not None:
        updates["person_name"] = person_name
    if total_amount is not None:
        already_paid = debt.total_amount - debt.remaining_amount
        updates["total_amount"] = total_amount
        updates["remaining_amount"] = max(total_amount - already_paid, 0)
    if expected_per_cycle is not None:
        updates["expected_per_cycle"] = expected_per_cycle
    if note is not None:
        updates["note"] = note

    if not updates:
        return "No fields to update."

    updated = repo.update(debt_id, **updates)
    return f"Updated debt: {_format_debt(updated)}"


@function_tool
def record_payment(
    debt_id: int,
    amount: float,
    note: str | None = None,
) -> str:
    """Record a payment (partial or full) against a debt.

    Args:
        debt_id: The ID of the debt.
        amount: The payment amount.
        note: Optional note for this payment.
    """
    repo = _get_repo()
    debt = repo.get(debt_id)
    if debt is None:
        return f"Debt #{debt_id} not found."
    if debt.status == "settled":
        return f"Debt #{debt_id} is already settled."

    updated = repo.add_transaction(debt_id, amount, note)
    status_msg = " (now fully settled)" if updated.status == "settled" else f" (₹{updated.remaining_amount:,.0f} remaining)"
    return f"Recorded ₹{amount:,.0f} payment on debt #{debt_id}{status_msg}"


@function_tool
def settle_debt(debt_id: int) -> str:
    """Mark a debt as fully settled. Records a final transaction for any remaining amount.

    Args:
        debt_id: The ID of the debt to settle.
    """
    repo = _get_repo()
    debt = repo.get(debt_id)
    if debt is None:
        return f"Debt #{debt_id} not found."
    if debt.status == "settled":
        return f"Debt #{debt_id} is already settled."

    settled = repo.settle(debt_id)
    return f"Settled debt #{debt_id}: {settled.person_name}'s balance is now ₹0."


@function_tool
def delete_debt(debt_id: int) -> str:
    """Permanently delete a debt record.

    Args:
        debt_id: The ID of the debt to delete.
    """
    repo = _get_repo()
    if repo.delete(debt_id):
        return f"Deleted debt #{debt_id}."
    return f"Debt #{debt_id} not found."
```

Note: Added `create_split_debts` as a 7th tool — cleaner than overloading `create_debt` with split logic.

**Step 2: Commit**

```bash
git add backend/app/tools.py
git commit -m "Add agent tools: create, query, edit, settle, record_payment, delete"
```

---

### Task 7: Create the Agent

**Files:**
- Create: `backend/app/agent.py`

**Step 1: Write agent.py**

```python
from agents import Agent

from app.tools import (
    create_debt,
    create_split_debts,
    query_debts,
    edit_debt,
    record_payment,
    settle_debt,
    delete_debt,
)

SYSTEM_PROMPT = """\
You are a personal finance assistant that helps track debts between the user and other people. You communicate via Telegram.

## Your capabilities
You can create, query, edit, settle, record payments on, and delete debts using the tools available to you.

## Language
- Understand both English and Hinglish (Hindi-English mix) naturally
- "diya" / "diye" = gave → direction is owes_me
- "liya" / "lena hai" / "dena hai" = took / need to give → direction is i_owe
- "wapas" = return/back
- Respond in the same language the user uses

## Currency parsing
- "5k" = 5000, "1.5k" = 1500, "3.5k" = 3500
- "₹3,200" = 3200
- "500 rupees" = 500
- Always display amounts in INR format: ₹X,XXX

## Splits
- When the user mentions a group expense (e.g., "Dinner with Rahul and Priya, 3200, I paid"):
  - Use `create_split_debts` with the total amount — the tool handles the math
  - The user is always part of the group (headcount = persons + 1)
  - Only include the OTHER people in person_names, not the user

## Direction rules
- "owes_me": someone owes the user (user gave/paid/lent money)
- "i_owe": the user owes someone (user received/borrowed/took money)
- If direction is unclear from the message, ASK — do not guess

## Recurring debts
- When someone mentions monthly deductions (e.g., "deduct 1k monthly"), set type="recurring" and provide expected_per_cycle
- Otherwise, default to type="one_time"

## Disambiguation
- When a user wants to settle/edit/delete and the person has multiple active debts, ALWAYS call `query_debts` first to list them, then ask which one
- Reference debts by their ID number so the user can pick

## Clarification
- If the user's message is missing required info (person, amount, or direction), ask for it
- If the message is vague, ask a clarifying question
- Combine info from conversation history — don't re-ask what was already provided

## Confirmation
- For destructive actions (delete), ask for confirmation before proceeding
- For create/edit/settle, confirm what you understood and proceed — no need to ask "are you sure?" unless the amount seems unusual

## Tone
- Friendly, concise, casual
- Use ₹ symbol for amounts
- Keep responses short — this is a chat interface, not an essay
"""

memory_agent = Agent(
    name="MemoryLedger",
    model="gpt-4o-mini",
    instructions=SYSTEM_PROMPT,
    tools=[
        create_debt,
        create_split_debts,
        query_debts,
        edit_debt,
        record_payment,
        settle_debt,
        delete_debt,
    ],
)
```

**Step 2: Commit**

```bash
git add backend/app/agent.py
git commit -m "Add OpenAI agent with system prompt and 7 tools"
```

---

### Task 8: Rewrite Telegram Bot Handler

**Files:**
- Modify: `backend/app/bot/handler.py`

**Step 1: Rewrite handler.py**

```python
from agents import Runner
from loguru import logger
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters

from app.agent import memory_agent
from app.config import get_settings


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    message = update.message.text

    if not message:
        return

    logger.info("User {}: {}", user_id, message)

    try:
        result = await Runner.run(
            memory_agent,
            message,
            session_id=str(user_id),
        )
        response = result.final_output
    except Exception as e:
        logger.error("Agent error for user {}: {}", user_id, e)
        response = "Something went wrong. Please try again."

    await update.message.reply_text(response)
    logger.info("Reply to {}: {}", user_id, response[:100])


def build_bot_app():
    settings = get_settings()
    app = ApplicationBuilder().token(settings.telegram_bot_token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    return app
```

That's it. ~30 lines. No state machine, no confirmation keyboards, no disambiguation logic, no slash commands.

**Step 2: Commit**

```bash
git add backend/app/bot/handler.py
git commit -m "Rewrite Telegram handler: thin adapter using Agent Runner"
```

---

### Task 9: Rewrite REST API Routes

**Files:**
- Modify: `backend/app/api/routes.py`

**Step 1: Rewrite routes.py**

```python
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Debt, Transaction
from app.db.repository import DebtRepository
from app.models.schemas import (
    AddTransactionRequest,
    CreateDebtRequest,
    DebtSchema,
    UpdateDebtRequest,
)

router = APIRouter()


def get_repo(db: Session = Depends(get_db)) -> DebtRepository:
    return DebtRepository(db)


@router.post("/debts", response_model=list[DebtSchema])
def create_debt(request: CreateDebtRequest, repo: DebtRepository = Depends(get_repo)):
    debt = Debt(
        person_name=request.person_name,
        type=request.type,
        direction=request.direction,
        trxn_id=request.trxn_id,
        total_amount=request.total_amount,
        expected_per_cycle=request.expected_per_cycle,
        remaining_amount=request.total_amount,
        note=request.note,
        created_at=datetime.now(),
    )
    created = repo.add(debt)
    logger.info("Created debt #{} for {}", created.id, created.person_name)
    return [DebtSchema.model_validate(created)]


@router.get("/debts", response_model=list[DebtSchema])
def list_debts(status: str | None = None, repo: DebtRepository = Depends(get_repo)):
    debts = repo.get_all(status=status)
    return [DebtSchema.model_validate(d) for d in debts]


@router.get("/debts/{debt_id}", response_model=DebtSchema)
def get_debt(debt_id: int, repo: DebtRepository = Depends(get_repo)):
    debt = repo.get(debt_id)
    if debt is None:
        raise HTTPException(status_code=404, detail="Debt not found")
    return DebtSchema.model_validate(debt)


@router.patch("/debts/{debt_id}", response_model=DebtSchema)
def update_debt(debt_id: int, request: UpdateDebtRequest, repo: DebtRepository = Depends(get_repo)):
    existing = repo.get(debt_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Debt not found")

    updates = request.model_dump(exclude_none=True)
    if "total_amount" in updates:
        already_paid = existing.total_amount - existing.remaining_amount
        updates["remaining_amount"] = max(updates["total_amount"] - already_paid, 0)

    updated = repo.update(debt_id, **updates)
    logger.info("Updated debt #{}", debt_id)
    return DebtSchema.model_validate(updated)


@router.delete("/debts/{debt_id}")
def delete_debt(debt_id: int, repo: DebtRepository = Depends(get_repo)):
    if not repo.delete(debt_id):
        raise HTTPException(status_code=404, detail="Debt not found")
    logger.info("Deleted debt #{}", debt_id)
    return {"detail": "Debt deleted"}


@router.post("/debts/{debt_id}/transactions", response_model=DebtSchema)
def add_transaction(debt_id: int, request: AddTransactionRequest, repo: DebtRepository = Depends(get_repo)):
    existing = repo.get(debt_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Debt not found")
    if existing.status == "settled":
        raise HTTPException(status_code=400, detail="Debt is already settled")

    updated = repo.add_transaction(debt_id, request.amount, request.note)
    logger.info("Added transaction of {} to debt #{}", request.amount, debt_id)
    return DebtSchema.model_validate(updated)


@router.post("/debts/{debt_id}/settle", response_model=DebtSchema)
def settle_debt(debt_id: int, repo: DebtRepository = Depends(get_repo)):
    existing = repo.get(debt_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Debt not found")
    if existing.status == "settled":
        raise HTTPException(status_code=400, detail="Debt is already settled")

    settled = repo.settle(debt_id)
    logger.info("Settled debt #{}", debt_id)
    return DebtSchema.model_validate(settled)
```

**Step 2: Commit**

```bash
git add backend/app/api/routes.py
git commit -m "Rewrite API routes: /obligations -> /debts, use SQLAlchemy"
```

---

### Task 10: Update main.py

**Files:**
- Modify: `backend/main.py`

**Step 1: Rewrite main.py**

```python
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

_HERE = Path(__file__).parent.resolve()
os.chdir(_HERE)

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.routes import router
from app.config import get_settings
from app.db.database import init_db

logger.remove()
logger.add(sys.stderr, level="INFO", format="{time:HH:mm:ss} | {level:<7} | {message}")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database
    init_db()
    logger.info("Database initialized")

    # Start Telegram bot
    if not settings.telegram_bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not set — bot will not start")
    else:
        from app.bot.handler import build_bot_app

        bot_app = build_bot_app()
        app.state.bot = bot_app
        await bot_app.initialize()
        await bot_app.start()
        await bot_app.updater.start_polling(drop_pending_updates=True)
        logger.info("Telegram bot started (polling)")

    yield

    bot_app = getattr(app.state, "bot", None)
    if bot_app:
        await bot_app.updater.stop()
        await bot_app.stop()
        await bot_app.shutdown()
        logger.info("Telegram bot stopped")


app = FastAPI(title="Memory Ledger", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("{} {}", request.method, request.url.path)
    response: Response = await call_next(request)
    logger.info("→ {}", response.status_code)
    return response


app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, app_dir=str(_HERE))
```

Changes: Added `init_db()` call in lifespan, removed deps import, version bump.

**Step 2: Commit**

```bash
git add backend/main.py
git commit -m "Update main.py: add DB init, remove old deps"
```

---

### Task 11: Delete Old Files

**Files:**
- Delete: `backend/app/llm/parser.py`
- Delete: `backend/app/llm/prompts.py`
- Delete: `backend/app/llm/__init__.py`
- Delete: `backend/app/agents.py`
- Delete: `backend/app/deps.py`
- Delete: `backend/tests/test_scenarios.py`

**Step 1: Remove old files**

```bash
rm -f backend/app/llm/parser.py backend/app/llm/prompts.py backend/app/llm/__init__.py
rmdir backend/app/llm 2>/dev/null || true
rm -f backend/app/agents.py backend/app/deps.py
rm -rf backend/tests/
```

**Step 2: Commit**

```bash
git add -A
git commit -m "Remove old LLM parser, prompts, deps, and test files"
```

---

### Task 12: Update Frontend

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/vite.config.js`

**Step 1: Update api.js — replace all `/obligations` with `/debts`**

```javascript
const json = (res) => {
  if (!res.ok) return res.json().then((e) => Promise.reject(e))
  return res.json()
}

export function listObligations(status) {
  const params = status ? `?status=${status}` : ''
  return fetch(`/debts${params}`).then(json)
}

export function getObligation(id) {
  return fetch(`/debts/${id}`).then(json)
}

export function createObligation(data) {
  return fetch('/debts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function updateObligation(id, data) {
  return fetch(`/debts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function deleteObligation(id) {
  return fetch(`/debts/${id}`, { method: 'DELETE' }).then(json)
}

export function addTransaction(id, data) {
  return fetch(`/debts/${id}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function settleObligation(id) {
  return fetch(`/debts/${id}/settle`, { method: 'POST' }).then(json)
}
```

Note: Function names stay as `listObligations`, `createObligation`, etc. to avoid touching every import in the frontend. Only the URL paths change.

**Step 2: Update vite.config.js — update proxy**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/debts': 'http://localhost:8000',
    },
  },
})
```

Removed `/parse` proxy (no longer needed) and changed `/obligations` to `/debts`.

**Step 3: Commit**

```bash
git add frontend/src/api.js frontend/vite.config.js
git commit -m "Update frontend: /obligations -> /debts endpoints"
```

---

### Task 13: Smoke Test

**Step 1: Start the backend**

```bash
cd /Users/rohil/rohil-workspace/memory-logger/backend
OPENAI_API_KEY=your-key-here uv run python main.py
```

Expected: Server starts on :8000, "Database initialized" and "Telegram bot started" in logs.

**Step 2: Test API endpoints**

```bash
# Create a debt
curl -X POST http://localhost:8000/debts \
  -H "Content-Type: application/json" \
  -d '{"person_name":"Rahul","type":"one_time","direction":"owes_me","total_amount":5000,"note":"Groceries"}'

# List active debts
curl http://localhost:8000/debts?status=active

# Settle a debt
curl -X POST http://localhost:8000/debts/1/settle
```

Expected: All return proper JSON, no errors.

**Step 3: Test frontend**

```bash
cd /Users/rohil/rohil-workspace/memory-logger/frontend
npm run dev
```

Expected: Opens on :5173, loads debts from backend, stats bar works.

**Step 4: Test Telegram bot**

Send a message to the bot: "Gave Rahul 5k for dinner"
Expected: Agent creates the debt and responds with confirmation.

**Step 5: Commit any fixes, then final commit**

```bash
git add -A
git commit -m "Smoke test fixes (if any)"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Scenarios doc | `docs/scenarios.md` |
| 2 | Update dependencies | `backend/pyproject.toml` |
| 3 | Update config | `backend/app/config.py` |
| 4 | SQLAlchemy DB layer | `backend/app/db/*` |
| 5 | Pydantic schemas | `backend/app/models/schemas.py` |
| 6 | Agent tools | `backend/app/tools.py` |
| 7 | Agent definition | `backend/app/agent.py` |
| 8 | Telegram handler | `backend/app/bot/handler.py` |
| 9 | REST API routes | `backend/app/api/routes.py` |
| 10 | main.py | `backend/main.py` |
| 11 | Delete old files | Various |
| 12 | Frontend updates | `frontend/src/api.js`, `frontend/vite.config.js` |
| 13 | Smoke test | — |
