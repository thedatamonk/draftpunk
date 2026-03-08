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
