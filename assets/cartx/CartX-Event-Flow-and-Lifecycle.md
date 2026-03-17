# CartX Event Flow and Lifecycle

---

## Cart Update Lifecycle

### On Page Load

```
1. cartx.js loads (deferred)
2. If pathname === "/cart" → redirect to "/?open_cart=1"
3. Else → fetchCart()
4. fetchCart():
   a. GET /cart.js → store in user_cart
   b. checkDiscountCode(cart) → populate currentDiscountCodes
   c. cartx() → compute rules and update cart (no variantObject, no event)
   d. If ?open_cart=1 in URL → openDrawer(), clean URL via history.replaceState
5. DOMContentLoaded:
   a. MutationObserver watches for new .cartx-product-button-wrap elements → loadedEvents()
   b. loadedEvents() → bind ATC buttons across the site
```

### On Add to Cart (from anywhere)

```
1. User clicks .cartx-add-to-cart button
2. handleAddToCartClick(event):
   a. Read variant-id, price, quantity, product-type, collection-ids from .cartx-product-button-wrap
   b. Build variantObject: { [variantId]: { quantity, price, type, collection_ids } }
   c. If NOT inside drawer → show button loading state
   d. Call cartx(variantObject, "ADD", { skipLoader: isInDrawer })
3. cartx() function:
   a. If isProcessing → updateQuantity(variantObject, null) and return
   b. Set isProcessing = true, startLoader()
   c. Read metaobject data from <body> attributes
   d. Build cartUpdatedObject from current cart items
   e. Identify free products (price in [0, 100]) → mark for removal (unless claimed_gift)
   f. Compute adjustedCartQuantity and adjustedCartPrice
   g. GWP: getApplicableRule() → add gift variants to cartUpdatedObject
   h. Claim Gift: getApplicableRule() → restore from localStorage
   i. Apply ADD changes: cartUpdatedObject[variantId] = currentQty + quantity
   j. Freebies: check cart_freebie rules → add freebie variants
   k. BOGO: parse bogooffers, check triggers → auto-add offer variants
   l. Check quantity limit (max 40 per item)
   m. POST /cart/update.js with { updates: cartUpdatedObject }
4. On success:
   a. user_cart = response data
   b. isProcessing = false
   c. Check for unavailable gift variants (compare sent vs received)
   d. If total_price mismatch → retry cartx() (up to 3 times)
   e. Else → reload_cartx(), updateQuantity(), updateBubble(), checkDiscountCode()
   f. Show "Product added to cart!" toast (auto-hides in 5s)
5. On error:
   a. If VARIANT_NOT_FOUND → identify failed variants, add to unavailableGiftVariants
   b. Retry without failed variants (retryCartUpdate)
   c. Show gift unavailable message
```

### On Remove from Cart (drawer quantity buttons)

```
1. User clicks minus button (.cartx-drawer-product-quantity-button[name="minus"])
2. bindingEvent() handler:
   a. Read variant-id, quantity (1), price from parent <li>
   b. Call cartx(variantObject, "REMOVE")
3. cartx() with event="REMOVE":
   a. Same flow as ADD but:
      - adjustedCartQuantity = current - quantity
      - adjustedCartPrice = current - price
      - cartUpdatedObject[variantId] = Math.max(0, currentQty - quantity)
   b. Gift rules re-evaluated with new totals
   c. If threshold no longer met → gift variants removed from cartUpdatedObject
```

### On Quantity Change (outside drawer)

```
1. User clicks plus/minus on .cartx-product-button-wrap
2. handleAddToCartClick / handleRemoveFromCartClick
3. Same flow as Add/Remove but with skipLoader based on context
```

### On Variant Change (in cart item)

```
1. User changes variant dropdown (.cartx-variant-cart)
2. handleVariantChange():
   a. Build variantObject with replace_variant set to old variant ID
   b. Call cartx(variantObject, "ADD")
3. In cartx(): old variant set to qty 0, new variant set to old qty
```

### On Drawer Open

```
1. openDrawer(event):
   a. cart-drawer element gets .drawer-open class
   b. overlay gets .open-overlay class
   c. body gets .cartx-open class
```

### On Drawer Close

```
1. closeDrawer():
   a. Remove .drawer-open from cart-drawer
   b. Remove .open-overlay from overlay
   c. Remove .cartx-open and .overflow-hidden from body
```

### On Coupon Apply

```
1. User enters code or clicks Apply on a coupon card
2. applyDiscount(cartToken, code):
   a. Validate code format
   b. startLoader(), show "Applying discount..."
   c. Get current applied codes from cart
   d. Append new code to list
   e. POST /cart/update.js with { discount: "CODE1,CODE2" }
   f. GET /cart.js to verify code was actually applied
   g. If verified → user_cart updated, showConfetti = true, reload_cartx()
   h. If not verified → show error message
```

### On Coupon Remove

```
1. User clicks Remove on applied coupon
2. removeDiscount(cartToken, code):
   a. Get current codes, filter out target code
   b. POST /cart/update.js with { discount: "remaining codes" }
   c. GET /cart.js to refresh state
   d. reload_cartx()
```

---

## Network Calls

| Endpoint | Method | When | Purpose |
|---|---|---|---|
| `/cart.js` | GET | Page load, after apply/remove discount | Fetch full cart state |
| `/cart/update.js` | POST | Every cart change | Update item quantities AND/OR apply discount codes |
| `?sections=cartx-drawer` | GET | After every cart update | Fetch fresh section HTML for re-render |
| `/variants/{id}.js` | GET | Stock check before checkout (optional) | Verify variant availability |
| AI upsell API | GET | After section re-render (AI mode) | Fetch product recommendations |

**Important:** CartX does NOT use `/cart/add.js` or `/cart/change.js`. All updates go through `/cart/update.js` with `{ updates: { variantId: quantity } }`.

---

## Section Re-Rendering

```javascript
function reload_cartx() {
  // 1. Save scroll position of .cartx-drawer-body-wrap
  // 2. GET /?sections=cartx-drawer (current page path + section ID)
  // 3. Parse response HTML with DOMParser
  // 4. Replace .cartx-drawer-inner innerHTML with new content
  // 5. Restore scroll position
  // 6. If showConfetti → play confetti animation
  // 7. If AI upsell mode → call updateAiUpsell()
  // 8. Re-bind all events: bindingEvent() + loadedEvents()
  // 9. stopLoader()
  // 10. updateGiftUnavailableMessage()
}
```

**Key detail:** The entire `.cartx-drawer-inner` content is replaced (full section re-render), NOT partial updates. This means all event listeners must be re-attached after every update.

---

## Custom Events

CartX does NOT use custom DOM events (like `cartx:updated`). All communication is through:

1. Direct function calls (`cartx()`, `reload_cartx()`, etc.)
2. Global variables (`user_cart`, `isProcessing`, `currentDiscountCodes`, etc.)
3. DOM mutation observer (watches for new `.cartx-product-button-wrap` elements)

---

## Debounce / Throttle

| Mechanism | Where | Behavior |
|---|---|---|
| `isProcessing` flag | `cartx()` function | Prevents concurrent cart updates. If `isProcessing` is true, new calls only run `updateQuantity()` for UI feedback but skip the API call. |
| Loader safety timeout | `startLoader()` | 10-second timeout forces `stopLoader()` and resets `isProcessing` if something hangs. |
| Retry limit | Cart total mismatch | Max 3 retries (`MAX_CARTX_RETRIES`) before giving up on recursive `cartx()` calls. |
| Gift retry interval | `UNAVAILABLE_GIFT_RETRY_INTERVAL` | 60-second cooldown before retrying unavailable gift variants. |

---

## Global State Variables

| Variable | Type | Purpose |
|---|---|---|
| `user_cart` | Object (cart JSON) | Current cart state from Shopify |
| `isProcessing` | Boolean | Mutex lock for cart updates |
| `freeGiftPrice` | Number | Price value that identifies free gifts (100 = ₹1) |
| `priceArray` | Array | `[0, 1]` — prices considered "free" for filtering |
| `currentDiscountCodes` | Array | Currently applied discount code titles (uppercase) |
| `showConfetti` | Boolean | Flag to trigger confetti on next reload_cartx |
| `loaderTimeout` | Timer ID | Safety timeout for loader |
| `unavailableGiftVariants` | Array | Variant IDs that failed to add (runtime tracking) |
| `unavailableGiftLastAttempt` | Timestamp | Last time unavailable gifts were retried |
| `hasBogoOfferDrafted` | Boolean | True if any BOGO offer product is drafted |
| `oosGiftVariants` | Array | OOS variant IDs from Liquid (static, from page load) |
| `cartxRetryCount` | Number | Counter for cart total mismatch retries |
| `originalFetch` | Function | Saved reference to native `window.fetch` (before interception) |

---

## Sequence Diagram: Add to Cart

```
User                    JS (cartx.js)              Shopify API           DOM
  |                         |                          |                   |
  |-- click ATC ----------->|                          |                   |
  |                         |-- isProcessing=true      |                   |
  |                         |-- startLoader()          |                   |
  |                         |-- read body attrs        |                   |
  |                         |-- compute rules          |                   |
  |                         |-- build cartUpdatedObj   |                   |
  |                         |                          |                   |
  |                         |-- POST /cart/update.js ->|                   |
  |                         |                          |-- 200 OK -------->|
  |                         |<-- cart JSON ------------|                   |
  |                         |                          |                   |
  |                         |-- user_cart = data       |                   |
  |                         |-- isProcessing=false     |                   |
  |                         |                          |                   |
  |                         |-- GET ?sections=cartx-drawer --------------->|
  |                         |<-- section HTML ---------|                   |
  |                         |                          |                   |
  |                         |-- replace innerHTML -----|------------------>|
  |                         |-- restore scroll         |                   |
  |                         |-- bindingEvent()         |                   |
  |                         |-- loadedEvents()         |                   |
  |                         |-- stopLoader()           |                   |
  |                         |-- updateBubble()         |                   |
  |                         |                          |                   |
  |<-- toast: "Product added to cart!" ----------------|-------------------|
```
