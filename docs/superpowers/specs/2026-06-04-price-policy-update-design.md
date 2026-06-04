# Price Policy Update — Feed Bag & Profit Margin

**Date:** 2026-06-04  
**Projects:** feed-reminder-up (API/web), poultry-solution (mobile)

## Context

The company updated its pricing policy:
- Feed bag price: 3220 → 3325 BDT
- Profit margin base (BASE_SELLING_PRICE): 141 → 145 BDT/kg
- DOC price (41.5 BDT/bird): **unchanged**

Both projects share mirrored constants. The web app also stores `feedPricePerBag` per organization in the database. Existing sale records must not be modified — they are immutable historical snapshots.

## Scope

### feed-reminder-up

| File | Change |
|------|--------|
| `constants.ts` (line 35) | `FEED_PRICE_PER_BAG`: 3220 → 3325 |
| `constants.ts` (line 37) | `BASE_SELLING_PRICE`: 141 → 145 |
| `db/schema.ts` | `feedPricePerBag` column default: `"3220"` → `"3325"` |
| new Drizzle migration | UPDATE existing org records where `feed_price_per_bag = '3220'` |

### poultry-solution

| File | Change |
|------|--------|
| `lib/profit-constants.ts` (line 2) | `FEED_PRICE_PER_BAG`: 3220 → 3325 |
| `lib/profit-constants.ts` (line 4) | `BASE_SELLING_PRICE`: 141 → 145 |

## Database Migration Strategy

- Target: `organization` table, column `feed_price_per_bag`
- Condition: `WHERE feed_price_per_bag = '3220'` — only updates orgs still on the old default; orgs with manually overridden prices are untouched
- Historical tables NOT touched: `saleMetrics` (`feedPriceUsed`, `docPriceUsed`, `recoveryPrice`) and `saleEvents` — these are audit records of what prices were used at time of sale

## What Does NOT Change

- `DOC_PRICE_PER_BIRD = 41.5` — unchanged in both projects
- Any existing `saleMetrics` rows — historical records, immutable
- Any existing `saleEvents` rows — historical records, immutable
- Organizations that have a custom `feedPricePerBag` (≠ 3220) — their override is intentional

## Verification

1. Check constants files in both projects reflect new values
2. Run `drizzle-kit generate` to produce migration SQL
3. Inspect migration SQL — confirm only `UPDATE organization SET feed_price_per_bag = '3325' WHERE feed_price_per_bag = '3220'`
4. Confirm no `UPDATE` targeting `saleMetrics` or `saleEvents`
5. Apply migration to DB (`drizzle-kit migrate` or push)
6. In the app: open a cycle's profit modal — defaults should show 3325 and 145
7. Verify past sale records in DB remain unchanged
