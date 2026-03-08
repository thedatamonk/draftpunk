# Conversational Scenarios Spec

Behavioral specification for the Memory Logger agent. Each scenario defines what the agent should do given a user message — which tool to call, what to ask, and what the response should look like.

**Tools available to the agent:**

- `create_debt(person_name, amount, direction, type, expected_per_cycle?, note?)`
- `create_split_debts(person_names, total_amount, direction, note?)`
- `query_debts(person_name?, status?, direction?)`
- `edit_debt(debt_id, person_name?, total_amount?, expected_per_cycle?, note?)`
- `record_payment(debt_id, amount, note?)`
- `settle_debt(debt_id)`
- `delete_debt(debt_id)`

---

## 1. Clear Inputs

### 1.1 Simple one-time debt — someone owes me

**User:** "Rahul owes me 500 for dinner"
**Expected behavior:** Call `create_debt(person_name="Rahul", amount=500, direction="owes_me", type="one_time", note="dinner")`
**Expected response:** Confirmation message like "Got it! Recorded that Rahul owes you ₹500 for dinner."

### 1.2 Simple one-time debt — I owe someone

**User:** "I owe Priya 1200 for the cab"
**Expected behavior:** Call `create_debt(person_name="Priya", amount=1200, direction="i_owe", type="one_time", note="cab")`
**Expected response:** Confirmation message like "Noted! You owe Priya ₹1200 for the cab."

### 1.3 Recurring debt with monthly deduction

**User:** "Amit lent me 50000, I'll pay 5000 per month"
**Expected behavior:** Call `create_debt(person_name="Amit", amount=50000, direction="i_owe", type="recurring", expected_per_cycle=5000, note=null)`
**Expected response:** Confirmation mentioning the total, monthly deduction, and approximate number of months. E.g., "Recorded! You owe Amit ₹50,000 — paying ₹5,000/month (~10 months)."

### 1.4 One-time debt with no note

**User:** "Sana owes me 300"
**Expected behavior:** Call `create_debt(person_name="Sana", amount=300, direction="owes_me", type="one_time")`
**Expected response:** Confirmation like "Got it! Sana owes you ₹300."

### 1.5 Debt with explicit type cue

**User:** "I gave Rohan 10000, he'll return 2000 every month"
**Expected behavior:** Call `create_debt(person_name="Rohan", amount=10000, direction="owes_me", type="recurring", expected_per_cycle=2000)`
**Expected response:** Confirmation with total, monthly amount, and duration.

---

## 2. Currency Parsing

### 2.1 "k" notation

**User:** "Rahul owes me 5k"
**Expected behavior:** Parse 5k as 5000. Call `create_debt(person_name="Rahul", amount=5000, direction="owes_me", type="one_time")`
**Expected response:** Confirmation showing ₹5,000 (not "5k").

### 2.2 Decimal "k" notation

**User:** "I owe Priya 1.5k for groceries"
**Expected behavior:** Parse 1.5k as 1500. Call `create_debt(person_name="Priya", amount=1500, direction="i_owe", type="one_time", note="groceries")`
**Expected response:** Confirmation showing ₹1,500.

### 2.3 Rupee symbol with commas

**User:** "Deepak owes me ₹3,200 for the tickets"
**Expected behavior:** Parse ₹3,200 as 3200. Call `create_debt(person_name="Deepak", amount=3200, direction="owes_me", type="one_time", note="tickets")`
**Expected response:** Confirmation showing ₹3,200.

### 2.4 Plain number

**User:** "I owe Meera 850"
**Expected behavior:** Parse as 850. Call `create_debt(person_name="Meera", amount=850, direction="i_owe", type="one_time")`
**Expected response:** Confirmation showing ₹850.

### 2.5 "k" in recurring context

**User:** "Borrowed 50k from Dad, will return 5k monthly"
**Expected behavior:** Parse 50k as 50000, 5k as 5000. Call `create_debt(person_name="Dad", amount=50000, direction="i_owe", type="recurring", expected_per_cycle=5000)`
**Expected response:** Confirmation with ₹50,000 total, ₹5,000/month.

### 2.6 Dollar sign

**User:** "Raj owes me $200"
**Expected behavior:** Parse as 200. Call `create_debt(person_name="Raj", amount=200, direction="owes_me", type="one_time")`
**Expected response:** Confirmation showing the amount (agent may use ₹ or $ depending on context).

---

## 3. Hinglish Support

### 3.1 Hindi verb for giving — "diya"

**User:** "Maine Rahul ko 500 diya"
**Expected behavior:** Interpret as "I gave Rahul 500" → Rahul owes me. Call `create_debt(person_name="Rahul", amount=500, direction="owes_me", type="one_time")`
**Expected response:** Confirmation in natural Hinglish or English.

### 3.2 Hindi verb for owing — "dena hai"

**User:** "Mujhe Priya ko 1000 dena hai"
**Expected behavior:** Interpret as "I have to give Priya 1000" → I owe Priya. Call `create_debt(person_name="Priya", amount=1000, direction="i_owe", type="one_time")`
**Expected response:** Confirmation like "Noted! You owe Priya ₹1,000."

### 3.3 Mixed sentence — "liya" + "wapas karna hai"

**User:** "Amit se 5000 liya, wapas karna hai"
**Expected behavior:** Interpret as "Took 5000 from Amit, have to return it" → I owe Amit. Call `create_debt(person_name="Amit", amount=5000, direction="i_owe", type="one_time")`
**Expected response:** Confirmation that you owe Amit ₹5,000.

### 3.4 Hinglish query

**User:** "Rahul pe kitna baaki hai?"
**Expected behavior:** Interpret as "How much is remaining on Rahul?" → Call `query_debts(person_name="Rahul", status="active")`
**Expected response:** List of active debts involving Rahul with remaining amounts.

### 3.5 Hinglish settle

**User:** "Priya ka settle kar do"
**Expected behavior:** Interpret as "Settle Priya's debt." Call `query_debts(person_name="Priya", status="active")` first. If single result, call `settle_debt(debt_id)`. If multiple, ask which one.
**Expected response:** Confirmation of settlement or disambiguation question.

### 3.6 Hindi for "took from me"

**User:** "Rohan ne mujhse 2000 liye"
**Expected behavior:** Interpret as "Rohan took 2000 from me" → Rohan owes me. Call `create_debt(person_name="Rohan", amount=2000, direction="owes_me", type="one_time")`
**Expected response:** Confirmation that Rohan owes you ₹2,000.

---

## 4. Multi-Person Splits

### 4.1 Equal split — user paid

**User:** "Dinner was 3000, split between me, Rahul, and Priya"
**Expected behavior:** Total = 3000, 3 people, per-person = 1000. User paid, so Rahul and Priya each owe user 1000. Call `create_split_debts(person_names=["Rahul", "Priya"], total_amount=2000, direction="owes_me", note="dinner split")`
**Expected response:** "Split recorded! Rahul owes you ₹1,000 and Priya owes you ₹1,000 for dinner."

### 4.2 Equal split — someone else paid

**User:** "Rahul paid 2400 for lunch, split between me, Rahul, Priya, and Sana"
**Expected behavior:** 4 people, per-person = 600. Rahul paid, so user owes Rahul 600. Priya and Sana's debts to Rahul are not the user's concern. Call `create_debt(person_name="Rahul", amount=600, direction="i_owe", type="one_time", note="lunch split")`
**Expected response:** "Noted! You owe Rahul ₹600 for the lunch split." Agent should only track the user's portion.

### 4.3 Ambiguous split — missing who paid

**User:** "Bill was 1500, split with Rahul and Amit"
**Expected behavior:** Agent doesn't know who paid. Ask a clarifying question.
**Expected response:** "Who paid the bill — you, Rahul, or Amit?"

**User (turn 2):** "I paid"
**Expected behavior:** 3 people, per-person = 500. Rahul and Amit each owe user 500. Call `create_split_debts(person_names=["Rahul", "Amit"], total_amount=1000, direction="owes_me", note="bill split")`
**Expected response:** Confirmation of split with amounts.

### 4.4 Unequal split — explicit amounts

**User:** "Paid 5000 for trip. Rahul owes 2000, Priya owes 1500, rest is mine"
**Expected behavior:** Create individual debts. Call `create_debt` for Rahul (2000, owes_me) and Priya (1500, owes_me) with note "trip".
**Expected response:** Confirmation listing both debts.

### 4.5 Split with "k" notation

**User:** "Dinner bill 6k, split equally between me, Rahul, Priya, and Deepak. I paid."
**Expected behavior:** 6000 / 4 = 1500 each. Rahul, Priya, Deepak each owe 1500. Call `create_split_debts(person_names=["Rahul", "Priya", "Deepak"], total_amount=4500, direction="owes_me", note="dinner split")`
**Expected response:** Confirmation showing each person owes ₹1,500.

---

## 5. Vague/Ambiguous Inputs

### 5.1 Missing person

**User:** "I lent 5000"
**Expected behavior:** No tool call. Ask who the money was lent to.
**Expected response:** "Who did you lend ₹5,000 to?"

### 5.2 Missing amount

**User:** "Rahul owes me for lunch"
**Expected behavior:** No tool call. Ask for the amount.
**Expected response:** "How much does Rahul owe you for lunch?"

### 5.3 Missing direction

**User:** "500 between me and Rahul"
**Expected behavior:** No tool call. Ask for direction/context.
**Expected response:** "Could you clarify — do you owe Rahul ₹500, or does Rahul owe you?"

### 5.4 Completely vague

**User:** "money thing with Priya"
**Expected behavior:** No tool call. Ask for more details.
**Expected response:** "Could you give me more details? Does Priya owe you, or do you owe Priya? And how much?"

### 5.5 Follow-up after clarification (multi-turn)

**User (turn 1):** "I lent 5000"
**Agent:** "Who did you lend ₹5,000 to?"
**User (turn 2):** "Rahul"
**Expected behavior:** Now has all info. Call `create_debt(person_name="Rahul", amount=5000, direction="owes_me", type="one_time")`
**Expected response:** Confirmation that Rahul owes you ₹5,000.

### 5.6 Missing amount follow-up

**User (turn 1):** "Sana owes me for the movie tickets"
**Agent:** "How much does Sana owe you for the movie tickets?"
**User (turn 2):** "350"
**Expected behavior:** Call `create_debt(person_name="Sana", amount=350, direction="owes_me", type="one_time", note="movie tickets")`
**Expected response:** Confirmation with amount and note.

### 5.7 Recurring debt missing deduction amount

**User:** "I owe Deepak 30000, I'll pay monthly"
**Expected behavior:** Has total and direction but missing expected_per_cycle. Ask for the monthly amount.
**Expected response:** "How much will you pay Deepak per month?"

---

## 6. Queries

### 6.1 General query — all active debts

**User:** "What's my balance?"
**Expected behavior:** Call `query_debts(status="active")`
**Expected response:** Summary of all active debts, grouped or listed clearly. Include total owed and total owed to user. If no active debts, say so.

### 6.2 Person-specific query

**User:** "How much does Rahul owe me?"
**Expected behavior:** Call `query_debts(person_name="Rahul", direction="owes_me", status="active")`
**Expected response:** List of active debts where Rahul owes user, with amounts and notes.

### 6.3 Direction-specific query

**User:** "Who all owe me money?"
**Expected behavior:** Call `query_debts(direction="owes_me", status="active")`
**Expected response:** List of people and amounts owed to the user.

### 6.4 Settled debts query

**User:** "Show me settled debts"
**Expected behavior:** Call `query_debts(status="settled")`
**Expected response:** List of settled debts with amounts and people.

### 6.5 Query with no results

**User:** "How much does Meera owe me?"
**Expected behavior:** Call `query_debts(person_name="Meera", direction="owes_me", status="active")`
**Expected response:** "No active debts found where Meera owes you."

### 6.6 Specific debt details

**User:** "Show me details of my debt with Amit"
**Expected behavior:** Call `query_debts(person_name="Amit")`
**Expected response:** All debts (active and settled) involving Amit, with full details — amount, remaining, direction, type, note, created date.

### 6.7 Summary query — total amounts

**User:** "Kitna paisa bahar hai?" (How much money is out?)
**Expected behavior:** Call `query_debts(status="active")`
**Expected response:** Summarized totals — how much others owe user, how much user owes others, net position.

---

## 7. Settle Operations

### 7.1 Clear settle — single active debt with person

**User:** "Settle Rahul"
**Expected behavior:** Call `query_debts(person_name="Rahul", status="active")`. If exactly one result, call `settle_debt(debt_id)`.
**Expected response:** "Settled! Rahul's debt of ₹500 for dinner is now marked as settled."

### 7.2 Ambiguous settle — multiple active debts with person

**User:** "Settle Priya"
**Expected behavior:** Call `query_debts(person_name="Priya", status="active")`. Multiple results found. Ask which one.
**Expected response:** "Priya has multiple active debts:\n1. ₹1,000 for groceries\n2. ₹500 for cab\nWhich one do you want to settle, or all of them?"

**User (turn 2):** "The groceries one"
**Expected behavior:** Call `settle_debt(debt_id)` for the groceries debt.
**Expected response:** Confirmation of settlement.

**User (turn 2 — alternative):** "All of them"
**Expected behavior:** Call `settle_debt(debt_id)` for each active debt.
**Expected response:** "Settled all of Priya's debts! (₹1,000 for groceries, ₹500 for cab)"

### 7.3 Settle with no active debts

**User:** "Settle Deepak"
**Expected behavior:** Call `query_debts(person_name="Deepak", status="active")`. No results.
**Expected response:** "Deepak has no active debts to settle."

### 7.4 Settle with debt ID context

**User:** "Settle debt #5"
**Expected behavior:** Call `settle_debt(debt_id=5)`.
**Expected response:** Confirmation of settlement with details of what was settled.

---

## 8. Partial Payments

### 8.1 Clear partial payment

**User:** "Rahul paid 200"
**Expected behavior:** Call `query_debts(person_name="Rahul", status="active")`. Find the matching debt. Call `record_payment(debt_id, amount=200)`.
**Expected response:** "Recorded! Rahul paid ₹200. Remaining: ₹300 (was ₹500)."

### 8.2 Partial payment with note

**User:** "Paid Priya 5000 for this month's installment"
**Expected behavior:** Call `query_debts(person_name="Priya", status="active")`. Find matching recurring debt. Call `record_payment(debt_id, amount=5000, note="this month's installment")`.
**Expected response:** "Recorded! You paid Priya ₹5,000. Remaining: ₹45,000."

### 8.3 Overpayment

**User:** "Rahul paid me 700" (but only owes 500)
**Expected behavior:** Call `query_debts(person_name="Rahul", status="active")`. Detect overpayment. Alert the user.
**Expected response:** "Rahul only owes you ₹500, but you said he paid ₹700. Would you like to record ₹500 and settle the debt, or record the full ₹700?"

### 8.4 Payment completing a debt

**User:** "Amit paid 500" (owes exactly 500)
**Expected behavior:** Call `query_debts(person_name="Amit", status="active")`. Find matching debt with remaining = 500. Call `record_payment(debt_id, amount=500)`. Debt auto-settles.
**Expected response:** "Recorded! Amit paid ₹500. Debt is fully settled now."

### 8.5 Ambiguous payment — multiple debts

**User:** "Priya paid 1000"
**Expected behavior:** Call `query_debts(person_name="Priya", status="active")`. Multiple debts found. Ask which one.
**Expected response:** "Priya has multiple active debts:\n1. ₹2,000 for rent\n2. ₹800 for dinner\nWhich debt is this ₹1,000 payment for?"

### 8.6 Hinglish partial payment

**User:** "Rahul ne 200 de diye"
**Expected behavior:** Interpret as "Rahul gave 200." Call `query_debts(person_name="Rahul", status="active")`. Record payment.
**Expected response:** Confirmation with remaining amount.

---

## 9. Edit Operations

### 9.1 Edit amount

**User:** "Change Rahul's debt to 600"
**Expected behavior:** Call `query_debts(person_name="Rahul", status="active")`. If single debt, call `edit_debt(debt_id, total_amount=600)`. If multiple, disambiguate first.
**Expected response:** "Updated! Rahul's debt changed from ₹500 to ₹600."

### 9.2 Edit note

**User:** "Update the note on Priya's debt to 'birthday gift'"
**Expected behavior:** Call `query_debts(person_name="Priya", status="active")`. If single, call `edit_debt(debt_id, note="birthday gift")`.
**Expected response:** "Updated! Note on Priya's debt changed to 'birthday gift'."

### 9.3 Edit monthly deduction

**User:** "Change Amit's monthly payment to 3000"
**Expected behavior:** Call `query_debts(person_name="Amit", status="active", type="recurring")`. Call `edit_debt(debt_id, expected_per_cycle=3000)`.
**Expected response:** "Updated! Monthly payment for Amit's debt changed to ₹3,000."

### 9.4 Edit with ambiguity

**User:** "Update Priya's amount"
**Expected behavior:** Missing the new amount. Ask for it.
**Expected response:** "What should the new amount be for Priya's debt?"

### 9.5 Edit person name

**User:** "I spelled it wrong — it's Rohit, not Rohan"
**Expected behavior:** Call `query_debts(person_name="Rohan", status="active")`. If found, call `edit_debt(debt_id, person_name="Rohit")`.
**Expected response:** "Updated! Changed the name from Rohan to Rohit."

---

## 10. Delete Operations

### 10.1 Clear delete — with confirmation

**User:** "Delete Rahul's debt"
**Expected behavior:** Call `query_debts(person_name="Rahul", status="active")`. Find the debt. Ask for confirmation before deleting.
**Expected response:** "Are you sure you want to delete Rahul's debt of ₹500 for dinner? This can't be undone."

### 10.2 Confirmed delete

**User (turn 1):** "Delete Rahul's debt"
**Agent:** "Are you sure you want to delete Rahul's debt of ₹500 for dinner? This can't be undone."
**User (turn 2):** "Yes"
**Expected behavior:** Call `delete_debt(debt_id)`.
**Expected response:** "Done! Rahul's debt of ₹500 has been deleted."

### 10.3 Cancelled delete

**User (turn 1):** "Delete Priya's debt"
**Agent:** "Are you sure you want to delete Priya's debt of ₹1,200? This can't be undone."
**User (turn 2):** "No, never mind"
**Expected behavior:** No tool call. Acknowledge cancellation.
**Expected response:** "Okay, Priya's debt has not been deleted."

### 10.4 Delete with multiple debts

**User:** "Delete Priya's debt"
**Expected behavior:** Call `query_debts(person_name="Priya", status="active")`. Multiple debts found. Ask which one.
**Expected response:** "Priya has multiple debts:\n1. ₹1,000 for groceries\n2. ₹500 for cab\nWhich one do you want to delete?"

### 10.5 Delete non-existent debt

**User:** "Delete Meera's debt"
**Expected behavior:** Call `query_debts(person_name="Meera")`. No results.
**Expected response:** "No debts found for Meera."

---

## 11. Chitchat

### 11.1 Greeting

**User:** "Hi"
**Expected behavior:** No tool call. Respond with a friendly greeting.
**Expected response:** A warm greeting, optionally mentioning what the agent can do. E.g., "Hey! How can I help you with your debts today?"

### 11.2 Thanks

**User:** "Thanks!"
**Expected behavior:** No tool call. Acknowledge.
**Expected response:** "You're welcome! Let me know if you need anything else."

### 11.3 How are you

**User:** "How are you?"
**Expected behavior:** No tool call. Respond casually.
**Expected response:** Brief, friendly response. E.g., "I'm good! Ready to help you track your money."

### 11.4 Goodbye

**User:** "Bye"
**Expected behavior:** No tool call. Say goodbye.
**Expected response:** "Bye! Let me know whenever you need to track something."

### 11.5 Emoji-only message

**User:** "👍"
**Expected behavior:** No tool call. Acknowledge or ask if they need anything.
**Expected response:** "Need anything else?"

---

## 12. Off-Topic

### 12.1 Non-financial request

**User:** "Set a reminder for 5pm"
**Expected behavior:** No tool call. Politely decline and redirect.
**Expected response:** "I can only help with tracking debts and payments. Need to record or check anything?"

### 12.2 General knowledge question

**User:** "What's the capital of France?"
**Expected behavior:** No tool call. Politely decline and redirect.
**Expected response:** "I'm just your debt tracker — I can't help with general questions. But if you need to log or check any debts, I'm here!"

### 12.3 Emotional/personal message

**User:** "I'm feeling stressed about money"
**Expected behavior:** No tool call. Acknowledge briefly, redirect to what the agent can do.
**Expected response:** Brief empathetic acknowledgment, then offer to show their current balance or help organize debts.

### 12.4 Request to do math

**User:** "What's 15% tip on 2400?"
**Expected behavior:** No tool call. Politely decline.
**Expected response:** "I'm focused on debt tracking — I can't do general math. But if you want to split a ₹2,400 bill, I can help with that!"

---

## 13. Edge Cases

### 13.1 Zero amount

**User:** "Rahul owes me 0"
**Expected behavior:** No tool call. Reject gracefully.
**Expected response:** "That's a zero amount — nothing to track! Did you mean something else?"

### 13.2 Negative amount

**User:** "I owe Priya -500"
**Expected behavior:** No tool call. Reject or clarify.
**Expected response:** "I can't record a negative amount. Did you mean Priya owes you ₹500?"

### 13.3 Settling an already settled debt

**User:** "Settle Rahul" (all Rahul's debts are already settled)
**Expected behavior:** Call `query_debts(person_name="Rahul", status="active")`. No active debts.
**Expected response:** "Rahul has no active debts to settle."

### 13.4 Duplicate detection

**User:** "Rahul owes me 500 for dinner" (identical debt already exists)
**Expected behavior:** Call `query_debts(person_name="Rahul", status="active")`. Notice a matching active debt. Warn the user.
**Expected response:** "There's already an active debt from Rahul for ₹500 (dinner). Do you want to create another one, or did you mean something else?"

### 13.5 Very large amount

**User:** "Amit owes me 50,00,000"
**Expected behavior:** Parse Indian comma notation (50,00,000 = 5000000). Call `create_debt(person_name="Amit", amount=5000000, direction="owes_me", type="one_time")`.
**Expected response:** Confirmation showing ₹50,00,000 or ₹50 lakh.

### 13.6 Same person, opposite directions

**User:** "Rahul owes me 500" (user already owes Rahul 300)
**Expected behavior:** Create the new debt as requested. Optionally mention the net position.
**Expected response:** "Got it! Rahul owes you ₹500. FYI, you also owe Rahul ₹300 — net, Rahul owes you ₹200."

### 13.7 Person name variations

**User (turn 1):** "Rahul owes me 500"
**User (turn 2):** "rahul paid 200"
**Expected behavior:** Match "rahul" to "Rahul" case-insensitively. Query and record payment correctly.
**Expected response:** Normal payment confirmation.

### 13.8 Very long note

**User:** "Priya owes me 500 for the thing we bought at the market last Tuesday when we went out with Amit and Sana and it was raining"
**Expected behavior:** Create debt with the full note (or a reasonable truncation). Call `create_debt(person_name="Priya", amount=500, direction="owes_me", type="one_time", note="the thing we bought at the market last Tuesday...")`.
**Expected response:** Confirmation with a summarized or full note.

### 13.9 Multiple debts in one message

**User:** "Rahul owes me 500 and I owe Priya 300"
**Expected behavior:** Create two separate debts. Call `create_debt` twice — once for Rahul (owes_me, 500) and once for Priya (i_owe, 300).
**Expected response:** Confirmation of both debts in a single response.

### 13.10 Ambiguous name — too short

**User:** "R owes me 500"
**Expected behavior:** Agent should attempt to use "R" as the name, or ask for clarification if it seems ambiguous.
**Expected response:** Either create the debt with person_name="R", or ask "Who is 'R'? Could you give me their full name?"

### 13.11 Payment for someone with no active debts

**User:** "Meera paid me 500"
**Expected behavior:** Call `query_debts(person_name="Meera", status="active")`. No results.
**Expected response:** "Meera doesn't have any active debts. Did you want to record a new debt instead?"

### 13.12 Edit a settled debt

**User:** "Change Rahul's settled debt amount to 600"
**Expected behavior:** Query finds only settled debts. Inform user that settled debts shouldn't be edited, or ask for confirmation.
**Expected response:** "That debt is already settled. Are you sure you want to edit it?"

### 13.13 Message with no financial content but mentions a name

**User:** "Rahul is coming over tonight"
**Expected behavior:** No tool call. This is not a financial request.
**Expected response:** "Sounds fun! Let me know if you need to track any expenses from tonight."
