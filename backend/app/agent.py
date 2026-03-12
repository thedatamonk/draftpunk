from pathlib import Path

from agents import Agent

from app.config import get_settings
from app.tools import (
    create_debt,
    create_split_debts,
    query_debts,
    edit_debt,
    record_payment,
    settle_debt,
    delete_debt,
    calculate,
    calculate_net_balance,
    calculate_summary,
)

SYSTEM_PROMPT = (Path(__file__).parent / "prompts" / "agent.md").read_text()

settings = get_settings()

memory_agent = Agent(
    name="MemoryLedger",
    model=settings.llm_model,
    instructions=SYSTEM_PROMPT,
    tools=[
        # Data tools
        create_debt,
        create_split_debts,
        edit_debt,
        record_payment,
        settle_debt,
        delete_debt,
        # Query tools
        query_debts,
        # Calculation tools
        calculate,
        calculate_net_balance,
        calculate_summary,
    ],
)
