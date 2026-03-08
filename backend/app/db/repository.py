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
