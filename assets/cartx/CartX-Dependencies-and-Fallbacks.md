# CartX Dependencies and Fallbacks

---

## External Libraries

### 1. Lottie (bodymovin)

| Property | Value |
|---|---|
| **CDN URL** | `https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js` |
| **Loaded in** | `layout/theme.liquid` (deferred `<script>` tag) |
| **Used by** | `cartConfetti()` in `cartx.js` |
| **Purpose** | Plays confetti animation when a coupon code is successfully applied |
| **Global exposed** | `lottie` (via `bodymovin` library) |

**What happens if missing:**
- `cartConfetti()` will throw a ReferenceError when calling `lottie.loadAnimation()`
- Coupon application itself still works — only the visual celebration fails
- **Severity: Low** — Cosmetic only, does not affect cart functionality

**Safe fallback:** Wrap `lottie.loadAnimation()` in a try-catch or check `typeof lottie !== 'undefined'` before calling.

### 2. Shopify Section Rendering API

| Property | Value |
|---|---|
| **Endpoint** | `GET /?sections=cartx-drawer` (appended to current page path) |
| **Used by** | `reload_cartx()` in `cartx.js` |
| **Purpose** | Fetches fresh HTML for the cart drawer after every cart update |

**What happens if missing/fails:**
- Cart drawer content becomes stale — shows old items/totals
- User sees a loader that never resolves (until 10-second safety timeout kicks in)
- **Severity: Critical** — Cart becomes non-functional if section rendering fails repeatedly

**Safe fallback:** The 10-second loader timeout in `startLoader()` prevents permanent hang. On failure, a page reload would restore correct state.

### 3. Shopify Cart API

| Endpoint | Method | Used For |
|---|---|---|
| `/cart.js` | GET | Fetch full cart state on page load and after discount operations |
| `/cart/update.js` | POST | ALL cart mutations (add, remove, quantity change, discount apply/remove) |

**What happens if missing/fails:**
- `/cart.js` failure → `user_cart` is never populated → all cart operations fail
- `/cart/update.js` failure → cart changes don't persist → error handler attempts retry for variant-not-found errors
- **Severity: Critical** — These are the core Shopify APIs; if they fail, the entire cart is non-functional

**Note:** CartX does NOT use `/cart/add.js` or `/cart/change.js`. Everything goes through `/cart/update.js`.

### 4. AI Upsell API (External)

| Property | Value |
|---|---|
| **Endpoint** | `https://kfzu4pu2hgyobf37oiwsicvaxi0tputs.lambda-url.ap-south-1.on.aws/` |
| **Auth** | Bearer token (hardcoded in `cartx.js`) |
| **Used by** | `updateAiUpsell()` in `cartx.js` |
| **Purpose** | Fetches personalized product recommendations |

**What happens if missing/fails:**
- AI upsell container remains empty
- No error shown to user — fails silently
- Product-based upsell (metafield or section settings) is used as higher-priority alternative
- **Severity: Low** — Upsell is optional, and two fallback modes exist

**Safe fallback:** Already has graceful degradation:
1. Product metafield `custom.cartx_upsell_products` (highest priority)
2. Section settings `product_base_upsell_products` (manual list)
3. AI API (lowest priority, only when `ai-cart-upsell="true"`)

---

## Global JavaScript Objects

### Variables Set Before `cartx.js` Loads

| Variable | Set In | Type | Required? |
|---|---|---|---|
| `window.fetch` | Native browser | Function | Yes — CartX intercepts and wraps it |
| `Shopify.routes.root` | Shopify platform | String | Yes — Used to construct API URLs |

### Variables Created by `cartx.js`

| Variable | Type | Initial Value | Purpose |
|---|---|---|---|
| `user_cart` | Object | `null` (set on `fetchCart()`) | Current cart state from Shopify |
| `isProcessing` | Boolean | `false` | Mutex lock preventing concurrent cart updates |
| `freeGiftPrice` | Number | `100` | Price in cents that identifies free gifts (₹1) |
| `priceArray` | Array | `[0, 1]` | Prices considered "free" for freebie filtering (in rupees) |
| `currentDiscountCodes` | Array | `[]` | Currently applied discount code titles (uppercase) |
| `showConfetti` | Boolean | `false` | Flag to trigger confetti on next `reload_cartx()` |
| `loaderTimeout` | Timer ID | `null` | Safety timeout reference for loader |
| `unavailableGiftVariants` | Array | `[]` | Variant IDs that failed to add at runtime |
| `unavailableGiftLastAttempt` | Timestamp | `0` | Last time unavailable gifts were retried |
| `hasBogoOfferDrafted` | Boolean | `false` | Whether any BOGO offer product is in draft status |
| `oosGiftVariants` | Array | `[]` (parsed from body attr) | OOS variant IDs computed by Liquid at page load |
| `cartxRetryCount` | Number | `0` | Counter for cart total mismatch retries |
| `originalFetch` | Function | `window.fetch` (saved before override) | Reference to native fetch for CartX's own API calls |

### Constants

| Constant | Value | Purpose |
|---|---|---|
| `MAX_CARTX_RETRIES` | `3` | Max recursive `cartx()` retries on total mismatch |
| `UNAVAILABLE_GIFT_RETRY_INTERVAL` | `60000` (60 seconds) | Cooldown before retrying unavailable gift variants |

---

## DOM Dependencies

### Required Custom Element

| Element | Purpose | What Breaks If Missing |
|---|---|---|
| `<cart-drawer>` | Custom element wrapper for click-outside detection | Click outside drawer won't close it |

**Note:** `<cart-drawer>` is used as a custom element tag but there is no JavaScript `customElements.define()` for it. It works purely as a CSS/JS selector target.

### Required Body Attributes

| Attribute | Required? | What Breaks If Missing |
|---|---|---|
| `metaobject` | Yes (if GWP exists) | `JSON.parse(null)` throws — all cart operations fail |
| `cartfreebie` | Yes | `cleanData(null)` may throw — freebie logic fails |
| `claimgift` | No | Claim gift feature silently disabled |
| `bogooffers` | No | BOGO auto-add silently disabled |
| `oosgiftvariants` | No | No pre-computed OOS list; relies on runtime detection only |

**Critical:** The `metaobject` and `cartfreebie` attributes MUST be present even if empty (`"[]"`). A missing attribute returns `null` from `getAttribute()`, which causes `JSON.parse(null)` to throw an unhandled exception that breaks the entire `cartx()` function.

### Required CSS Files

| File | Loaded In | Purpose |
|---|---|---|
| `assets/cartx-drawer.css` | `layout/theme.liquid` | All CartX drawer styling |
| `assets/component-cart-drawer.css` | `sections/cartx-drawer.liquid` | Base component styles (from theme) |

### Required JS Files

| File | Loaded In | Defer? | Purpose |
|---|---|---|---|
| `assets/cartx.js` | `layout/theme.liquid` | Yes | Core cart logic |
| Lottie CDN | `layout/theme.liquid` | Yes | Confetti animation |

---

## Shopify Platform Dependencies

### Liquid Objects Used

| Object | Where Used | Purpose | What Breaks If Unavailable |
|---|---|---|---|
| `cart` | `sections/cartx-drawer.liquid`, all snippets | Cart state for Liquid rendering | Entire drawer fails to render |
| `cart.items` | `snippets/cartx-drawer.liquid` | Line item iteration | No items displayed |
| `cart.total_price` | `snippets/cartx-order-summary.liquid` | Order total | Wrong totals shown |
| `cart.total_discount` | `snippets/cartx-order-summary.liquid` | Discount calculation | Missing discount display |
| `cart.item_count` | `sections/cartx-drawer.liquid` | Count for threshold calculation | Wrong gift thresholds |
| `customer` | `sections/cartx-drawer.liquid` | VIP check, coupon segmentation | Falls back to non-VIP, regular coupons |
| `customer.tags` | `sections/cartx-drawer.liquid` | VIP detection (`contains 'VIP'`) | All customers treated as non-VIP |
| `shop.metaobjects` | `sections/cartx-drawer.liquid`, `layout/theme.liquid` | Metaobject data access | No GWP, no freebies — features disabled |
| `request.path` | `sections/cartx-drawer.liquid` | Page-specific metaobject matching | Falls back to default metaobject entry |
| `product` (contextual) | `snippets/cartx-atc-pdp.liquid` | Current product for ATC button | ATC button missing data attributes |
| `recommendations` | Not used directly | N/A | CartX uses its own upsell system |

### Metaobject Types Required in Shopify Admin

| Type Handle | Required? | What Breaks If Missing |
|---|---|---|
| `site_gwp` | Yes (for non-VIP GWP) | GWP feature completely disabled for regular customers |
| `vip_gwp` | No (only if VIP exists) | VIP customers fall back to... **Unknown / Needs confirmation** — code may throw if VIP tag exists but `vip_gwp` metaobject type doesn't |
| `cart_freebie` | Yes (for product freebies) | Product freebie feature disabled |

### Metafield Required on Products

| Metafield | Required? | What Breaks If Missing |
|---|---|---|
| `custom.cartx_upsell_products` | No | Product-level upsell not shown; falls back to section settings or AI |

---

## Feature Dependency Map

Shows which features depend on which data sources. If a data source is missing, the listed features break.

```
metaobject (body attr) ──────────┬── GWP auto-add
                                 ├── Progress bar thresholds
                                 ├── Cart ribbon messages
                                 ├── Locked gift preview
                                 └── Claim gift picker

cartfreebie (body attr) ─────────── Product freebie auto-add

bogooffers (body attr) ──────────── BOGO auto-add / bundle / manual

claimgift (body attr) ───────────── Claim gift feature

oosgiftvariants (body attr) ─────── Pre-computed OOS gift list

customer.tags ───────────────────── VIP vs non-VIP metaobject selection

Lottie CDN ──────────────────────── Confetti animation only

AI API (Lambda) ─────────────────── AI-powered upsell recommendations

/cart/update.js ─────────────────── ALL cart mutations (critical)

?sections=cartx-drawer ──────────── Drawer content refresh (critical)
```

---

## localStorage Dependencies

| Key | Purpose | What Breaks If Cleared |
|---|---|---|
| `claimed_gifts` | Stores customer's claimed gift variant IDs | Customer's gift selections lost; gifts removed on next cart update, customer must re-select |

**Note:** `localStorage` is the ONLY client-side persistence mechanism used by CartX. All other state is either in Shopify's cart (server-side) or recomputed on every page load.

---

## Fetch Interception

CartX intercepts `window.fetch` on load (lines 1-21 of `cartx.js`):

```
Original: window.fetch → Shopify servers
After CartX: window.fetch → CartX interceptor → blocks non-CartX cart calls
             originalFetch → Shopify servers (used by CartX internally)
```

**What this means:**
- Any other theme script or app that uses `fetch('/cart/update.js')` will be BLOCKED
- CartX saves the original `fetch` as `originalFetch` and uses that for its own API calls
- Console-based cart manipulation (`fetch('/cart/add.js', ...)`) is also blocked

**What breaks if interception is removed:**
- Other scripts can modify the cart outside CartX's knowledge
- `user_cart` global becomes stale → gift logic, threshold calculations, and quantity displays become incorrect
- **Severity: Medium-High** — CartX assumes it has exclusive control of cart mutations

---

## Safety Mechanisms

### Loader Timeout
- `startLoader()` sets a 10-second timeout that forces `stopLoader()` and resets `isProcessing`
- Prevents permanent loading state if an API call hangs
- **If removed:** A failed network request could lock the cart permanently until page reload

### isProcessing Mutex
- Only one `cartx()` call can run at a time
- Additional clicks during processing only update the UI (`updateQuantity()`) without API calls
- **If removed:** Race conditions — concurrent `/cart/update.js` calls would conflict, potentially losing items or duplicating gifts

### Retry Logic (Cart Total Mismatch)
- After `/cart/update.js`, CartX compares expected vs actual `total_price`
- If mismatched, retries `cartx()` recursively (max 3 times via `MAX_CARTX_RETRIES`)
- **If removed:** Cart could show incorrect totals or have missing gift items after certain operations

### Unavailable Gift Retry
- Failed gift variant IDs tracked in `unavailableGiftVariants`
- 60-second cooldown before retrying (`UNAVAILABLE_GIFT_RETRY_INTERVAL`)
- **If removed:** Every cart update would attempt to add unavailable variants, causing repeated API errors

### Error Handler (retryCartUpdate)
- On `/cart/update.js` failure with variant-not-found errors
- Parses error response, identifies failed variant IDs
- Removes them from payload and retries once
- **If removed:** Any OOS gift variant would cause the entire cart update to fail (all items, not just the gift)

---

## Critical vs Optional Components

### Critical (Cart Non-Functional Without These)

| Component | Why Critical |
|---|---|
| `cartx.js` | All cart logic — without it, no ATC, no drawer, no updates |
| `cartx-drawer.css` | Without styles, drawer is invisible or broken layout |
| `/cart/update.js` API | All cart mutations go through this single endpoint |
| `?sections=cartx-drawer` API | Drawer content never refreshes without this |
| `metaobject` body attribute | `JSON.parse(null)` crashes `cartx()` if missing |
| `cartfreebie` body attribute | Same — null parse crash |
| `sections/cartx-drawer.liquid` | Section definition required for section rendering |
| `layout/theme.liquid` (CartX parts) | Loads assets, sets body attributes, includes global elements |

### Important (Feature Degrades Without These)

| Component | Degradation |
|---|---|
| `bogooffers` body attribute | BOGO offers silently disabled |
| `claimgift` body attribute | Claim gift feature silently disabled |
| `oosgiftvariants` body attribute | No pre-computed OOS list; relies on runtime error handling |
| `site_gwp` metaobject | GWP feature completely disabled |
| `cart_freebie` metaobject | Product freebies disabled |
| `customer.tags` | All customers treated as non-VIP |
| `localStorage` | Claimed gift selections not persisted across pages |

### Optional (Cosmetic or Fallback Exists)

| Component | Impact If Missing |
|---|---|
| Lottie CDN | No confetti animation; console error but no functional impact |
| AI Upsell API | AI mode empty; product-based upsell still works |
| `custom.cartx_upsell_products` metafield | Falls back to section settings or AI |
| Trust badges snippet | No badges shown; purely visual |
| Announcement ribbon | No ribbon; cart still fully functional |
| Sign-in prompt | Currently commented out anyway |
| Confetti container (`#cartx-confetti`) | No confetti; no error if Lottie also missing |

---

## Known Risks and Warnings

1. **Hardcoded API credentials:** The AI upsell Bearer token is hardcoded in `cartx.js`. If the token expires or is rotated, AI upsell silently fails.

2. **Hardcoded currency:** Multiple snippets use `₹` symbol and Indian Rupee formatting. Internationalization would require changes across 5+ files.

3. **Hardcoded shipping:** `snippets/cartx-order-summary.liquid` has hardcoded "₹49" shipping that's crossed out as "FREE". This is not connected to actual Shopify shipping rates.

4. **Duplicate metaobject resolution:** Both `sections/cartx-drawer.liquid` and `layout/theme.liquid` independently resolve the page-specific metaobject entry. If the logic diverges, Liquid rendering and JS data will be inconsistent.

5. **Hand-built BOGO JSON:** The `bogooffers` body attribute is manually constructed via Liquid loops in `theme.liquid`, not using the `| json` filter. Any change to the BOGO metaobject structure requires updating the Liquid template to match.

6. **No custom events:** CartX does not dispatch custom DOM events. Third-party scripts cannot listen for cart changes — they must either use MutationObserver on `.cartx-drawer-inner` or hook into the fetch interception layer.

7. **Free gift price assumption:** `freeGiftPrice = 100` (₹1 in cents) is hardcoded. If Shopify's gift pricing changes, freebie detection breaks silently.
