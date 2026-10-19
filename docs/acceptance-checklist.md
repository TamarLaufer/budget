# End-to-end acceptance checklist

Run against a real backend and Firebase project before calling a build releasable. Use three
separate Firebase accounts with real, verifiable email addresses (A, B and C). Record the build,
date and tester for each run.

Automated coverage for each item is noted in *italics*; the manual run checks that the pieces work
together on a device.

## Setup

- [ ] Backend deployed (or running locally), `GET /health/ready` returns `{"status":"ok"}`.
- [ ] APK built from the commit under test and installed on a real Android device.

## User A — owner

1. [ ] Register A in the app. A verification email arrives. Verify it.
2. [ ] Onboarding appears. Create a household (with default categories on).
       *(households.test.ts: creation, OWNER role, default categories, no second household)*
3. [ ] Categories tab: add a category, rename it, deactivate and reactivate it. A duplicate name shows an error.
       *(catalog.test.ts)*
4. [ ] Dashboard → "עריכת תקציבים": set October budgets for two categories.
       *(budgets.test.ts)*
5. [ ] Add an expense of ₪87.90 in a budgeted category. On returning, the dashboard shows it immediately:
       category spending, remaining, percent, progress bar and the totals all change.
       *(store.test.ts "dashboard updates immediately after adding an expense")*
6. [ ] Add an expense that pushes one category over budget: the card shows the red border, the
       "חריגה מהתקציב" badge, a negative remaining amount and a full progress bar; the percent exceeds 100.
7. [ ] Add an income entry. The income and monthly balance row updates and category spending does not.
8. [ ] Edit the expense (amount and category) and then delete another one. The dashboard reflects both.
9. [ ] Force-close the app and reopen it. A is still signed in and the data is still there.
10. [ ] Turn on airplane mode and try to add an expense. A clear Hebrew error appears and the form keeps
        the typed values. Turn the network back on and press save again. It succeeds.

## User B — invited member

11. [ ] As A: Settings → invite B's email as MEMBER. The invitation appears as "ממתינה" (pending).
12. [ ] Register B on a second device (or after signing A out). Before verifying the email, no
        invitations are shown; the screen asks to verify. *(invitations.test.ts EMAIL_NOT_VERIFIED)*
13. [ ] Verify B's email, tap "אימתתי". The invitation from A appears. Accept it.
14. [ ] B sees the same dashboard, categories, budgets and transactions as A.
15. [ ] B adds an expense. The transaction list shows who created each entry.
16. [ ] B cannot add categories or edit budgets (read-only notice), and cannot edit A's transactions.
        *(catalog/budgets/transactions tests: MEMBER 403)*
17. [ ] On A's device, pull to refresh (or switch tabs). B's expense appears and the totals include it.

## User C — outsider (security)

18. [ ] Register C and create a separate household. C sees none of A's data.
19. [ ] With C's ID token (for example from a debug session), call the API directly with A's record ids and a
        `householdId` parameter. Every call fails (404 for A's ids, 400 for a smuggled `householdId`).
        *(isolation.test.ts covers every endpoint)*
20. [ ] Without any token, every `/api/*` endpoint returns 401. *(auth.test.ts)*

## Months

21. [ ] Add a transaction dated in September. It does not appear in October's dashboard or list.
22. [ ] Set a different budget for September. Changing October's budget afterwards leaves September's unchanged.
        *(budgets.test.ts "changing October does not modify September", store.test.ts)*
23. [ ] Switching months with the arrows shows each month's own totals.

## Money

24. [ ] Amounts like 87.9, 87,90, 1,250 and 0.29 are accepted and displayed exactly; 1.234 and -5 are rejected.
        *(money.test.ts, transactionForm.test.ts, validators/transactions tests)*
25. [ ] In the database, `amountAgorot` values are integers (₪87.90 → 8790).

## APK

26. [ ] Install the APK on a real device, sign in, add a transaction, restart the app, and confirm the
        transaction is still there and present in the database.
