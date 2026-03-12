import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from app.db.database import get_db
from app.db.models import Debt
from app.db.repository import DebtRepository
from app.events import publish, subscribe
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


@router.get("/events")
async def sse_events():
    async def stream():
        async with subscribe() as queue:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
