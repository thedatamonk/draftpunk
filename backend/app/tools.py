import uuid
from contextlib import contextmanager
from datetime import datetime

from agents import function_tool
from simpleeval import simple_eval

from app.db.database import SessionLocal
from app.db.models import Debt
from app.db.repository import DebtRepository
from app.events import publish


@contextmanager
def _get_repo():
    db = SessionLocal()
    try:
        yield DebtRepository(db)
    finally:
        db.close()


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
    with _get_repo() as repo:
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
        publish("debt_created")
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
    with _get_repo() as repo:
        headcount = len(person_names) + 1
        per_person = round(total_amount / headcount)
        trxn_id = str(uuid.uuid4())

        debts = []
        for name in person_names:
            debts.append(Debt(
                trxn_id=trxn_id,
                person_name=name,
                type="one_time",
                direction=direction,
                total_amount=per_person,
                remaining_amount=per_person,
                note=note,
                created_at=datetime.now(),
            ))
        created = repo.add_all(debts)

        publish("debt_created")
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
    with _get_repo() as repo:
        if person_name:
            debts = repo.get_by_person(person_name, status=status or "active", direction=direction)
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
    with _get_repo() as repo:
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
        publish("debt_updated")
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
    with _get_repo() as repo:
        debt = repo.get(debt_id)
        if debt is None:
            return f"Debt #{debt_id} not found."
        if debt.status == "settled":
            return f"Debt #{debt_id} is already settled."

        updated = repo.add_transaction(debt_id, amount, note)
        publish("transaction_added")
        status_msg = " (now fully settled)" if updated.status == "settled" else f" (₹{updated.remaining_amount:,.0f} remaining)"
        return f"Recorded ₹{amount:,.0f} payment on debt #{debt_id}{status_msg}"


@function_tool
def settle_debt(debt_id: int) -> str:
    """Mark a debt as fully settled. Records a final transaction for any remaining amount.

    Args:
        debt_id: The ID of the debt to settle.
    """
    with _get_repo() as repo:
        debt = repo.get(debt_id)
        if debt is None:
            return f"Debt #{debt_id} not found."
        if debt.status == "settled":
            return f"Debt #{debt_id} is already settled."

        settled = repo.settle(debt_id)
        publish("debt_settled")
        return f"Settled debt #{debt_id}: {settled.person_name}'s balance is now ₹0."


@function_tool
def delete_debt(debt_id: int) -> str:
    """Permanently delete a debt record.

    Args:
        debt_id: The ID of the debt to delete.
    """
    with _get_repo() as repo:
        if repo.delete(debt_id):
            publish("debt_deleted")
            return f"Deleted debt #{debt_id}."
        return f"Debt #{debt_id} not found."


# ---------------------------------------------------------------------------
# Calculation tools
# ---------------------------------------------------------------------------


@function_tool
def calculate(expression: str) -> str:
    """Safely evaluate a mathematical expression. Use for arithmetic like splits, tips, percentages, or any ad-hoc math.

    Do NOT use this to look up debt amounts — use query_debts or calculate_net_balance for that.

    Args:
        expression: A math expression, e.g. "(4500 * 1.1) / 3" or "5000 / 4".
    """
    try:
        result = simple_eval(expression)
        return f"{expression} = {result:,.2f}"
    except Exception as e:
        return f"Could not evaluate '{expression}': {e}"


@function_tool
def calculate_net_balance(person_name: str) -> str:
    """Calculate the net balance between the user and a specific person across all active debts.

    Use when the user asks "how much does X owe me?" or "what's my balance with X?".
    Do NOT use this to list individual debt records — use query_debts for that.

    Args:
        person_name: Name of the person (case-insensitive).
    """
    with _get_repo() as repo:
        debts = repo.get_by_person(person_name, status="active")
        if not debts:
            return f"No active debts found with {person_name}."

        owes_me = sum(d.remaining_amount for d in debts if d.direction == "owes_me")
        i_owe = sum(d.remaining_amount for d in debts if d.direction == "i_owe")
        net = owes_me - i_owe

        lines = [f"Active debts with {person_name}:"]
        if owes_me > 0:
            lines.append(f"  They owe you: ₹{owes_me:,.0f}")
        if i_owe > 0:
            lines.append(f"  You owe them: ₹{i_owe:,.0f}")

        if net > 0:
            lines.append(f"  Net: {person_name} owes you ₹{net:,.0f}")
        elif net < 0:
            lines.append(f"  Net: You owe {person_name} ₹{abs(net):,.0f}")
        else:
            lines.append(f"  Net: You and {person_name} are settled up")

        return "\n".join(lines)


@function_tool
def calculate_summary() -> str:
    """Calculate the overall financial summary across all people and active debts.

    Use when the user asks "what's my overall picture?" or "total owed to me?".
    Do NOT use this for a specific person — use calculate_net_balance for that.
    """
    with _get_repo() as repo:
        debts = repo.get_all(status="active")
        if not debts:
            return "No active debts. You're all clear!"

        people: dict[str, dict[str, float]] = {}
        for d in debts:
            name = d.person_name
            if name not in people:
                people[name] = {"owes_me": 0.0, "i_owe": 0.0}
            people[name][d.direction] += d.remaining_amount

        total_owes_me = 0.0
        total_i_owe = 0.0
        person_lines = []

        for name, amounts in sorted(people.items()):
            owes_me = amounts["owes_me"]
            i_owe = amounts["i_owe"]
            total_owes_me += owes_me
            total_i_owe += i_owe
            net = owes_me - i_owe
            if net > 0:
                person_lines.append(f"  {name}: owes you ₹{net:,.0f}")
            elif net < 0:
                person_lines.append(f"  {name}: you owe ₹{abs(net):,.0f}")
            else:
                person_lines.append(f"  {name}: settled up")

        net_total = total_owes_me - total_i_owe
        lines = [
            f"Total owed to you: ₹{total_owes_me:,.0f}",
            f"Total you owe: ₹{total_i_owe:,.0f}",
        ]
        if net_total > 0:
            lines.append(f"Net: You are owed ₹{net_total:,.0f}")
        elif net_total < 0:
            lines.append(f"Net: You owe ₹{abs(net_total):,.0f}")
        else:
            lines.append("Net: All square!")

        lines.append(f"\nPer person ({len(people)}):")
        lines.extend(person_lines)

        return "\n".join(lines)
