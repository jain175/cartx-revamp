# CartX Feature Inventory

---

## 1. Drawer Open/Close

**Purpose:** Slide-out cart drawer replacing default /cart page

**UI:** `snippets/cartx-drawer.liquid` — `<cart-drawer class="cartx-drawer">`, `.cartx-drawer-overlay`

**JS:** `cartx.js` — `openDrawer()`, `closeDrawer()`, `window.closeDrawer()` (global)

**CSS:** `cartx-drawer.css` — `.cartx-drawer`, `.drawer-open`, `.cartx-drawer-overlay`, `.open-overlay`

**Data:** None

**Triggers:**
- Click on `.cartx-icon` elements (cart icon buttons anywhere on site)
- Click on any `a[href="/cart"]` link (intercepted globally)
- `/cart` page visit → redirects to `/?open_cart=1` → opens drawer
- Close: click `.cartx-drawer-close`, click overlay, click outside drawer

**Known Issues:** None observed

---

## 2. Cart Fetch & Update

**Purpose:** Fetch cart state, compute gift/freebie rules, update cart via single API call

**UI:** Loading spinner `.cartx-atc-cart-loading`

**JS:** `cartx.js` — `fetchCart()`, `cartx(variantObject, event, options)`, `reload_cartx()`

**CSS:** `.cartx-atc-cart-loading.loading`

**Data:** `user_cart` global variable (cart JSON from `/cart.js`)

**Triggers:**
- Page load → `fetchCart()`
- Any add/remove/quantity change → `cartx()` → `POST /cart/update.js` → `reload_cartx()`

**Notes:**
- Fetch interception blocks console-based cart manipulation (lines 1-21)
- 10-second safety timeout on loader
- `isProcessing` flag prevents concurrent updates
- Max 3 retries if cart total doesn't match expected price after update

---

## 3. Gift With Purchase (GWP) — Auto-Add Gifts

**Purpose:** Automatically add free gift variants to cart when threshold met

**UI:** Gift appears as freebie item in cart list (rendered with `isFreebie: 'true'`)

**JS:** `cartx.js` — `getApplicableRule()`, gift logic in main `cartx()` function (lines 912-950)

**CSS:** `.cartx-free-gift-item`, `.cartx-free-gift-tag-box`, `.free-gift-text`

**Data:**
- Metaobject: `site_gwp` / `vip_gwp` → `gift_manage` field
- Body attribute: `metaobject` (JSON of `gift_manage.value`)
- Each gift rule has: `triggered_quantity` or `trigger_price`, `get_y` (variant refs)

**Triggers:** Cart quantity or price meets threshold in `gift_manage` rules

**Limitations:**
- Only the HIGHEST matching rule applies (sorted descending, first picked)
- OOS gift variants tracked in `unavailableGiftVariants[]`; retry every 60 seconds
- Gift variants pre-checked for availability via Liquid `oosgiftvariants` body attribute

---

## 4. Gift Details / Locked Gift Preview

**Purpose:** Show a locked gift image + "add X more to unlock" message below cart items

**UI:** `snippets/cartx-gift-details.liquid` — `.cartx-locked-gift-container`, `.cartx-unlock-message`

**JS:** None (pure Liquid rendering)

**CSS:** `.cartx-gift-msg`, `.cartx-locked-gift-*`

**Data:** `gift_manage` rules — `gift_locked_product` (product ref), `gift_locked_message` (text with `[[PRICE]]`, `[[PRODUCT]]`, `[[TITLE]]` placeholders)

**Triggers:** When cart hasn't yet reached the next gift threshold

---

## 5. BOGO Offers (Buy One Get One)

**Purpose:** Show upsell products or auto-add a gift when trigger collection products are in cart

**UI:** `snippets/cartx-bogo-offer.liquid` — `.cartx-bogo-offer-wrap`, `.cartx-upsell-bundle-wrap`

**JS:** `cartx.js` — BOGO auto-add logic (lines 1041-1268), bundle multi-add via `.cartx-bogo-offer-add-to-cart`

**CSS:** `.cartx-bogo-offer-wrap`, `.cartx-bogo-offer-add-to-cart`

**Data:**
- Metaobject: `bogo_offers` (child of `site_gwp`/`vip_gwp`)
- Body attribute: `bogooffers` (JSON array)
- Fields: `auto_add`, `is_price_base`, `trigger_count`, `trigger_price`, `trigger_collection`, `offer_products`, `reverse_offer_product`, `bundle_products`, `offer_heading`, `min_offer_quantity`

**Triggers:**
- **Count-based:** X products from trigger collection in cart → show/auto-add offer
- **Price-based:** Total price of trigger collection products >= threshold
- **Auto-add:** Only when `auto_add = true` AND exactly 1 offer variant
- **Bundle mode:** When `bundle_products = true` AND multiple offer products → show "Add Bundle to Cart" button
- **Reverse offer:** If primary trigger not met but cart total >= trigger_price, add `reverse_offer_product` instead

**Limitations:**
- Auto-add only works with single-variant offers
- Bundle mode requires manual click (no auto-add)
- Offer product availability checked — shows unavailable message if drafted/OOS

---

## 6. Product-Level Freebies

**Purpose:** Auto-add a freebie variant when a specific trigger product is in cart

**UI:** Freebie appears as cart item with `isFreebie: 'true'`

**JS:** `cartx.js` — freebie logic (lines 996-1028), `cleanData()` helper

**CSS:** Same as GWP freebies

**Data:**
- Metaobject: `cart_freebie`
- Body attribute: `cartfreebie` (JSON array)
- Each entry: `freebie` (variant GIDs), `products` (trigger variant GIDs)

**Triggers:** Any trigger product variant present in cart → freebie variant added

**Limitations:**
- Only first freebie variant per rule is used (`freebie[0]`)
- OOS tracking same as GWP gifts

---

## 7. Claim-a-Gift

**Purpose:** Let customer manually pick a gift from a list when threshold is met

**UI:** `snippets/cartx-claim-gift.liquid` — `.cartx-claim-gift-wrap`, `.cartx-claim-product-list`

**JS:** `cartx.js` — claim gift button handlers (lines 163-197), `getApplicableRule()` for claim gift, localStorage persistence

**CSS:** `.cartx-claim-gift-wrap`, `.cartx-claim-product-item`, `.claimed`

**Data:**
- Metaobject: `claim_gift` (child of `site_gwp`/`vip_gwp`)
- Body attribute: `claimgift` (JSON)
- Fields: `trigger_price`, `triggered_quantity`, `gift_products` (variant refs)

**Triggers:** Cart price or quantity meets claim gift threshold

**Notes:**
- Customer's claimed gift choice persisted in `localStorage("claimedGiftProducts")`
- Gift added with `properties.claimed_gift = "true"` to prevent auto-removal by GWP logic
- Heading text: "Add freebies at ₹1" (hardcoded in snippet)

---

## 8. Progress Bar

**Purpose:** Multi-tier visual progress bar showing how close customer is to next reward

**UI:** `snippets/cartx-progressbar.liquid` — `.custom-progressbar`, `.progress-container`, `.progress-circles`

**JS:** None (pure Liquid rendering, re-rendered via section fetch)

**CSS:** `.custom-progressbar`, `.progress`, `.icon-container`, `.active`, `.inactive`, `.glowing-effect`

**Data:**
- Metaobject: `cart_progressbar` (child of `site_gwp`/`vip_gwp`)
- Parent fields: `number_of_offers`, `progressbar_is_price_based`, `disable_progress_bar`, `top_message_after_stage_achieved`
- Stage fields: `trigger_price`, `trigger_product`, `top_message_for_stage`, `message_for_stage`, `sub_message_for_stage`, `upload_svg_icon`

**Triggers:** Always shown (unless `disable_progress_bar` is true)

**Notes:**
- Progress width calculated as cumulative percentage across segments
- First inactive stage gets `.glowing-effect` class
- Messages support `[[PRICE]]` and `[[PRODUCT]]` placeholders
- Rich text fields rendered via `| metafield_tag` filter

---

## 9. Coupon Drawer / Apply Logic

**Purpose:** Show available coupons, apply/remove discount codes

**UI:**
- Inline: `.cartx-offer-main-wrapper` in `snippets/cartx-drawer.liquid` — shows "Apply Coupon" or applied coupon state
- Panel: `snippets/cartx-offer.liquid` — `.cartx-all-offers` slide-in panel with coupon list and input
- Applied coupon box: `.cartx-applied-coupon-container`

**JS:** `cartx.js` — `applyDiscount()`, `removeDiscount()`, `applyCode()`, `checkDiscountCode()`, `toggleOfferWrapper()`

**CSS:** `.cartx-offer-main-wrapper`, `.cartx-all-offers`, `.prv-coupon-card`, `.cartx-applied-coupon-*`

**Data:**
- Metaobject: `signed_in_customer_coupons` / `regular_customer_coupouns` (child of `site_gwp`/`vip_gwp`)
- Coupon fields: `coupon_code`, `coupon_type_title`, `coupon_title`, `coupon_description`, `coupon_before_message`, `coupon_after_message`, `coupon_success_message`, `final_message`, `trigger_quantity`, `trigger_price`

**Triggers:**
- Click "View all" or coupon wrapper → opens coupon panel
- Click "Apply" button → `applyDiscount()`
- Click "Remove" → `removeDiscount()`
- Coupon input + Enter key → `applyCode()`

**Notes:**
- Coupons show eligibility messages with `[[PRICE]]` / `[[PRODUCT]]` placeholders
- Applied coupons detected from `cart.cart_level_discount_applications` and `item.line_level_discount_allocations`
- Confetti animation plays on successful coupon apply
- Offer wrapper hidden when a discount code is active (`toggleOfferWrapper()`)
- Different coupon sets for logged-in vs guest customers

---

## 10. Upsells (3 Modes)

**Purpose:** Product recommendations in cart drawer

**UI:** `snippets/cartx-ai-upsell.liquid` — `.cartx-ai-upsell`, `.cartx-upsell-product-list`

**JS:** `cartx.js` — `updateAiUpsell()` for AI mode; `loadedEvents()` for static modes

**CSS:** `.cartx-ai-upsell`, `.cartx-upsell-product-item`, `.cartx-upsell-item-*`

**Data:**
- **Mode 1 (Product metafield):** `product.metafields.custom.cartx_upsell_products` on last added product
- **Mode 2 (Section settings):** `section_settings.product_base_upsell_products` (product list)
- **Mode 3 (AI):** External API at AWS Lambda endpoint with Bearer token

**Priority:**
1. If last cart item has `custom.cartx_upsell_products` metafield → use those
2. Else if `enable_product_base_upsell` enabled and products set → use section settings products
3. Else → call AI upsell API (controlled by `ai-cart-upsell` attribute on drawer inner)

**Notes:**
- AI mode determined by `ai-cart-upsell="true"` attribute on `.cartx-drawer-inner`
- AI API: `https://gn30lesfub.execute-api.ap-south-1.amazonaws.com/prod/...`
- AI API requires Bearer token (hardcoded in JS)

---

## 11. Cart Ribbon (Footer Message)

**Purpose:** Dynamic promotional message in footer area with optional code copy

**UI:** `snippets/cartx-cart-ribbon.liquid` — `.cartx-custom-ribbon`

**JS:** None (Liquid only, plus `code-copy-btn` handler in `bindingEvent()`)

**CSS:** `.cartx-custom-ribbon`

**Data:** `gift_manage` rules — `ribbon_before_message`, `code_copy`; parent `code` and `final_message`

**Triggers:** Always shown, message changes based on current threshold progress

**Notes:** Supports `[[PRICE]]`, `[[PRODUCT]]`, `[[CODE]]`, `[[TITLE]]` placeholders

---

## 12. Announcement Ribbon

**Purpose:** Rotating banner at top of cart drawer

**UI:** `snippets/cartx-drawer.liquid` — `.cartx-announcement-ribbon`, `.cartx-announcement-ribbon-item`

**JS:** `snippets/cartx-drawer.liquid` (inline `<script>`) — `initAnnouncementRibbon()`

**CSS:** `.cartx-announcement-ribbon`, `.cartx-announcement-ribbon-item`, `.active`

**Data:** Section settings: `announcement_ribbon_text_1/2/3`, `announcement_ribbon_url_1/2/3`, `announcement_ribbon_rotation_speed`, `announcement_ribbon_autoplay`

**Triggers:** Auto-starts on DOM ready; pauses on hover/focus

---

## 13. Order Summary

**Purpose:** Breakdown of MRP, discount on MRP, coupon discount, shipping, total

**UI:** `snippets/cartx-order-summary.liquid` — `.custom-order-summary`

**JS:** None (Liquid only)

**CSS:** `.custom-order-summary`, `.summary-row`, `.discount-row`

**Data:** Cart object (`cart.items`, `cart.total_discount`, `cart.total_price`)

**Notes:** Shipping fee hardcoded as "₹49 FREE" (always shows free)

---

## 14. Price Breakup Bottom Sheet

**Purpose:** Detailed price breakdown accessible from footer

**UI:** `snippets/cartx-drawer.liquid` — `.cartx-price-breakup-sheet`, `.cartx-price-breakup-overlay`

**JS:** `snippets/cartx-drawer.liquid` (inline) — `openPriceBreakup()`, `closePriceBreakup()`

**CSS:** `.cartx-price-breakup-sheet.active`, `.cartx-price-breakup-overlay.active`

**Data:** Cart object

---

## 15. Out-of-Stock Gift Handling

**Purpose:** Track gift variants that are unavailable and show warning

**UI:** `.cartx-gift-unavailable-sticky` in footer, toast message

**JS:** `cartx.js` — `unavailableGiftVariants[]`, `oosGiftVariants[]`, `updateGiftUnavailableMessage()`, `showGiftUnavailableMessage()`, retry logic

**CSS:** `.cartx-gift-unavailable-sticky`

**Data:**
- Liquid: `oosgiftvariants` body attribute (pre-computed OOS variant IDs)
- JS: `unavailableGiftVariants` (runtime tracking of failed adds)

**Notes:**
- Retry interval: 60 seconds (`UNAVAILABLE_GIFT_RETRY_INTERVAL`)
- Two sources of OOS: Liquid-computed (inventory 0 + continue selling OFF) and JS-detected (add failure)

---

## 16. Stock Check at Checkout

**Purpose:** Verify product availability before redirecting to checkout

**UI:** `snippets/cartx-drawer.liquid` — `#stock-check-overlay`, `#out-of-stock-modal`

**JS:** `snippets/cartx-drawer.liquid` (inline) — `checkStockAndProceed()`, `checkProductStock()`, `removeOutOfStockItems()`

**Data:** Shopify `/variants/{id}.js` endpoint

**Notes:** Currently the checkout button calls `proceedToCheckout()` directly (stock check is available but not wired to checkout button by default)

---

## 17. Trust Badges

**Purpose:** Show trust indicators (Easy Returns, Cruelty Free, Quality First)

**UI:** `snippets/cartx-trust-badges.liquid` — `.cartx-trust-badges`

**JS:** None

**CSS:** `.cartx-trust-badges`, `.cartx-trust-badge-item`

**Data:** Hardcoded SVGs and text

---

## 18. Sign-In Prompt

**Purpose:** Show "Sign in to unlock coupons" for guest users

**UI:** `snippets/cartx-signin.liquid` — `.cartx-signin-wrapper`

**JS:** `cartx.js` — sign-in button handler redirects to `/account`

**CSS:** `.cartx-signin-wrapper`

**Data:** `customer` Liquid object (shows only when `customer == blank`)

**Notes:** Currently commented out in the coupon section

---

## 19. Add-to-Cart Popup Toast

**Purpose:** Show "Product added to cart!" toast notification

**UI:** `layout/theme.liquid` — `.cartx-add-to-cart-popup`

**JS:** `cartx.js` — shown after ADD/MULTI_ADD events, auto-hides after 5 seconds

**CSS:** `.cartx-add-to-cart-popup`, `.hide`

---

## 20. Fetch Interception / Anti-Tamper

**Purpose:** Block cart manipulation from browser console

**JS:** `cartx.js` lines 1-21 — overrides `window.fetch`, checks call stack for `<anonymous>` or `VM`

**Triggers:** Any fetch to `/cart/add.js`, `/cart/update.js`, `/cart/change.js` from console

---

## 21. Cart Page Redirect

**Purpose:** Prevent cart page from loading; redirect to homepage with drawer open

**JS:** `cartx.js` lines 43-49 — if pathname is `/cart`, redirect to `/?open_cart=1`

**Also:** Global click interceptor (lines 2232-2254) catches `a[href="/cart"]` links and opens drawer instead

---

## 22. Confetti Animation

**Purpose:** Celebratory animation when coupon is successfully applied

**JS:** `cartx.js` — `cartConfetti()` using Lottie

**Data:** Lottie JSON hosted on Shopify CDN

**Dependency:** `bodymovin/lottie.min.js` (loaded via CDN in `theme.liquid`)
