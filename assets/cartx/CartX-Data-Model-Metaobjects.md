# CartX Data Model — Metaobjects

> **This is the most important document.** Every metaobject, its fields, types, and how they're used.

---

## Metaobject Definitions

CartX uses **3 top-level metaobject definitions** and **5 child metaobject definitions** (referenced as lists from the top-level).

### Naming Conventions

| Metaobject Definition | Handle | Purpose |
|---|---|---|
| `site_gwp` | `shop.metaobjects.site_gwp` | GWP rules for non-VIP customers |
| `vip_gwp` | `shop.metaobjects.vip_gwp` | GWP rules for VIP customers |
| `cart_freebie` | `shop.metaobjects.cart_freebie` | Product-level freebie rules |

The child metaobjects (referenced from `site_gwp`/`vip_gwp`) are:

| Child Metaobject | Referenced From | Purpose |
|---|---|---|
| Gift Manage rules | `site_gwp.gift_manage` / `vip_gwp.gift_manage` | Threshold-based auto-gift rules |
| Claim Gift rules | `site_gwp.claim_gift` / `vip_gwp.claim_gift` | Customer-selectable gifts |
| Cart Progressbar stages | `site_gwp.cart_progressbar` / `vip_gwp.cart_progressbar` | Progress bar stage definitions |
| BOGO Offers | `site_gwp.bogo_offers` / `vip_gwp.bogo_offers` | BOGO/collection-based offers |
| Coupon definitions | `site_gwp.signed_in_customer_coupons` / `site_gwp.regular_customer_coupouns` | Coupon cards shown in drawer |

---

## 1. Metaobject: `site_gwp` / `vip_gwp`

**Purpose:** Top-level container for all cart drawer offer configuration. One entry per page (or `/` as default fallback).

**Where queried:**
- `layout/theme.liquid` lines 97-136 (Liquid `shop.metaobjects.site_gwp.values` / `shop.metaobjects.vip_gwp.values`)
- `sections/cartx-drawer.liquid` lines 35-80 (same query, duplicated)

**Where consumed:**
- Serialized to `<body>` attributes: `final_matched_object`, `metaobject`, `cartfreebie`, `claimgift`, `bogooffers`
- Passed to snippets: `cartx-drawer`, `cartx-progressbar`, `cartx-claim-gift`, `cartx-gift-details`, `cartx-offer`, `cartx-cart-ribbon`

**Pagination:** `paginate by 250` (max 250 entries)

### Fields

| Field Key | Type | Required? | Example Value | How It's Used |
|---|---|---|---|---|
| `page_handle` | Single-line text | Y | `"/"` or `"/collections/skincare, /products/serum"` | Comma-separated URL paths. Matched against `request.path`. Entry with `/` is the global fallback. |
| `is_price_based` | Boolean | Y | `true` | When true, gift/claim triggers use price thresholds. When false, uses quantity thresholds. |
| `number_of_offers` | Number (integer) | N | `3` | Number of progress bar tiers. Used to calculate segment widths. |
| `disable_progress_bar` | Boolean | N | `false` | If true, progress bar is hidden entirely. |
| `progressbar_is_price_based` | Boolean | N | `true` | Separate price/qty toggle for progress bar (can differ from `is_price_based`). |
| `code` | Single-line text | N | `"QUENCH20"` | Discount code associated with this offer set. Used in ribbon messages via `[[CODE]]`. |
| `final_message` | Rich text | N | `"<p>You unlocked all rewards!</p>"` | Shown in cart ribbon when all gift stages are achieved. Rendered via `\| metafield_tag`. |
| `top_message_after_stage_achieved` | Rich text | N | `"<p>All rewards unlocked!</p>"` | Shown above progress bar when all stages met. Rendered via `\| metafield_tag`. |
| `gift_manage` | List of metaobject references | N | (see below) | Tiered gift rules — each entry defines a threshold + gift variants. |
| `claim_gift` | List of metaobject references | N | (see below) | Customer-choosable gift rules. |
| `cart_progressbar` | List of metaobject references | N | (see below) | Progress bar stage definitions. |
| `bogo_offers` | List of metaobject references | N | (see below) | BOGO/collection-triggered offers. |
| `signed_in_customer_coupons` | List of metaobject references | N | (see below) | Coupons shown to logged-in customers. |
| `regular_customer_coupouns` | List of metaobject references | N | (see below) | Coupons shown to guest customers. **Note:** Typo in field key is intentional — matches existing data. |

### Relationships

- References 5 child metaobject types (see below)
- Queried from Liquid only (not via JS API)
- Data passed to JS via `<body>` attributes as serialized JSON

### Admin Path

`Settings > Custom data > Metaobjects > site_gwp` (or `vip_gwp`)

---

## 2. Child Metaobject: Gift Manage Rules

**Purpose:** Define tiered thresholds for auto-adding gift variants to cart.

**Referenced from:** `site_gwp.gift_manage` / `vip_gwp.gift_manage`

**Where consumed:**
- Body attribute: `metaobject` → parsed by `cartx.js` → `getApplicableRule()`
- Liquid: `snippets/cartx-gift-details.liquid`, `snippets/cartx-cart-ribbon.liquid`

### Fields

| Field Key | Type | Required? | Example Value | How It's Used |
|---|---|---|---|---|
| `triggered_quantity` | Number (integer) | Conditional | `3` | Quantity threshold. Used when parent `is_price_based = false`. |
| `trigger_price` | Number (integer) | Conditional | `1500` | Price threshold (in store currency, NOT cents). Used when `is_price_based = true`. JS compares `adjustedCartPrice >= trigger_price * 100`. |
| `get_y` | List of variant references | N | `["gid://shopify/ProductVariant/12345"]` | Variant GIDs to auto-add as free gifts when threshold met. |
| `gift_locked_product` | Product reference | N | (Product object) | Product shown as "locked" preview before threshold is reached. |
| `gift_locked_message` | Single-line text | N | `"Add [[PRODUCT]] more to get [[TITLE]] FREE!"` | Message shown with locked gift. Supports placeholders: `[[PRICE]]`, `[[PRODUCT]]`, `[[TITLE]]`. |
| `ribbon_before_message` | Rich text | N | `"<p>Add ₹[[PRICE]] more to get [[TITLE]] FREE! Use code [[CODE]]</p>"` | Cart ribbon message before threshold. Supports: `[[PRICE]]`, `[[PRODUCT]]`, `[[CODE]]`, `[[TITLE]]`. Rendered via `\| metafield_tag`. |
| `code_copy` | Single-line text | N | `"Use code [[CODE]]"` | Optional copy-to-clipboard text shown in ribbon. `[[CODE]]` replaced with parent's `code` value. |

### Logic

```
Rules are sorted descending by threshold.
The HIGHEST matching rule wins (getApplicableRule in JS).
For each variant in get_y of the winning rule:
  - If variant NOT in oosGiftVariants AND NOT in unavailableGiftVariants → set quantity to 1
  - If variant in oosGiftVariants → add to unavailableGiftVariants, skip
  - If variant in unavailableGiftVariants AND retry interval passed → retry add
```

---

## 3. Child Metaobject: Claim Gift Rules

**Purpose:** Define threshold for showing a gift picker UI where customer can choose a gift.

**Referenced from:** `site_gwp.claim_gift` / `vip_gwp.claim_gift`

**Where consumed:**
- Body attribute: `claimgift` → parsed by `cartx.js`
- Liquid: `snippets/cartx-claim-gift.liquid`

### Fields

| Field Key | Type | Required? | Example Value | How It's Used |
|---|---|---|---|---|
| `trigger_price` | Number (integer) | Conditional | `1500` | Price threshold. Used when parent `is_price_based = true`. |
| `triggered_quantity` | Number (integer) | Conditional | `3` | Quantity threshold. Used when parent `is_price_based = false`. |
| `gift_products` | List of variant references | Y | `["gid://shopify/ProductVariant/111", "gid://shopify/ProductVariant/222"]` | Variants the customer can choose from. Each shown as a card with Add/Remove button. |

### Logic

```
If threshold met → show claim gift section
Customer clicks "Add to Cart" on a gift → added with properties.claimed_gift = "true"
Claimed selection persisted in localStorage("claimedGiftProducts")
On cart update, claimed gifts are re-added if threshold still met
If threshold no longer met → localStorage cleared, gift removed
```

---

## 4. Child Metaobject: Cart Progressbar Stages

**Purpose:** Define individual stages of the progress bar with messages and icons.

**Referenced from:** `site_gwp.cart_progressbar` / `vip_gwp.cart_progressbar`

**Where consumed:** Liquid only: `snippets/cartx-progressbar.liquid`

### Fields

| Field Key | Type | Required? | Example Value | How It's Used |
|---|---|---|---|---|
| `trigger_price` | Number (integer) | Conditional | `999` | Price threshold for this stage. Used when `progressbar_is_price_based = true`. |
| `trigger_product` | Number (integer) | Conditional | `3` | Quantity threshold for this stage. Used when `progressbar_is_price_based = false`. |
| `top_message_for_stage` | Rich text | N | `"<p>Add ₹<strong>[[PRICE]]</strong> more for free shipping!</p>"` | Message above progress bar for this stage. Supports `[[PRICE]]` and `[[PRODUCT]]`. Rendered via `\| metafield_tag`. |
| `message_for_stage` | Rich text | N | `"<p>Free Shipping</p>"` | Label below the stage icon. |
| `sub_message_for_stage` | Rich text | N | `"<p>On orders above ₹999</p>"` | Sub-label below stage icon. |
| `upload_svg_icon` | File reference | N | (SVG file) | Custom icon for this stage. Falls back to default checkmark SVG. Rendered via `\| file_url`. |

### Logic

```
Stages are iterated in order.
For price-based:
  - Completed stages (cart_price >= trigger_price) → filled segment + active class
  - Current stage → partial fill based on (cart_price / trigger_price * segment_width)
  - Future stages → empty
For quantity-based: same logic with cart_quantity vs trigger_product
First inactive stage gets .glowing-effect CSS class (pulsing animation)
Active stages show green checkmark overlay
```

---

## 5. Child Metaobject: BOGO Offers

**Purpose:** Collection-based buy-X-get-Y offers with optional auto-add and bundle mode.

**Referenced from:** `site_gwp.bogo_offers` / `vip_gwp.bogo_offers`

**Where consumed:**
- Body attribute: `bogooffers` (custom JSON serialized in `theme.liquid`)
- Liquid: `snippets/cartx-bogo-offer.liquid`
- JS: `cartx.js` lines 1041-1268

### Fields

| Field Key | Type | Required? | Example Value | How It's Used |
|---|---|---|---|---|
| `auto_add` | Boolean | N | `true` | If true, JS auto-adds the offer product when trigger met (only if 1 offer variant). |
| `is_price_base` | Boolean | N | `false` | If true, trigger is based on total price of trigger collection products. |
| `trigger_count` | Number (integer) | Conditional | `2` | Number of trigger collection products needed in cart. Used when `is_price_base = false`. |
| `trigger_price` | Number (integer) | Conditional | `999` | Total price threshold of trigger collection products. Used when `is_price_base = true`. |
| `trigger_collection` | Collection reference | Y | (Collection object) | The collection whose products act as triggers. Liquid extracts `collection.id` for JS. |
| `offer_products` | List of product references | Y | (Product objects) | Products offered when trigger is met. JS uses `product.variants.first.id`. |
| `reverse_offer_product` | List of product references | N | (Product objects) | Alternative products offered when cart total meets price but trigger collection doesn't. |
| `bundle_products` | Boolean | N | `true` | If true AND multiple offer products → show as bundle with "Add Bundle to Cart" button. |
| `offer_heading` | Single-line text | N | `"Add [[PRODUCT]] more products to get this offer!"` | Heading text. `[[PRODUCT]]` replaced with remaining count. |
| `min_offer_quantity` | Number (integer) | N | `1` | Minimum offer products that must NOT be in cart for the offer to show. Default 1. |

### Serialization (theme.liquid)

The `bogooffers` body attribute is hand-crafted JSON (not `| json`):
```json
[{
  "auto_add": true,
  "is_price_base": false,
  "trigger_count": 2,
  "trigger_price": null,
  "trigger_collection": "COLLECTION_ID",
  "offer_products": ["VARIANT_ID_1"],
  "offer_products_unavailable": false,
  "reverse_offer_product": ["VARIANT_ID_2"],
  "reverse_offer_product_unavailable": false
}]
```

### Logic (JS)

```
For each offer with auto_add = true:
  1. Get trigger_collection products in cart (by matching collection IDs on DOM elements)
  2. If is_price_base: sum prices of trigger products; else: count quantities
  3. If trigger met AND offer has exactly 1 variant:
     - If available → set cartUpdatedObject[offerVid] = 1
     - If OOS → track in unavailableGiftVariants
     - If drafted → set hasBogoOfferDrafted = true
  4. If primary trigger NOT met but reverse trigger met:
     - Same logic for reverse_offer_product
```

### Liquid Logic (snippets/cartx-bogo-offer.liquid)

```
For each bogo_offer:
  Count trigger products in cart (by matching product IDs against trigger collection)
  If trigger_matched >= trigger_count AND min_offer_quantity > offer_matched:
    If bundle_products AND multiple offer products → show bundle UI
    Else → show individual product cards with ATC buttons
```

---

## 6. Child Metaobject: Coupon Definitions

**Purpose:** Define coupon cards shown in the coupon drawer with eligibility rules and messages.

**Referenced from:**
- `site_gwp.signed_in_customer_coupons` (for logged-in customers)
- `site_gwp.regular_customer_coupouns` (for guest customers)

**Where consumed:** Liquid: `snippets/cartx-offer.liquid`

### Fields

| Field Key | Type | Required? | Example Value | How It's Used |
|---|---|---|---|---|
| `coupon_code` | Single-line text | Y | `"QUENCH20"` | The actual Shopify discount code. |
| `coupon_type_title` | Single-line text | N | `"20% OFF"` | Label shown on left side of coupon card. |
| `coupon_title` | Single-line text | N | `"Get 20% off on orders above ₹999"` | Main title of coupon card. |
| `coupon_description` | Single-line text | N | `"Add [[PRODUCT]] more products to unlock"` | Message when quantity threshold not met. `[[PRODUCT]]` = remaining count. |
| `coupon_before_message` | Single-line text | N | `"Add ₹[[PRICE]] more to unlock this coupon"` | Message when price threshold not met. `[[PRICE]]` = remaining amount. |
| `coupon_after_message` | Single-line text | N | `"Apply now to save 20%!"` | Message when threshold IS met (coupon applicable). |
| `coupon_success_message` | Single-line text | N | `"You saved 20% on this order!"` | Shown when coupon is already applied. |
| `final_message` | Single-line text | N | `"Flat 20% off"` | Fallback message if no specific message applies. |
| `trigger_quantity` | Number (integer) | N | `3` | Min products needed for coupon to be applicable. |
| `trigger_price` | Number (integer) | N | `999` | Min cart price (in store currency, NOT cents) for coupon applicability. |

### Logic

```
1. Determine which coupon list to use (signed_in vs regular based on customer object)
2. Build list of currently applied discount codes from cart
3. For each coupon:
   a. If already applied → show "Applied" state with Remove button
   b. If not applied:
      - Check trigger_quantity: if cart quantity < threshold → show description with remaining count, hide Apply button
      - Check trigger_price: if cart price < threshold → show before_message with remaining amount, hide Apply button
      - If thresholds met → show after_message with Apply button
```

---

## 7. Top-Level Metaobject: `cart_freebie`

**Purpose:** Product-to-product freebie mapping. When a trigger product is in cart, its freebie is auto-added.

**Where queried:** `layout/theme.liquid` line 190 — `shop.metaobjects.cart_freebie.values`

**Where consumed:**
- Body attribute: `cartfreebie` (JSON)
- JS: `cartx.js` — `cleanData()` normalizes GIDs, freebie logic (lines 996-1028)
- Liquid: `layout/theme.liquid` lines 173-184 (OOS check for freebie variants)

### Fields

| Field Key | Type | Required? | Example Value | How It's Used |
|---|---|---|---|---|
| `freebie` | List of variant references | Y | `["gid://shopify/ProductVariant/44444"]` | Freebie variant(s) to auto-add. Only first variant (`freebie[0]`) is used. |
| `products` | List of variant references | Y | `["gid://shopify/ProductVariant/55555", "gid://shopify/ProductVariant/66666"]` | Trigger product variants. If ANY of these are in cart → freebie is added. |

### Logic

```
For each cart_freebie entry:
  For each trigger product in entry.products:
    If that product is in cartUpdatedObject with qty > 0:
      Auto-add freebie[0] with quantity 1
      (Same OOS/unavailable tracking as GWP gifts)
```

### Admin Path

`Settings > Custom data > Metaobjects > cart_freebie`

---

## Summary: Complete Metaobject Hierarchy

```
shop.metaobjects.site_gwp (or vip_gwp)
├── page_handle, is_price_based, code, number_of_offers, ...
├── gift_manage[] ─────────── Tiered auto-gift rules
│   ├── triggered_quantity / trigger_price
│   ├── get_y[] (variant refs)
│   ├── gift_locked_product, gift_locked_message
│   └── ribbon_before_message, code_copy
├── claim_gift[] ──────────── Customer-choosable gifts
│   ├── trigger_price / triggered_quantity
│   └── gift_products[] (variant refs)
├── cart_progressbar[] ────── Progress bar stages
│   ├── trigger_price / trigger_product
│   ├── top_message_for_stage, message_for_stage, sub_message_for_stage
│   └── upload_svg_icon
├── bogo_offers[] ─────────── Collection-based BOGO
│   ├── auto_add, is_price_base, trigger_count, trigger_price
│   ├── trigger_collection (collection ref)
│   ├── offer_products[] (product refs)
│   ├── reverse_offer_product[] (product refs)
│   ├── bundle_products, offer_heading, min_offer_quantity
├── signed_in_customer_coupons[] ── Coupons for logged-in
│   ├── coupon_code, coupon_type_title, coupon_title
│   ├── coupon_description, coupon_before_message, coupon_after_message
│   ├── coupon_success_message, final_message
│   └── trigger_quantity, trigger_price
└── regular_customer_coupouns[] ─── Coupons for guests
    └── (same fields as above)

shop.metaobjects.cart_freebie
├── freebie[] (variant refs)
└── products[] (variant refs — triggers)
```

---

## Unknown / Needs Confirmation

| Item | What's Unclear | How to Confirm |
|---|---|---|
| Exact metaobject definition names for child objects | The child metaobjects (gift_manage rules, progressbar stages, etc.) are accessed via field references. Their actual definition names in admin are not visible from code alone. | Check `Settings > Custom data > Metaobjects` in Shopify admin |
| Whether `trigger_price` in gift_manage is in whole currency or cents | JS compares `adjustedCartPrice >= trigger_price * 100`, suggesting it's in whole currency (e.g., 1500 = ₹1500). Liquid uses it directly vs `total_cart_price` which is `cart.total_price / 100`. | Confirm by checking a sample metaobject entry value in admin |
| The `regular_customer_coupouns` typo | The field key appears to have a typo ("coupouns" vs "coupons"). This is the actual key used in code. | Confirm this is the actual metaobject field key in admin — do NOT "fix" it |
| Whether `gift_products` in claim_gift are variant refs or product refs | Code uses `item.id` and `item.product.title`, suggesting variant references (variant has `.product`). | Check metafield definition type in admin |
