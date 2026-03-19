# Agent Test Scenarios

Run these through Telegram one by one. Watch for correct tool selection, confirmation gates, no fabrication, and calculation accuracy.

---

## 1. CREATE DEBT — simple one-time
**You:** Gave Rahul 5000 for groceries
**Expect:** Confirms — Rahul owes you ₹5,000, note: groceries. Waits for "yes" before calling `create_debt`.

## 2. CREATE DEBT — missing direction
**You:** 3k with Priya
**Expect:** Asks "did you give Priya 3k or did she give you?" — does NOT assume.

## 3. CREATE DEBT — Hinglish
**You:** Akash ko 2k diye kal
**Expect:** Understands "diye" = gave, direction = owes_me. Confirms: Akash owes you ₹2,000.

## 4. CREATE DEBT — recurring
**You:** Rahul pays me 1k monthly for Netflix, total 6k
**Expect:** Confirms type=recurring, amount=6000, expected_per_cycle=1000.

## 5. CREATE SPLIT — equal split
**You:** Paid 4000 for lunch with Rahul, Priya, and Akash
**Expect:** Shows 4-way split (₹1,000 each), lists all 3 names, waits for confirmation.

## 6. CREATE SPLIT — currency shorthand
**You:** Dinner bill 6.5k, split with Neha and Sanjay
**Expect:** Parses 6.5k = 6500, 3-way split = ₹2,167 each.

## 7. QUERY — by person
**You:** Show me Rahul's debts
**Expect:** Calls `query_debts` (no confirmation needed), lists individual debt records for Rahul.

## 8. QUERY — all active
**You:** Show me all active debts
**Expect:** Lists all active debts across all people.

## 9. QUERY — by direction
**You:** Who all owe me money?
**Expect:** Calls `query_debts` with direction=owes_me.

## 10. EDIT — change amount
**You:** Actually that Rahul grocery debt was 4500 not 5000
**Expect:** Calls `query_debts` to find the right one, confirms the edit, then calls `edit_debt`.

## 11. RECORD PAYMENT — partial
**You:** Rahul paid me 2000
**Expect:** Looks up Rahul's debts, identifies the right one (or asks if multiple), confirms, calls `record_payment`.

## 12. RECORD PAYMENT — full
**You:** Priya paid her full amount
**Expect:** Looks up Priya's debt, confirms recording full remaining amount.

## 13. SETTLE
**You:** Settle up with Akash
**Expect:** If Akash has multiple debts, lists them and asks which one. If one, confirms and calls `settle_debt`.

## 14. DELETE
**You:** Delete that Netflix debt with Rahul
**Expect:** Looks up Rahul's debts, identifies the recurring one, confirms deletion.

## 15. CALCULATE — pure arithmetic
**You:** What's 4500 split 3 ways with 10% tip?
**Expect:** Calls `calculate` with expression like `(4500 * 1.1) / 3`. Returns ₹1,650.

## 16. CALCULATE — percentage
**You:** What's 18% GST on 3200?
**Expect:** Calls `calculate`. Returns 576.

## 17. CALCULATE NET BALANCE — single person
**You:** How much does Rahul owe me total?
**Expect:** Calls `calculate_net_balance` (NOT `query_debts`). Returns net amount across all Rahul's debts.

## 18. CALCULATE NET BALANCE — both directions
**You:** What's my balance with Priya?
**Expect:** Calls `calculate_net_balance`. If debts exist in both directions, shows net.

## 19. CALCULATE SUMMARY — overall picture
**You:** What's my overall financial picture?
**Expect:** Calls `calculate_summary`. Shows total owed to you, total you owe, net, per-person breakdown.

## 20. CALCULATE SUMMARY — variant phrasing
**You:** Kitna paisa aana hai mera total?
**Expect:** Understands Hinglish, calls `calculate_summary`.

## 21. DISAMBIGUATION — calculate vs query
**You:** Rahul ka hisaab dikhao
**Expect:** Ambiguous ("show Rahul's account"). Should show net balance or ask if they want list vs total.

## 22. FABRICATION GUARD — missing name
**You:** Gave 3000 yesterday
**Expect:** Asks "who did you give it to?" — does NOT make up a name.

## 23. FABRICATION GUARD — vague request
**You:** Record that debt
**Expect:** Asks for all missing details — person, amount, direction.

## 24. CONFIRMATION GATE — user says no
**You:** Gave Rahul 5000
**Agent:** "I'll record: Rahul owes you ₹5,000. Shall I go ahead?"
**You:** No wait, it was 4000
**Expect:** Does NOT create the debt, updates to 4000 and re-confirms.

## 25. NO TOOL NEEDED — general chat
**You:** Hey what can you do?
**Expect:** Explains capabilities without calling any tool.
