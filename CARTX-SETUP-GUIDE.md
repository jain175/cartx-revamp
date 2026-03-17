# CartX 2.0 — Metaobject Setup Guide

This guide walks you through creating every metaobject definition, entry, and setting needed to see CartX working in your Shopify store. Follow the steps in order.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create Metaobject Definitions](#2-create-metaobject-definitions)
3. [Create Metaobject Entries](#3-create-metaobject-entries)
4. [Add the CartX Drawer Section](#4-add-the-cartx-drawer-section)
5. [Configure Section Settings](#5-configure-section-settings)
6. [Test It](#6-test-it)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

- Your theme must be deployed to Shopify (push via `shopify theme push` or the GitHub integration)
- You need a few products in your store with prices set
- For GWP gifts: create a product with price **₹1** (or ₹0) — this is your "free gift" product. Shopify requires a minimum ₹1 price, and CartX detects items with price ₹0 or ₹1 as free gifts.
- For BOGO: you need at least one Collection with products assigned to it

---

## 2. Create Metaobject Definitions

Go to **Settings → Custom data → Metaobjects** in your Shopify Admin.

### 2A. `cart_progressbar` (Progress Bar Stage)

This defines a single stage/tier in the progress bar.

1. Click **Add definition**
2. Name: `cart_progressbar`
3. Add these fields:

| Field Name | Type | Notes |
|---|---|---|
| `trigger_price` | **Decimal** | Price threshold in whole currency (e.g. `500` = ₹500). Used when progress bar is price-based. |
| `trigger_product` | **Integer** | Quantity threshold (e.g. `3` = 3 products). Used when progress bar is quantity-based. |
| `top_message_for_stage` | **Multi-line text** | Message shown above progress bar when this is the NEXT stage. Supports `[[PRICE]]` and `[[PRODUCT]]` placeholders. Example: `Add [[PRICE]] more to unlock free shipping!` |
| `message_for_stage` | **Single line text** | Short label shown below the stage icon. Example: `Free Shipping` |
| `sub_message_for_stage` | **Single line text** | Optional sub-label below the main label. Example: `Above ₹500` |
| `upload_svg_icon` | **Multi-line text** | Optional custom SVG markup for the stage icon. Leave blank for default gift icon. |

4. Click **Save**

---

### 2B. `gift_manage` (GWP Gift Rule)

This defines a tiered gift-with-purchase rule. The highest matching threshold wins.

1. Click **Add definition**
2. Name: `gift_manage`
3. Add these fields:

| Field Name | Type | Notes |
|---|---|---|
| `trigger_price` | **Decimal** | Price threshold in whole currency (e.g. `1500` = ₹1500) |
| `triggered_quantity` | **Integer** | Quantity threshold (e.g. `3` = buy 3 items) |
| `get_y` | **List of Product Variants** (metaobject reference or variant refs) | The gift variant(s) to auto-add when threshold met. These should be products priced at ₹0 or ₹1. |
| `gift_locked_product` | **Product reference** | Product shown as a locked preview BEFORE threshold is met |
| `gift_locked_message` | **Multi-line text** | Message on the locked preview. Supports: `[[PRICE]]` (remaining amount), `[[PRODUCT]]` (remaining quantity), `[[TITLE]]` (product title). Example: `Add ₹[[PRICE]] more to unlock your FREE [[TITLE]]!` |
| `ribbon_before_message` | **Multi-line text** | Cart ribbon message before this tier is met. Same placeholders as above. |
| `code_copy` | **Single line text** | Optional discount code text for copy-to-clipboard in ribbon. |

4. Click **Save**

---

### 2C. `claim_gift` (Claim-a-Gift Rule)

Allows the customer to CHOOSE their gift from a list at a threshold.

1. Click **Add definition**
2. Name: `claim_gift`
3. Add these fields:

| Field Name | Type | Notes |
|---|---|---|
| `trigger_price` | **Decimal** | Price threshold |
| `triggered_quantity` | **Integer** | Quantity threshold |
| `gift_products` | **List of Product references** | Products the customer can choose from as their gift |

4. Click **Save**

---

### 2D. `bogo_offers` (BOGO Offer)

Collection-triggered buy-X-get-Y offers.

1. Click **Add definition**
2. Name: `bogo_offers`
3. Add these fields:

| Field Name | Type | Notes |
|---|---|---|
| `auto_add` | **True/False** | If true AND only 1 offer variant, auto-add to cart |
| `is_price_base` | **True/False** | If true, trigger is based on collection product total price |
| `trigger_count` | **Integer** | Number of products from trigger collection needed (count-based trigger) |
| `trigger_price` | **Decimal** | Total price of trigger collection products needed (price-based trigger) |
| `trigger_collection` | **Collection reference** | The collection that triggers this offer |
| `offer_products` | **List of Product references** | Products offered when trigger is met |
| `reverse_offer_product` | **List of Product references** | Alternative products when primary trigger doesn't match |
| `bundle_products` | **True/False** | If true and multiple offer products, show "Add Bundle" button |
| `offer_heading` | **Single line text** | Heading. `[[PRODUCT]]` = remaining count. Example: `Buy [[PRODUCT]] more to unlock!` |
| `min_offer_quantity` | **Integer** | Minimum offer products NOT in cart for offer to show. Default: 1 |

4. Click **Save**

---

### 2E. Coupon definitions

You need TWO metaobject definitions for coupons — one for logged-in customers and one for guests.

#### `signed_in_customer_coupons`

1. Click **Add definition**
2. Name: `signed_in_customer_coupons`
3. Add these fields:

| Field Name | Type | Notes |
|---|---|---|
| `coupon_code` | **Single line text** | The actual Shopify discount code (must exist in Discounts) |
| `coupon_type_title` | **Single line text** | Left badge label, e.g. `20% OFF` |
| `coupon_title` | **Single line text** | Main title, e.g. `Flat 20% Off on Skincare` |
| `coupon_description` | **Multi-line text** | Shown when quantity threshold not met. `[[PRODUCT]]` = remaining qty. |
| `coupon_before_message` | **Multi-line text** | Shown when price threshold not met. `[[PRICE]]` = remaining amount. |
| `coupon_after_message` | **Multi-line text** | Shown when threshold IS met (ready to apply). |
| `coupon_success_message` | **Multi-line text** | Shown after coupon is applied. |
| `trigger_quantity` | **Integer** | Min quantity to be eligible |
| `trigger_price` | **Decimal** | Min price to be eligible (whole currency) |

4. Click **Save**

#### `regular_customer_coupouns`

> Note: The typo in `coupouns` is intentional — it matches the original metaobject field name. Keep it exactly like this.

1. Repeat the exact same definition as above but named `regular_customer_coupouns`
2. Same fields, same types
3. Click **Save**

---

### 2F. `cart_freebie` (Product-Level Freebie)

Maps trigger products to auto-added freebie products.

1. Click **Add definition**
2. Name: `cart_freebie`
3. Add these fields:

| Field Name | Type | Notes |
|---|---|---|
| `products` | **List of Product Variants** | Trigger variant IDs — if ANY of these are in cart, the freebie is added |
| `freebie` | **List of Product Variants** | Freebie variant(s) — only the FIRST one (`freebie[0]`) is used |

4. Click **Save**

---

### 2G. `site_gwp` (Main Offer Container — Non-VIP)

This is the top-level container that ties everything together per page.

1. Click **Add definition**
2. Name: `site_gwp`
3. Add these fields:

| Field Name | Type | Notes |
|---|---|---|
| `page_handle` | **Single line text** | Comma-separated URL paths. `"/"` is the global fallback. Example: `/,/collections/skincare,/products/moisturizer` |
| `is_price_based` | **True/False** | If true, all triggers use price; if false, use quantity |
| `number_of_offers` | **Integer** | Count of GWP tiers |
| `disable_progress_bar` | **True/False** | Hide progress bar entirely |
| `progressbar_is_price_based` | **True/False** | Separate toggle for progress bar (can differ from `is_price_based`) |
| `code` | **Single line text** | Discount code associated with this offer set. Used in `[[CODE]]` placeholder. |
| `final_message` | **Multi-line text** | Shown in cart ribbon when ALL gift stages are achieved |
| `top_message_after_stage_achieved` | **Multi-line text** | Shown above progress bar when ALL stages met |
| `gift_manage` | **List of `gift_manage` references** | GWP tier rules |
| `claim_gift` | **List of `claim_gift` references** | Claim-a-gift rules |
| `cart_progressbar` | **List of `cart_progressbar` references** | Progress bar stages |
| `bogo_offers` | **List of `bogo_offers` references** | BOGO offer rules |
| `signed_in_customer_coupons` | **List of `signed_in_customer_coupons` references** | Coupons for logged-in users |
| `regular_customer_coupouns` | **List of `regular_customer_coupouns` references** | Coupons for guests |

4. Click **Save**

---

### 2H. `vip_gwp` (VIP Offer Container — Optional)

Only needed if you have VIP customers (tagged with `VIP` in Shopify).

1. Create the **exact same definition** as `site_gwp` above, but named `vip_gwp`
2. Same fields, same types
3. Click **Save**

---

## 3. Create Metaobject Entries

Now create actual entries (data) for each definition. We'll build a minimal working example.

### Step 1: Create Progress Bar Stages

Go to **Content → Metaobjects → cart_progressbar** and create 3 entries:

**Entry 1 — Free Shipping Stage:**
| Field | Value |
|---|---|
| `trigger_price` | `500` |
| `trigger_product` | `2` |
| `top_message_for_stage` | `Add ₹[[PRICE]] more for FREE shipping!` |
| `message_for_stage` | `Free Shipping` |
| `sub_message_for_stage` | `Above ₹500` |

**Entry 2 — Free Gift Stage:**
| Field | Value |
|---|---|
| `trigger_price` | `1000` |
| `trigger_product` | `3` |
| `top_message_for_stage` | `Add ₹[[PRICE]] more to get a FREE gift!` |
| `message_for_stage` | `Free Gift` |
| `sub_message_for_stage` | `Above ₹1000` |

**Entry 3 — VIP Discount Stage:**
| Field | Value |
|---|---|
| `trigger_price` | `2000` |
| `trigger_product` | `5` |
| `top_message_for_stage` | `Add ₹[[PRICE]] more for 20% OFF!` |
| `message_for_stage` | `20% OFF` |
| `sub_message_for_stage` | `Above ₹2000` |

---

### Step 2: Create a Gift Rule

Go to **Content → Metaobjects → gift_manage** and create 1 entry:

| Field | Value |
|---|---|
| `trigger_price` | `1000` |
| `triggered_quantity` | `3` |
| `get_y` | Select the ₹1 "free gift" product variant you created |
| `gift_locked_product` | Select the same product |
| `gift_locked_message` | `Add ₹[[PRICE]] more to unlock your FREE [[TITLE]]!` |
| `ribbon_before_message` | `You're ₹[[PRICE]] away from a free gift!` |

---

### Step 3: Create a Coupon (Optional)

First, go to **Discounts** and create a discount code (e.g. `WELCOME10` for 10% off).

Then go to **Content → Metaobjects → regular_customer_coupouns** and create 1 entry:

| Field | Value |
|---|---|
| `coupon_code` | `WELCOME10` |
| `coupon_type_title` | `10% OFF` |
| `coupon_title` | `Welcome Discount` |
| `coupon_description` | `Add [[PRODUCT]] more items to unlock this coupon` |
| `coupon_before_message` | `Add ₹[[PRICE]] more to unlock this coupon` |
| `coupon_after_message` | `You're eligible! Tap Apply to save 10%` |
| `coupon_success_message` | `Coupon applied! You're saving 10%` |
| `trigger_quantity` | `0` (no quantity requirement) |
| `trigger_price` | `500` |

---

### Step 4: Create a Cart Freebie (Optional)

Go to **Content → Metaobjects → cart_freebie** and create 1 entry:

| Field | Value |
|---|---|
| `products` | Select the variant(s) of a trigger product (e.g. your best-seller) |
| `freebie` | Select the variant of a ₹1 freebie product |

Now when someone adds that trigger product to cart, the freebie will auto-add.

---

### Step 5: Create the Main `site_gwp` Entry

Go to **Content → Metaobjects → site_gwp** and create 1 entry:

| Field | Value |
|---|---|
| `page_handle` | `/` (this makes it the global fallback, active on ALL pages) |
| `is_price_based` | `true` |
| `number_of_offers` | `1` |
| `disable_progress_bar` | `false` |
| `progressbar_is_price_based` | `true` |
| `code` | `WELCOME10` (or leave blank) |
| `final_message` | `You've unlocked all rewards! Use code [[CODE]] at checkout.` |
| `top_message_after_stage_achieved` | `Congratulations! All rewards unlocked!` |
| `gift_manage` | Select the gift_manage entry from Step 2 |
| `claim_gift` | Leave empty for now |
| `cart_progressbar` | Select all 3 cart_progressbar entries from Step 1 (in order) |
| `bogo_offers` | Leave empty for now |
| `signed_in_customer_coupons` | Leave empty for now |
| `regular_customer_coupouns` | Select the coupon entry from Step 3 (if created) |

---

## 4. Add the CartX Drawer Section

The `cartx-drawer` section needs to be added to your theme's section order.

**Option A — Via Theme Editor (Recommended):**
1. Go to **Online Store → Themes → Customize**
2. The CartX drawer section should appear automatically since it's included via `{%- section 'cartx-drawer' -%}` in `theme.liquid`
3. No additional action needed

**Option B — Verify in Code:**
The integration is already done in `layout/theme.liquid`. The relevant lines are:
```liquid
{%- render 'cartx-data-bridge' -%}
{%- section 'cartx-drawer' -%}
```

---

## 5. Configure Section Settings

Go to **Online Store → Themes → Customize** and click on the **CartX Drawer** section in the sidebar.

### Theme Preset
- **Normal** — Clean, neutral colors (default)
- **Sale** — Red-accent sale theme
- **Festive** — Golden festive theme

### Announcement Ribbon
- Enable/disable the rotating announcements at the top of the drawer
- Add up to 3 announcement texts with optional URLs
- Set rotation speed (2-10 seconds)

### Empty Cart
- Upload a custom image for the empty cart state

### Upsells
- **Product-based upsells**: Toggle on and select specific products
- **AI upsells**: Leave the toggle off (AI mode is the default when toggle is off, but requires API configuration)

### Gift Unavailable
- Customize the message shown when a gift is out of stock

---

## 6. Test It

### Basic Flow Test

1. **Open your store** in a browser
2. **Add a product** to cart — the drawer should slide open from the right
3. **Check the progress bar** — it should show your stages with the first one glowing
4. **Add more products** to increase the cart total past your thresholds
5. **Watch the progress bar fill** and stages activate
6. **At ₹1000** (or your `trigger_price`), the free gift should auto-add to cart
7. **Open the coupon panel** by clicking "View All" in the coupon section
8. **Apply a coupon** — confetti should play on success

### Debug Mode

Open the browser console and type:
```js
CartX.debug = true;
```

This enables verbose logging. You'll see every event, module initialization, and pipeline step.

### Verification Checklist

| Test | Expected Result |
|---|---|
| Empty cart | Shows empty state with "Continue Shopping" link |
| Add 1 item | Drawer opens, item appears, progress bar shows |
| Quantity +/- | Item quantity updates, totals recalculate |
| Remove item | Item removed, gift re-evaluated |
| Gift threshold met | Free gift auto-added with "Free" tag |
| Gift threshold lost | Free gift auto-removed |
| Coupon apply | Confetti plays, coupon shows as applied |
| Coupon remove | Coupon removed, totals update |
| Visit `/cart` | Redirects to `/?open_cart=1`, drawer opens |
| Click cart icon | Drawer opens |
| Press Escape | Drawer closes |
| Click overlay | Drawer closes |
| `CartX.debug = true` | Console shows detailed logs |

---

## 7. Troubleshooting

### Drawer doesn't open
- Check browser console for JS errors
- Verify all 14 script tags are loading in `layout/theme.liquid`
- Make sure Dawn's original cart-drawer code is commented out

### No progress bar / no gifts
- Verify your `site_gwp` metaobject entry exists with `page_handle` set to `/`
- Check that `is_price_based` matches your threshold type
- In console: `CartX.debug = true` then add an item — look for `Event: cart:fetched`

### Gift not auto-adding
- Ensure the gift product variant is priced at ₹0 or ₹1
- Check that the variant ID in `get_y` is correct (must be the variant, not the product)
- Look for `offer:changed` event in debug logs

### Coupons not showing
- Make sure you created entries in the correct metaobject: `regular_customer_coupouns` for guest, `signed_in_customer_coupons` for logged-in
- Verify the discount code actually exists in Shopify Discounts
- Check that the `site_gwp` entry references your coupon entries

### "JSON.parse" errors (should NOT happen in v2.0)
- CartX 2.0 uses `safeJsonParse()` everywhere — these errors are eliminated
- If you see them, check that `cartx-util.helpers.js` is loading before `cartx-core.engine.js`

### Theme editor not showing CartX settings
- The section must be included via `{%- section 'cartx-drawer' -%}` in theme.liquid
- Look for "CartX Drawer" in the Theme Editor sidebar

---

## Quick Reference: Metaobject Creation Order

Create definitions in this order (dependencies flow downward):

```
1. cart_progressbar          (standalone)
2. gift_manage               (standalone)
3. claim_gift                (standalone)
4. bogo_offers               (standalone)
5. signed_in_customer_coupons (standalone)
6. regular_customer_coupouns  (standalone)
7. cart_freebie              (standalone)
8. site_gwp                  (references 1-6)
9. vip_gwp                   (references 1-6, optional)
```

Create entries in this order:

```
1. cart_progressbar entries  (your progress stages)
2. gift_manage entries       (your GWP tiers)
3. claim_gift entries        (optional)
4. bogo_offers entries       (optional)
5. coupon entries            (optional)
6. cart_freebie entries      (optional)
7. site_gwp entry            (ties everything together)
```

---

## Placeholder Reference

| Placeholder | Replaced With | Available In |
|---|---|---|
| `[[PRICE]]` | Remaining price to next threshold (₹) | Progress bar messages, gift locked message, ribbon, coupon messages |
| `[[PRODUCT]]` | Remaining product count | Progress bar messages, gift locked message, ribbon, coupon messages |
| `[[TITLE]]` | Product title | Gift locked message |
| `[[CODE]]` | Discount code from `site_gwp.code` | Final message, ribbon |
