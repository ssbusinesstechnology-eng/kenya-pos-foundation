# Roadmap

## Phase 2D final verification
- [ ] A1: Browser test receipt print preview (customer sale + walk-in), Print/Save PDF, verify PDF content, no app UI in print
- [ ] A2: Customer regression checks (create/edit, search, duplicate-phone warning, activate/deactivate, purchase history, add from POS w/o clearing cart, checkout with/without customer, inactive not selectable, edits don't break historical sales, history/details show customer)
- [ ] A3: Re-run tenant isolation tests if cheap
- [ ] A4: Cleanup test data; confirm no ZZTEST, next sale = SALE-000001
- [ ] A5: Phase 2D decision

## Phase 3 — Reports & Analytics
- [ ] B1: Reports page in sidebar + date/payment/product/category/customer/status filters (server-side)
- [ ] B2: Sales overview (revenue, count, avg, discounts, tax, payment-method breakdown; exclude voided)
- [ ] B3: Sales trends chart (real data, grouping by range, empty state)
- [ ] B4: Top products by qty and revenue + product detail w/ stock
- [ ] B5: Inventory report (counts, stock, cost/price, estimated value labeled)
- [ ] B6: Stock movement report (date/product filters)
- [ ] B7: Payment report (counts/amounts by method, distinct from revenue)
- [ ] B8: Customer report (totals, active/inactive, purchases in period, paginated table)
- [ ] B9: Works for non-inventory businesses
- [ ] B10: Dashboard summary (today/month sales, txn count, recent sales, low stock)
- [ ] B11: Accuracy/security/performance (RLS, aggregation, pagination, states, responsive)
- [ ] B12: Reports testing incl. KES 1000+2000+500=3500 controlled example, cleanup, SALE-000001 intact
- [ ] B13: Regression + typecheck/lint/build
- [ ] Final report (2D + Phase 3, PASS/FAIL/NOT VERIFIED per item)

STOP after Phase 3.
