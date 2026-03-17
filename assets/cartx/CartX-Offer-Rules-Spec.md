# CartX Offer Rules Specification

---

## What is an "Offer" in CartX?

An "Offer" is any rule that modifies the cart contents or shows promotional UI based on cart state. CartX supports 5 offer types:

1. **GWP (Gift With Purchase)** — Auto-add free gift variants at thresholds
2. **BOGO** — Collection-triggered offers (auto-add, bundle, or manual)
3. **Product Freebie** — Product-to-product freebie mapping
4. **Claim Gift** — Customer-chosen gift at threshold
5. **Coupon** — Discount code with eligibility messaging

---

## Offer Eligibility Rules

### Supported Trigger Conditions

| Trigger Type | Where Used | Field | Comparison |
|---|---|---|---|
| Price threshold | GWP, Claim Gift, Progress Bar, Coupons | `trigger_price` | `adjustedCartPrice >= trigger_price * 100` (JS, in cents) or `total_cart_price >= trigger_price` (Liquid, in currency) |
| Quantity threshold | GWP, Claim Gift, Progress Bar, Coupons | `triggered_quantity` / `trigger_product` / `trigger_quantity` | `adjustedCartQuantity >= triggered_quantity` |
| Collection match | BOGO | `trigger_collection` | Products from the trigger collection must be in cart |
| Collection + count | BOGO (count-based) | `trigger_collection` + `trigger_count` | Count of trigger collection products in cart >= trigger_count |
| Collection + price | BOGO (price-based) | `trigger_collection` + `trigger_price` | Sum of prices of trigger collection products >= trigger_price |
| Product/variant match | Product Freebie | `products` list | Any variant from the trigger list present in cart |
| Customer tag match | VIP segmentation | `customer.tags contains 'VIP'` | Determines which metaobject set to use (vip_gwp vs site_gwp) |
| Customer logged-in | Coupon segmentation | `customer` object | Determines which coupon list (signed_in vs regular) |

### Exclusions

| Exclusion | How Applied |
|---|---|
| Free gift items | Excluded from cart totals. Items where `final_line_price AND original_line_price` are in `free_gift_price` array (default: [0, 100] in cents) are treated as freebies. |
| Combo products | Items with `product_type == "Combos"` excluded from cart quantity and price calculations. |
| Gift cards | **Unknown / Needs confirmation** — No explicit gift card exclusion found in code. Recommend confirming whether gift cards should be excluded from threshold calculations. |

### Cart Total Calculation (Critical)

```javascript
// Liquid (sections/cartx-drawer.liquid):
total_cart_prod = cart.item_count - gift_product_total - total_combos
total_cart_price = (cart.total_price - gift_product_price - total_combos_price) / 100

// JS (cartx.js):
cartTotalProductWithoutFreebie = user_cart.item_count - totalFreeProduct - totalCombosQuantity
cartTotalPriceWithoutFreebie = user_cart.total_price - totalFreeProductPrice - totalCombosPrice
// Note: JS prices are in CENTS (Shopify default), Liquid divides by 100
```

A "freebie" in Liquid is defined as: `item.final_price in [0, 100] AND item.original_line_price in [0, 100]`

---

## Offer Outcomes

### 1. Auto-Add Free Product (GWP)

**When:** `getApplicableRule()` returns a rule with `get_y` variants

**What happens:**
- Each variant in `get_y` is set to `quantity: 1` in `cartUpdatedObject`
- Sent in the single `/cart/update.js` call
- On success, these appear as cart items with price 0 or 100 (₹1)

**Edge cases:**
- If variant is OOS (in `oosGiftVariants`) → skipped, tracked in `unavailableGiftVariants`
- If add fails (variant drafted/deleted) → caught in error handler, variant removed from retry payload, retried without it
- If variant was previously unavailable → retried after 60 seconds

### 2. Auto-Add BOGO Product

**When:** BOGO offer has `auto_add: true` AND exactly 1 `offer_product`

**What happens:**
- Offer variant set to `quantity: 1` in `cartUpdatedObject`
- Same OOS/unavailable handling as GWP

**Reverse offer:** If primary trigger not met but `adjustedCartPrice` meets `trigger_price`:
- `reverse_offer_product[0]` is auto-added instead

### 3. Manual Add (Bundle/Single)

**When:** BOGO with `bundle_products: true` or non-auto offers

**What happens:**
- UI rendered with "Add to Cart" or "Add Bundle to Cart" button
- User clicks → `cartx(variantObject, "ADD")` or `cartx(variantObject, "MULTI_ADD")`

### 4. Show UI Message

**Progress bar:** Shows top message with remaining amount/products
**Cart ribbon:** Shows promotional message with placeholders
**Coupon cards:** Show eligibility status with Apply/Remove buttons
**Locked gift:** Shows locked product image with unlock message

### 5. Coupon Apply/Remove

**Apply:** `POST /cart/update.js` with `{ discount: "CODE1,CODE2" }` (comma-separated list of all codes)
**Remove:** Same endpoint, with the target code removed from the list
**Verification:** After apply, fetches `/cart.js` and checks if code appears in discount allocations

---

## Priority Resolution

### GWP (Gift With Purchase)

**Rule:** Highest matching threshold wins.

```javascript
function getApplicableRule(filteredObjects, adjustedCartQuantity, adjustedCartPrice) {
  // 1. Filter: keep rules where threshold is met
  // 2. Sort descending by threshold value
  // 3. Return first (highest) match
}
```

**Example:**
- Rule A: `triggered_quantity: 2` → get_y: [Variant X]
- Rule B: `triggered_quantity: 5` → get_y: [Variant Y]
- Cart has 6 items → Rule B wins (highest matching)

**Important:** Only ONE rule applies. The gifts from lower tiers are NOT additive.

### BOGO Offers

**Rule:** ALL matching BOGO offers are processed. No priority between them.

Each BOGO offer is independent. If two offers both have their triggers met, both fire.

### Product Freebies

**Rule:** ALL matching freebie rules are processed. If product A triggers freebie X, and product B triggers freebie Y, both are added.

### Claim Gift

**Rule:** Same as GWP — `getApplicableRule()` picks highest matching threshold.

### Coupons

**Rule:** All coupons are shown. Only one can be applied at a time (Shopify limitation for discount codes, though the code supports comma-separated stacking).

---

## Offer Evaluation Order (within cartx() function)

1. **Cart state snapshot** — Read current cart items, compute totals excluding freebies/combos
2. **Compute adjusted totals** — Add/subtract the incoming variant changes
3. **GWP evaluation** — `getApplicableRule(gift_manage, quantity, price)` → auto-add gifts
4. **Claim Gift evaluation** — `getApplicableRule(claim_gift, quantity, price)` → restore claimed gifts from localStorage
5. **Apply incoming changes** — Update `cartUpdatedObject` with the ADD/REMOVE from user action
6. **Product Freebie evaluation** — For each `cart_freebie`, check if trigger product is in `cartUpdatedObject`
7. **BOGO evaluation** — For each `bogo_offer` with `auto_add`, check triggers and add offer products
8. **Cleanup** — Remove unavailable variants that are no longer applicable
9. **Single API call** — `POST /cart/update.js` with full `cartUpdatedObject`
10. **Verify & retry** — If cart total doesn't match expected, retry up to 3 times

---

## Examples

### Example 1: GWP with quantity threshold

**Setup:**
- Gift rule: `triggered_quantity: 3`, `get_y: [Variant-A]`
- Gift rule: `triggered_quantity: 5`, `get_y: [Variant-B]`

**Scenario:** Customer has 4 items in cart
- Rule 1 matches (4 >= 3)
- Rule 2 does not match (4 < 5)
- → Variant-A auto-added to cart

**Scenario:** Customer adds 2 more items (now 6)
- Rule 1 matches (6 >= 3)
- Rule 2 matches (6 >= 5)
- Highest wins → Variant-B auto-added
- Variant-A removed (not in current rule's get_y)

### Example 2: BOGO with collection trigger

**Setup:**
- BOGO: `auto_add: true`, `trigger_collection: "Skincare"`, `trigger_count: 2`, `offer_products: [Variant-X]`

**Scenario:** Customer adds 2 skincare products
- Trigger collection has 2 products in cart → trigger met
- Variant-X auto-added to cart
- If Variant-X is OOS → tracked, sticky message shown

### Example 3: Coupon eligibility

**Setup:**
- Coupon: `code: "SAVE20"`, `trigger_price: 999`
- Cart total: ₹750

**What shows:** "Add ₹249 more to unlock this coupon" (Apply button hidden)

**Cart total reaches ₹1000:** "Apply now to save 20%!" (Apply button visible)

### Example 4: Product freebie

**Setup:**
- cart_freebie: `products: [Variant-P]`, `freebie: [Variant-F]`

**Scenario:** Customer adds product with Variant-P
- Freebie rule matches → Variant-F auto-added with qty 1
- Customer removes Variant-P → Variant-F removed (qty set to 0)
