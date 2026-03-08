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
