# CartX Overview

## What is CartX?

CartX is a custom cart drawer system for Shopify that replaces the default cart page with a slide-out drawer. It manages the entire cart lifecycle including:

- Cart open/close, fetch, and update
- Gift With Purchase (GWP) with tiered thresholds
- BOGO (Buy One Get One) offers with auto-add and bundles
- Product-level freebies (auto-added when trigger product is in cart)
- Claim-a-gift (customer picks a freebie at a price threshold)
- Multi-tier progress bar with visual stages
- Coupon drawer with apply/remove logic
- Product upsells (AI-based, product-metafield-based, and default fallback)
- Price breakup bottom sheet
- Announcement ribbon with rotation
- VIP vs non-VIP customer segmentation (separate offer sets)
- Out-of-stock gift tracking and retry logic
- Fetch interception to block console-based cart manipulation
- Cart page redirect (forces /cart to open drawer instead)

## Architecture Summary

```
layout/theme.liquid
  |-- Loads metaobjects (site_gwp or vip_gwp based on customer tags)
  |-- Computes OOS gift variant IDs
  |-- Serializes data onto <body> attributes
  |-- Includes section: cartx-drawer
  |
  sections/cartx-drawer.liquid
    |-- Computes cart totals (excluding gifts & combos)
    |-- Resolves page-specific metaobject entry
    |-- Passes data to snippet: cartx-drawer
    |
    snippets/cartx-drawer.liquid (910 lines - main orchestrator)
      |-- Renders: announcement ribbon, header, progress bar, claim gift,
      |   cart items (3 loops: regular, discounted non-freebies, freebies),
      |   gift details (locked gift preview), coupon section, upsells,
      |   order summary, trust badges, footer with checkout, price breakup
      |
  assets/cartx.js (2254 lines - the brain)
    |-- Reads metaobject data from <body> attributes
    |-- cartx() function: the main engine
    |-- Computes gift eligibility, BOGO auto-add, freebie rules
    |-- Sends single /cart/update.js call with all changes
    |-- reload_cartx(): fetches section HTML via ?sections=cartx-drawer
    |-- Discount apply/remove via /cart/update.js { discount: "CODE" }
    |-- AI upsell: external API call to AWS Lambda
    |
  assets/cartx-drawer.css (3266 lines - all styling)
```

## Data Flow

1. **Server-side (Liquid):** Metaobjects queried, serialized to `<body>` attributes as JSON
2. **Client-side (JS):** `cartx.js` reads `<body>` attributes, computes rules, builds `cartUpdatedObject`
3. **Single API call:** `POST /cart/update.js` with `{ updates: { variantId: quantity, ... } }`
4. **Section re-render:** `GET /?sections=cartx-drawer` to get fresh HTML, swapped into DOM
5. **Event re-binding:** `bindingEvent()` and `loadedEvents()` re-attach all listeners

## VIP vs Non-VIP

- If `customer.tags contains 'VIP'` → uses `shop.metaobjects.vip_gwp`
- Otherwise → uses `shop.metaobjects.site_gwp`
- Both metaobjects have identical structure, different entries
- Evaluated in both `layout/theme.liquid` and `sections/cartx-drawer.liquid`

## Page-Specific Offers

Metaobject entries have a `page_handle` field (comma-separated paths like `/`, `/collections/foo`).
The system matches `request.path` against these handles. Fallback is the entry with `page_handle = '/'`.

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `assets/cartx.js` | Core JS logic | 2254 |
| `assets/cartx-drawer.css` | All CartX styling | 3266 |
| `sections/cartx-drawer.liquid` | Section wrapper, metaobject resolution, schema | 196 |
| `snippets/cartx-drawer.liquid` | Main drawer HTML, all UI orchestration | 910 |
| `layout/theme.liquid` | Global metaobject loading, OOS computation, body attrs | 236 |
| `snippets/cartx-progressbar.liquid` | Progress bar UI | 200 |
| `snippets/cartx-offer.liquid` | Coupon drawer UI | 175 |
| `snippets/cartx-bogo-offer.liquid` | BOGO offer UI | 167 |
| `snippets/cartx-claim-gift.liquid` | Claim gift UI | 76 |
| `snippets/cartx-gift-details.liquid` | Locked gift preview | 55 |
| `snippets/cartx-cart-item.liquid` | Individual cart line item | 200 |
| `snippets/cartx-ai-upsell.liquid` | Upsell section (3 modes) | 151 |
| `snippets/cartx-cart-ribbon.liquid` | Footer ribbon with dynamic messages | 50 |
| `snippets/cartx-order-summary.liquid` | Order summary breakdown | 72 |

## External Dependencies

- **Lottie (bodymovin 5.7.6):** CDN-loaded, used for confetti animation on coupon apply
- **AI Upsell API:** AWS Lambda endpoint for product recommendations
- **Shopify Section Rendering API:** `?sections=cartx-drawer` for partial re-render
- **No other libraries** (no Swiper, GSAP, Keen-slider, etc.)
