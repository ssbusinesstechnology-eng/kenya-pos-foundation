# Final QA and stabilisation — 5 November 2026

## Scope
The uploaded document ends at “Incorrect totals are”; only the available instructions were followed. Existing work was inspected without stateful Git operations; status/diff initially clean. No new product feature, checkout logic change, new role system, deployment or publication.

## Confirmed defects fixed
1. Receipt names with long unbroken words expanded a 302px preview paper to 1097px, overflowing both preview and printed paper. Shared fixed table columns, wrap-anywhere, numeric-column spacing and print row/totals break protection now keep the paper at 302px. The preview toolbar stacks on phones rather than compressing its title into a narrow column. Ordinary named receipt still fits one PDF page; 36-line stress receipt paginates without truncating content.
2. Authenticated self-profile updates could change business_id and role: an actual rollback-only UPDATE returned tenant_change_allowed=true and role_change_allowed=true. Migration 0002 revokes table/column UPDATE and grants only full_name, retaining existing RLS, existing profile role system and security-definer onboarding. Owner tenant/role changes, manager/cashier self-promotion are now refused. Full-name edit, profile bootstrap and business onboarding still work. Regression assertions saved in tenant_isolation.test.sql. No user security values were actually changed; diagnosis rolled back.

## Customer regression — PASS
- Blank name rejected; add with trimmed name and optional details; edit name/email; refresh persistence.
- Search by name, exact phone and email; exact duplicate-phone warning and Save anyway.
- Add name-only customer from POS, switch customer, remove back to Walk-in: quantity 2 and discount retained throughout.
- Checkout review/back preserves cart; review named customer and correct KES 240 minus 15 = 225.
- Named and NULL-customer Walk-in sales completed; no fake Walk-in customer created.
- Deactivate: customer unavailable in new POS lookup; old purchase still visible in customer detail and sales history. Reactivate works.
- Loading state observed during injected customer service failure; friendly error after retries; Try again restores rows.

## Checkout and records — PASS
- CASH named sale: quantity 2 at KES 120; subtotal 240, discount 15, tax 0, total/payment 225.
- MPESA walk-in: KES 120, manual reference QA-NOV5-MPESA; missing reference rejected.
- CARD walk-in: KES 120; no card credentials collected.
- OTHER walk-in: KES 120, reference QA-NOV5-BANK.
- KES 224.99 cash rejected for KES 225 total. Double-click created one cash sale only; repeated same request ID returned original sale with duplicate=true.
- Stored four sales/payments total KES 585; each payment matches its sale. Stock 50→48→47→46→45, four SALE movements with correct quantities/actor/references. Sales history and reports read back the four actual checkouts, revenue 585/count 4.
- Rollback-only database calls independently rejected inactive customer, spoofed unit price, insufficient stock and underpayment.

## Receipts — PASS for automated PDF workflow
- On-screen, preview and PDFs checked for named customer and three Walk-in payment methods.
- Business/name/contact/address, reference/date/Nairobi time/cashier, snapshot item/name/SKU/quantity/price/total, subtotal/discount/tax/payment/reference/customer/footer all present. PDFs contain no navigation or preview controls, no blank pages. Ordinary receipts one page.
- Preview tested at 551×555, 375×812, 768×1024 and 1280×1800. Long-name overflow reproduced then corrected. Stress receipt contains 35 long-name zero-price lines plus original item; totals/footer and all line endings survive both ordinary and 80mm-width PDFs.
- PHYSICAL PRINTING NOT VERIFIED. No physical printer available; native browser print dialog not exercised. PDF workflow is not physical printing.

## Security and app checks
- Updated owner/manager/cashier two-business SQL suite passed, including customers, receipt records, inventory, settings permissions and profile protection; all fixtures rolled back.
- Onboarding/bootstrap, name update, idempotent retry and report readback after profile-grant change passed.
- Report anonymous execute privileges false for both RPCs; authenticated allowed. Read-only SECURITY INVOKER paths retained.
- 18 Vitest tests passed: 14 reporting tests plus four exact monetary examples. Changed-file ESLint clean. Latest harness build OK.
- Signed-in dashboard/products/inventory/POS/customers/reports/settings loaded without page errors; signed-out reports redirected to auth; auth screen rendered at user's 551×555 size.
- All content routes inspected for leaf-specific head metadata; no missing metadata found.

## Limitations / results not claimed
- Whole-project lint is NOT clean: 613 existing formatting errors in managed generated files and 11 existing warnings. Managed generated files were not edited merely to format them. Changed-file lint passed.
- Full report fixture suite fresh rerun NOT COMPLETED: local database role cannot insert auth fixtures; a copied gateway run had a malformed fixture UUID and rolled back. Existing 14 unit tests, new tenant suite and real KES 585 report readback passed instead; no false full-suite pass claimed.
- Report Transactions intentionally remains an all-status ledger showing status columns; successful revenue remains completed paid sales. No filtering semantics changed without demonstrated requirement/defect.
- Duplicate-phone detection matches trimmed exact strings; equivalent Kenyan formats are not normalized. Cart is intentionally in-memory and not refresh/navigation-persistent. Neither limitation expanded into new features.
- Physical printer/native window, full signup/reset email delivery and complete dense-report UI pagination not exercised this pass.

## Cleanup
Removed only exact four temporary sale IDs/request IDs, their payments/items/audit entries, one QA product/its movements, three QA customer IDs and related audit entries. All security/onboarding fixtures rolled back. Final counts: sales 0/products 0/customers 0/payments 0/movements 0; counter restored to 0 only because no sales remain. Next real reference SALE-000001. No legitimate business records changed or deleted.

Morning briefing remains outside scope and unscheduled pending sender-domain setup and recipient/time/source confirmation. Stop after final stabilisation; no Phase 4.