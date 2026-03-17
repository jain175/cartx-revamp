# CartX DOM Contract

> Required selectors, data attributes, and markup structures. If any of these are missing or renamed, the corresponding feature breaks.

---

## 1. Cart Drawer Container

**Required markup:**
```html
<cart-drawer class="cartx-drawer">
  <div id="CartDrawer" class="cartx-drawer-wrap">
    <div class="cartx-drawer-inner" ai-cart-upsell="true|false">
      <!-- all cart content -->
    </div>
  </div>
</cart-drawer>
<div id="cartx-drawer-overlay" class="cartx-drawer-overlay"></div>
```

**Critical selectors:**
| Selector | Used By | Purpose |
|---|---|---|
| `cart-drawer.cartx-drawer` | `loadedEvents()` | Click-outside-to-close handler |
| `.cartx-drawer.drawer-open` | `openDrawer()` | Drawer visible state |
| `.cartx-drawer-overlay` | `openDrawer()`, `closeDrawer()` | Overlay element |
| `.cartx-drawer-overlay.open-overlay` | `openDrawer()` | Overlay visible state |
| `.cartx-drawer-inner` | `reload_cartx()` | Content replacement target |
| `#shopify-section-cartx-drawer .cartx-drawer-inner` | `reload_cartx()` | Section-scoped content target |
| `[ai-cart-upsell]` | `reload_cartx()` | Determines upsell mode after re-render |

**What breaks if changed:**
- Remove `cart-drawer` custom element → click-outside close breaks
- Change `.cartx-drawer-inner` class → section re-render fails (blank drawer)
- Remove `ai-cart-upsell` attribute → AI upsell always fires or never fires

---

## 2. Body Attributes (Data Bridge)

**Required on `<body>`:**
```html
<body
  final_matched_object="..."
  metaobject="..."
  cartfreebie="..."
  claimgift="..."
  bogooffers='...'
  oosgiftvariants="..."
  data-gift-unavailable="true"  <!-- set by JS -->
>
```

| Attribute | Format | Required? | What breaks if missing |
|---|---|---|---|
| `metaobject` | JSON string (escaped) | Y (if GWP exists) | `cartx()` throws on `JSON.parse(null)` — all cart operations fail |
| `cartfreebie` | JSON string (escaped) | Y | Same — `cleanData(null)` may fail |
| `claimgift` | JSON string (escaped) | N | Claim gift feature disabled |
| `bogooffers` | JSON string (single-quoted) | N | BOGO auto-add disabled |
| `oosgiftvariants` | Comma-separated IDs | N | No pre-computed OOS, relies on runtime detection only |

---

## 3. Cart Item Line

**Required markup (per item):**
```html
<li class="cartx-drawer-product-item"
    data-variant-id="12345"
    data-handle="product-handle"
    data-quantity="1"
    data-price="29900"
    data-product-type="Skincare"
    data-collection-ids='["111","222"]'>
  <!-- item content -->
</li>
```

**Critical data attributes:**
| Attribute | Type | Used By | Purpose |
|---|---|---|---|
| `data-variant-id` | String (numeric) | `bindingEvent()` quantity buttons | Identifies variant for cart update |
| `data-quantity` | String (numeric) | `bindingEvent()` | Always "1" — the increment amount |
| `data-price` | String (numeric, cents) | `bindingEvent()` | Price in cents for cart total calculation |
| `data-product-type` | String | `bindingEvent()` | Used to identify "Combos" type |
| `data-collection-ids` | JSON array string | BOGO logic | Collection membership for trigger matching |

**Freebie indicator:**
- Class `.cartx-free-gift-item` on `<li>` — identifies freebie items
- Free items show "Free" tag, no quantity controls

**What breaks:** Remove `data-variant-id` → quantity +/- buttons do nothing

---

## 4. Quantity Buttons (In-Drawer)

```html
<button name="minus" class="cartx-drawer-product-quantity-button">...</button>
<input class="cartx-drawer-product-quantity-input" value="2" readonly>
<button name="plus" class="cartx-drawer-product-quantity-button">...</button>
```

| Selector | Purpose |
|---|---|
| `.cartx-drawer-product-quantity-button` | Event target for +/- clicks |
| `button[name="plus"]` / `button[name="minus"]` | Determines ADD vs REMOVE |
| `.cartx-drawer-product-quantity-input` | Display only (readonly) |

---

## 5. Add to Cart Buttons (Sitewide)

**Required markup:**
```html
<div class="cartx-product-button-wrap"
     data-product-id="111"
     data-variant-id="12345"
     data-quantity="1"
     data-price="29900"
     data-product-type="Skincare"
     data-collection-ids='["111","222"]'>
  <div class="cartx-add-to-cart">
    <span>Add to Cart</span>
  </div>
  <div class="cartx-atc-loading" style="display:none;">
    <!-- spinner SVG -->
  </div>
  <div class="cartx-add-to-cart-qty-wrap" style="display:none;">
    <button class="cartx-remove-from-cart minus"></button>
    <input class="cartx-atc-qty" value="0" data-variant-id="12345" readonly>
    <button class="cartx-add-to-cart plus"></button>
  </div>
</div>
```

**Critical selectors:**
| Selector | Event | Purpose |
|---|---|---|
| `.cartx-add-to-cart:not(.plus):not(.cartx-sold-out)` | click → `handleAddToCartClick` | First add to cart |
| `.cartx-add-to-cart.plus` | click → `handleAddToCartClick` | Increment quantity |
| `.cartx-remove-from-cart.minus` | click → `handleRemoveFromCartClick` | Decrement quantity |
| `.cartx-product-button-wrap` | parent container | Data attribute source |
| `.cartx-atc-qty` | input | Quantity display |
| `.cartx-sold-out` | class on `.cartx-add-to-cart` | Prevents click handler binding |

**State transitions:**
- `cartx-add-to-cart` visible, `cartx-add-to-cart-qty-wrap` hidden → qty = 0
- `cartx-add-to-cart` hidden, `cartx-add-to-cart-qty-wrap` visible → qty > 0
- `cartx-button-loadding` on wrapper → shows loading spinner

---

## 6. Progress Bar

```html
<div class="custom-progressbar progress-container-wrap">
  <div class="top-message"><!-- dynamic message --></div>
  <div class="progress-container">
    <div class="progress" id="progress" style="width: 45%;"></div>
    <div class="progress-circles">
      <div class="active"><span><p></p></span></div>
      <!-- per stage: -->
      <div>
        <div class="icon-container active|inactive|inactive glowing-effect">
          <div class="icon-box"><!-- SVG or custom icon --></div>
        </div>
        <div class="icon-message"><!-- stage message --></div>
        <div class="icon-message bottom_msg"><!-- sub message --></div>
      </div>
    </div>
  </div>
</div>
```

**Key classes:**
| Class | Purpose |
|---|---|
| `.active` | Stage completed |
| `.inactive` | Stage not reached |
| `.glowing-effect` | First unmet stage (pulsing animation) |
| `.checkmark-icon` | Green checkmark overlay on active stages |

---

## 7. Coupon Section

**Inline (main drawer):**
```html
<div class="cartx-offer-main-wrapper">
  <!-- Non-applied state -->
  <div class="cartx-offer-main-title-wrapper">
    <div class="cartx-offer-main-title">Apply Coupon</div>
    <div class="prv-view-all">View all</div>
  </div>
  <!-- Applied state -->
  <div class="cartx-applied-coupon-container cartx-hidden">
    <div class="cartx-applied-coupon-code">CODE</div>
    <button class="cartx-applied-coupon-remove" data-code="CODE">REMOVE</button>
    <span class="cartx-savings-text">You saved ₹X with this coupon</span>
  </div>
</div>
```

**Coupon panel (slides in):**
```html
<div class="cartx-all-offers">
  <button class="cartx-offer-close"><!-- back icon --></button>
  <input class="prv-coupon-input" placeholder="Enter coupon code">
  <button class="prv-submit-button">APPLY</button>
  <div class="card-wrapper">
    <!-- coupon cards -->
    <div class="prv-coupon-card">
      <div class="cartx-apply-button-wrapper" data-code="CODE">Apply</div>
      <div class="cartx-remove-button-wrapper" data-code="CODE">Remove</div>
    </div>
  </div>
</div>
```

**Critical selectors:**
| Selector | Purpose |
|---|---|
| `.prv-view-all` | Opens coupon panel |
| `.cartx-offer-main-title-wrapper` | Also opens coupon panel (entire wrapper clickable) |
| `.cartx-offer-close` | Closes coupon panel |
| `.cartx-all-offers.is--visible` | Panel open state |
| `.prv-coupon-input` | Coupon code input field |
| `.prv-submit-button` | Submit coupon code |
| `.cartx-apply-button-wrapper[data-code]` | Apply specific coupon |
| `.cartx-remove-button-wrapper[data-code]` | Remove specific coupon |
| `.cartx-applied-coupon-remove[data-code]` | Remove applied coupon (inline) |
| `.cartx-offer-wrapper` | Hidden when discount code is active |
| `.cartx-hidden` | Utility class for hide/show toggle |

---

## 8. Upsell Section

```html
<div class="cartx-ai-upsell cartx-upsell-wrap">
  <div class="cartx-recommendation cartx-title-msg">YOU MAY ALSO LIKE</div>
  <div class="cartx-upsell-product-list" id="cartx-upsell-product-list">
    <div class="cartx-upsell-product-item" data_prod_id="12345">
      <div class="cartx-product-button-wrap" data-variant-id="..." ...>
        <!-- ATC button -->
      </div>
    </div>
  </div>
</div>
```

**Note:** `data_prod_id` uses underscore (not hyphen) — this is intentional.

---

## 9. BOGO Offer Section

```html
<div class="cartx-bogo-offer-wrap">
  <div class="cartx-upsell-product-list">
    <div class="cartx-upsell-product-item">
      <div class="cartx-product-button-wrap" data-variant-id="..." data-collection-ids='[...]'>
        <!-- ATC button -->
      </div>
    </div>
  </div>
  <!-- Bundle mode only: -->
  <button class="cartx-bogo-offer-add-to-cart">Add Bundle to Cart</button>
</div>
```

| Selector | Purpose |
|---|---|
| `.cartx-bogo-offer-add-to-cart` | Bundle add-all button |
| `.cartx-bogo-offer-wrap` | Parent for finding bundle products |

---

## 10. Claim Gift Section

```html
<div class="cartx-claim-gift-wrap" id="cartx-claim-gift-wrap">
  <div class="cartx-claim-product-list" id="cartx-claim-product-list">
    <div class="cartx-claim-product-item claimed" data_prod_id="12345">
      <div class="cartx-free-claim-buttton cartx-claim-add-to-cart" data-variant-id="12345">
        <!-- Add to cart button -->
      </div>
      <div class="cartx-free-claim-buttton cartx-claim-remove-from-cart" data-variant-id="12345">
        <!-- Remove button -->
      </div>
    </div>
  </div>
</div>
```

| Selector | Purpose |
|---|---|
| `.cartx-free-claim-buttton.cartx-claim-add-to-cart` | Add claimed gift |
| `.cartx-free-claim-buttton.cartx-claim-remove-from-cart` | Remove claimed gift |
| `[data-variant-id]` on claim buttons | Variant ID for cart operation |
| `.claimed` on `.cartx-claim-product-item` | Visual state for already-claimed items |

---

## 11. Toast / Message Elements

```html
<!-- In header area of drawer -->
<div class="cartx-apply-code-wrapper">
  <div class="cartx-apply-code__message"></div>
</div>

<!-- Global toast (in theme.liquid) -->
<div class="cartx-add-to-cart-popup hide">
  Product added to cart!
  <a class="cartx-popup-trigger cartx-icon">View Cart</a>
</div>
```

| Selector | Purpose |
|---|---|
| `.cartx-apply-code-wrapper.show-message` | Message visible state |
| `.cartx-apply-code-wrapper.purple-message` | Purple styling for exceed limit messages |
| `.cartx-apply-code__message` | Message text container |
| `.cartx-add-to-cart-popup.hide` | Toast hidden state |

---

## 12. Gift Unavailable Sticky

```html
<div class="cartx-gift-unavailable-sticky" style="display: none;">
  <!-- SVG icon -->
  <span>Gift product is out of stock</span>
</div>
```

| Selector | Purpose |
|---|---|
| `.cartx-gift-unavailable-sticky` | Controlled by `updateGiftUnavailableMessage()` — shown/hidden via inline `display` |

---

## 13. Cart Icon / Drawer Trigger

Any element with class `.cartx-icon` will trigger drawer open on click.

```html
<a class="cartx-icon" href="javascript:void(0);">Cart</a>
```

Also: any `<a href="/cart">` link is intercepted and opens the drawer instead.

---

## 14. Cart Count Bubble

```html
<span class="cartx-drawer-item-count" data-count="3">3</span>
<!-- and theme's own bubble: -->
<div class="cart-count-bubble">
  <span aria-hidden="true">3</span>
  <span class="visually-hidden">3 items</span>
</div>
```

| Selector | Purpose |
|---|---|
| `.cart-count-bubble span[aria-hidden="true"]` | Visible count |
| `.cart-count-bubble .visually-hidden` | Screen reader count |
| `#cart-icon-bubble` | Theme's cart icon bubble |

---

## 15. Confetti Container

```html
<div id="cartx-confetti" class="cartx-confetti-wrapper"></div>
```

Used by Lottie animation. Must exist inside `.cartx-drawer-inner`.

---

## 16. Price Breakup Bottom Sheet

```html
<div class="cartx-price-breakup-overlay" id="priceBreakupOverlay"></div>
<div class="cartx-price-breakup-sheet" id="priceBreakupSheet">
  <div class="cartx-price-breakup-content">
    <!-- rows -->
  </div>
</div>
```

| Selector | Purpose |
|---|---|
| `#priceBreakupOverlay.active` | Overlay visible |
| `#priceBreakupSheet.active` | Sheet visible |
| `.cartx-view-price-breakup` | Trigger button in footer |
