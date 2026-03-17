# CartX Metafields and Settings

---

## Metafields

### 1. `custom.cartx_upsell_products`

| Property | Value |
|---|---|
| **Namespace.key** | `custom.cartx_upsell_products` |
| **Owner type** | Product |
| **Type** | List of product references |
| **Example** | List of 3-5 product handles |
| **Where read (Liquid)** | `snippets/cartx-ai-upsell.liquid` line 4: `metafield_product.metafields.custom.cartx_upsell_products` |
| **Where read (JS)** | N/A (Liquid renders the products; JS only binds ATC events) |
| **Logic** | If the LAST item added to cart has this metafield set, its products are shown as upsells. Takes priority over section settings and AI upsell. |

### 2. `custom.badges` (NOT CartX-specific)

| Property | Value |
|---|---|
| **Namespace.key** | `custom.badges` |
| **Owner type** | Product |
| **Type** | Unknown / Needs confirmation |
| **Where read** | Referenced in theme product cards, not in CartX drawer |
| **Relevance** | Not used by CartX — included here for completeness |

---

## Section Settings (cartx-drawer section)

Defined in `sections/cartx-drawer.liquid` schema block.

### Announcement Ribbon Settings

| Setting ID | Type | Default | Where Used | Behavior if Not Set |
|---|---|---|---|---|
| `enable_announcement_ribbon` | checkbox | `true` | `snippets/cartx-drawer.liquid` line 34 | Ribbon hidden |
| `announcement_ribbon_text_1` | text | (blank) | `snippets/cartx-drawer.liquid` lines 56-68 | Slot 1 not shown |
| `announcement_ribbon_text_2` | text | (blank) | `snippets/cartx-drawer.liquid` lines 70-82 | Slot 2 not shown |
| `announcement_ribbon_text_3` | text | (blank) | `snippets/cartx-drawer.liquid` lines 84-96 | Slot 3 not shown |
| `announcement_ribbon_url_1` | url | (blank) | `snippets/cartx-drawer.liquid` line 58 | Text only, no link |
| `announcement_ribbon_url_2` | url | (blank) | `snippets/cartx-drawer.liquid` line 72 | Text only, no link |
| `announcement_ribbon_url_3` | url | (blank) | `snippets/cartx-drawer.liquid` line 86 | Text only, no link |
| `announcement_ribbon_autoplay` | checkbox | `true` | `snippets/cartx-drawer.liquid` line 49, inline JS | No rotation |
| `announcement_ribbon_rotation_speed` | range (2-10, step 1, unit sec) | `3` | `snippets/cartx-drawer.liquid` line 49, inline JS | 3 seconds default |

### Empty Cart Settings

| Setting ID | Type | Default | Where Used | Behavior if Not Set |
|---|---|---|---|---|
| `empty_cart_image` | image_picker | (blank) | `snippets/cartx-drawer.liquid` lines 120-128 | No image shown, `cartx-drawer-inner-empty--no-image` class added |
| `empty_cart_url` | url | (blank) | `snippets/cartx-drawer.liquid` line 133 (commented out) | Falls back to `/collections/all` (currently commented out) |

### Upsell Settings

| Setting ID | Type | Default | Where Used | Behavior if Not Set |
|---|---|---|---|---|
| `enable_product_base_upsell` | checkbox | `false` | `snippets/cartx-drawer.liquid` line 16 (via `ai-cart-upsell` attr), `snippets/cartx-ai-upsell.liquid` line 68 | AI upsell mode is used instead |
| `product_base_upsell_products` | product_list | (blank) | `snippets/cartx-ai-upsell.liquid` lines 82-133 | Falls through to AI upsell |

**Upsell mode logic:**
- If `enable_product_base_upsell = false` → `ai-cart-upsell="true"` → AI mode
- If `enable_product_base_upsell = true` → `ai-cart-upsell="false"` → product-based mode
- Within product-based mode: product metafield > section settings > empty container

### Gift Unavailable Message

| Setting ID | Type | Default | Where Used | Behavior if Not Set |
|---|---|---|---|---|
| `gift_unavailable_message` | text | `"Gift product is out of stock"` | `snippets/cartx-drawer.liquid` lines 326-330 | Shows default text |

---

## Global Theme Settings (NOT CartX-specific but referenced)

These are defined in `config/settings_schema.json` and belong to the base Prestige theme. CartX does NOT use them directly, but they exist in the cart settings group:

| Setting ID | Type | Default | Notes |
|---|---|---|---|
| `cart_type` | select | `"page"` | Theme's own cart type. CartX overrides this entirely. |
| `cart_icon` | select | `"tote_bag"` | Cart icon style in header. Used by theme, not CartX. |
| `cart_show_free_shipping_bar` | checkbox | `false` | Theme's own shipping bar. CartX has its own progress bar. |
| `cart_free_shipping_threshold` | text | `"50"` | Theme's shipping threshold. Not used by CartX. |
| `currency_code_enabled` | checkbox | (unknown) | Used in `cartx-cart-item.liquid` for appending currency code to prices. |

---

## Current Live Settings (from settings_data.json)

```json
{
  "cartx-drawer": {
    "type": "cartx-drawer",
    "settings": {
      "enable_announcement_ribbon": true,
      "announcement_ribbon_text_1": "Test 1",
      "announcement_ribbon_text_2": "Test 2",
      "announcement_ribbon_text_3": "get free gift above 1500 free free free free",
      "announcement_ribbon_url_3": "shopify://products/92-snail-mucin-collagen-boost-moisturizer",
      "announcement_ribbon_autoplay": true,
      "announcement_ribbon_rotation_speed": 3,
      "enable_product_base_upsell": true,
      "product_base_upsell_products": [
        "anti-pigmentation-duo",
        "anti-dandruff-conditioner-with-tea-tree-extracts-180-ml",
        "anti-dandruff-shampoo-with-tea-tree-extracts-250-ml",
        "clear-skin-kit-with-matcha-green-tea"
      ],
      "gift_unavailable_message": "Gift product is out of stock"
    }
  }
}
```

---

## Body Attributes (Data Bridge: Liquid → JS)

These attributes on `<body>` are the critical bridge between Liquid and JavaScript:

| Attribute | Source | Format | Where Read in JS |
|---|---|---|---|
| `final_matched_object` | `final_matched_object \| json \| escape` | Full metaobject JSON | Not directly read by JS (available for debugging) |
| `metaobject` | `final_matched_object.gift_manage.value \| json \| escape` | JSON array of gift rules | `cartx.js` line 776: `JSON.parse(document.body.getAttribute("metaobject"))` |
| `cartfreebie` | `shop.metaobjects.cart_freebie.values \| json \| escape` | JSON array of freebie rules | `cartx.js` line 777: `JSON.parse(document.body.getAttribute("cartfreebie"))` |
| `claimgift` | `final_matched_object.claim_gift.value \| json \| escape` | JSON array of claim gift rules | `cartx.js` line 781: `JSON.parse(document.body.getAttribute("claimgift"))` |
| `bogooffers` | Hand-crafted JSON in theme.liquid | JSON array of BOGO offer objects | `cartx.js` line 1043: `JSON.parse(document.body.getAttribute("bogooffers"))` |
| `oosgiftvariants` | Comma-separated variant IDs | String `"111,222,333"` | `cartx.js` line 36: `document.body.getAttribute("oosgiftvariants")` |

**Important:** The `bogooffers` attribute is NOT using `| json` filter. It's hand-built in `theme.liquid` lines 192 using Liquid loops. This means the JSON structure is manually controlled and must be kept in sync with the JS parser.
