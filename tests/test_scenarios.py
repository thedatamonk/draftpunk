"""
LLM scenario test script.

Calls IntentParser.parse() directly with real-world scenarios and prints
the raw LLM responses in a readable chat-style format.

Usage:
    uv run python -m tests.test_scenarios
"""

import sys
from pathlib import Path

from app.config import get_settings
from app.llm.parser import IntentParser
from app.models.schemas import LLMResponse, Obligation

SEPARATOR = "=" * 60
LOG_FILE = Path(__file__).parent / "results.log"


"""
More scenarios to come
"messages": [
    "Payment to be recieved from Ananya",
    // Agent finds existing records from Ananya, confirms the users if I have to update something in them
    //"If not existing records are found, then agent asks the missing details from the user.

]

"""
SCENARIOS = [
    {
        "name": "Equal split - petrol with Shivam",
        "messages": [
            "Weekend vacation with Shivam. Record petrol charges for car of 7K. Needs to be split equally.",
        ],
    },
    {
        "name": "Multi-turn - Ananya payment",
        "messages": [
            "Payment to be received from Ananya",
            "8900rs",
        ],
    },
    # scenario 3 is failing...it's not including me in the bill split
    {
        "name": "Unequal split - stress test",
        "messages": [
            "Brunch with office friends at Daddy's. Total bill 3000. "
            "Total 4 people - Shivam, Yashasvi and Anjali. "
            "Anjali will pay only 1000rs while remaining amount split equally between the other 3.",
        ],
    },
    # ── Adversarial scenarios ───────────────────────────────────────
    # We also need to test if I can set up a different installment amount?? Currently the agent assumes that it will be for 1 month.
    {
        "name": "Recurring advance with multiple amounts — Anita double advance",
        "messages": [
            "Anita's salary is 4500 rs per month. I have already paid her advance "
            "500rs for her kid's fees and 500rs again for some emergency as cash. "
            "Record this so that I don't forget this when I am paying her salary.",
        ],
    },
    {
        "name": "Unnamed person — girlfriend",
        "messages": [
            "Dinner date with girlfriend, Total bill is 5K. Bill needs to be split equally",
        ],
    },
    {
        "name": "Missing amount — bill split with no total",
        "messages": [
            "Brunch with office friends at Bier Library. Total bill needs to be split equally.",
        ],
    },

    # We need to add another marker in the UI to show that I owe someone this much money
    {
        "name": "Reversed direction — user owes someone else",
        "messages": [
            "I owe Rahul 5000 for the concert tickets he booked",
        ],
    },

    # Here also the agent assumed that the money needs to be recovered in 6 months. Need to test if the agent can handle the scenario if I 
    # ask it to set a different duration.
    {
        "name": "Hinglish input",
        "messages": [
            "Sunita ko 5800 diya phone ke liye, har mahine 1000 katna",
        ],
    },

    # The agent shouldn't have answered this question.
    {
        "name": "Off-topic / non-financial message",
        "messages": [
            "Remind me to call mom tomorrow at 10am",
        ],
    },

    # Same issue...I am not included in the user count.
    {
        "name": "Head-count split math — user included in count",
        "messages": [
            "Dinner at Bombay Canteen. Total bill 4800. "
            "4 people — me, Kunal, Priya and Sid. Split equally.",
        ],
    },
    # The LLM did the math properly, but did not include the user again in the calculation plus the total amount due was also incorrect. Did not add it in the response.
    {
        "name": "Tip/tax on top of base — derived arithmetic",
        "messages": [
            "Lunch with Meera, bill was 2000 plus 18% GST. "
            "I paid the whole thing, split equally.",
        ],
    },

    # Agent was able to identify the intent, but not sure if it updated the DB correctly or not?
    # Need to add multiple turns here.
    {
        "name": "Partial settlement — Sunita paid 2000",
        "context": [
            Obligation(
                person_name="Sunita",
                type="recurring",
                total_amount=5800,
                remaining_amount=5800,
                expected_per_cycle=1000,
                note="Phone advance",
            ),
        ],
        "messages": [
            "Sunita ne 2000 de diye",
        ],
    },

    # The agent failed to understand the intent and is hallucinating the remaining amount
    # to 3800..How? Why?
    {
        "name": "Edit existing obligation — change monthly deduction",
        "context": [
            Obligation(
                person_name="Sunita",
                type="recurring",
                total_amount=5800,
                remaining_amount=3800,
                expected_per_cycle=1000,
                note="Phone advance",
            ),
        ],
        "messages": [
            "Change Sunita's monthly deduction to 1500 instead of 1000",
        ],
    },
    # ── Settlement scenarios ─────────────────────────────────────────
    # Need to check if DB got updated or not in this case.
    {
        "name": "Full settlement — Shivam paid back",
        "context": [
            Obligation(
                person_name="Shivam",
                type="one_time",
                total_amount=3500,
                remaining_amount=3500,
                note="Petrol charges",
            ),
        ],
        "messages": [
            "Shivam paid me back the 3500 for petrol",
        ],
    },
    {
        "name": "Chitchat — simple greeting",
        "messages": ["Hi!"],
    },
    # Agent should ask which obligation are we talking about?
    {
        "name": "Settle with multiple obligations — Anjali partial",
        "context": [
            Obligation(
                person_name="Anjali",
                type="one_time",
                total_amount=1000,
                remaining_amount=1000,
                note="Brunch at Daddy's",
            ),
            Obligation(
                person_name="Anjali",
                type="one_time",
                total_amount=2500,
                remaining_amount=2500,
                note="Movie tickets",
            ),
        ],
        "messages": [
            "Anjali just paid 1000 for the brunch",
        ],
    },
]


def _intent_summary(result: LLMResponse) -> str:
    """Format a one-line summary of the parsed intent."""
    p = result.parsed
    if p is None:
        return "[parsed=None]"
    persons = [f'"{n}"' for n in p.persons]
    parts = [
        f"action={p.action}",
        f"persons=[{', '.join(persons)}]",
        f"amount={p.amount}",
        f"type={p.obligation_type}",
        f"ambiguous={str(p.is_ambiguous).lower()}",
    ]
    if p.expected_per_cycle is not None:
        parts.append(f"per_cycle={p.expected_per_cycle}")
    if p.clarifying_question:
        parts.append(f'question="{p.clarifying_question}"')
    return "[" + ", ".join(parts) + "]"


def _print_and_log(text: str, file):
    """Print to stdout and write to log file."""
    print(text)
    file.write(text + "\n")


def run_scenario(parser: IntentParser, index: int, scenario: dict, log):
    """Run a single scenario: feed each message in sequence, building history."""
    _print_and_log(f"\n{SEPARATOR}", log)
    _print_and_log(f"SCENARIO {index}: {scenario['name']}", log)
    _print_and_log(SEPARATOR, log)

    history: list[dict] = []

    for msg in scenario["messages"]:
        _print_and_log(f"\n  User: {msg}", log)

        result = parser.parse(msg, context=scenario.get("context"), history=history or None)

        _print_and_log(f"\n  Bot: {result.confirmation_message}", log)
        _print_and_log(f"\n  {_intent_summary(result)}", log)

        # Accumulate history for subsequent turns
        history.append({"role": "user", "content": msg})
        history.append({"role": "assistant", "content": result.confirmation_message})


def main():
    settings = get_settings()

    if not settings.openrouter_api_key:
        print("ERROR: OPENROUTER_API_KEY not set. Add it to .env and retry.")
        sys.exit(1)

    parser = IntentParser(api_key=settings.openrouter_api_key, model=settings.llm_model)

    print(f"Model: {settings.llm_model}")
    print(f"Log:   {LOG_FILE}")

    with open(LOG_FILE, "w") as log:
        _print_and_log(f"Model: {settings.llm_model}", log)

        for i, scenario in enumerate(SCENARIOS, 1):
            run_scenario(parser, i, scenario, log)

        _print_and_log(f"\n{SEPARATOR}", log)
        _print_and_log("Done. Review results above or in tests/results.log", log)
        _print_and_log(SEPARATOR, log)


if __name__ == "__main__":
    main()
