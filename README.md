# TamperMonkey Utilities

Tampermonkey scripts for Hourloop Amazon Ads admin pages.

## Scripts

- `ads/product_targeting_page/product_targeting_page.user.js`
  Product targeting helpers for bulk selection, ASIN filtering, and bid updates.
- `ads/keyword_targeting_page/keyword_targeting_page.user.js`
  Keyword targeting helpers for bulk selection, long-tail filtering, and bid updates.
- `ads/ad_group_page/ad_group_page.user.js`
  Ad group helpers for bulk selection, quick-open actions, and scroll-safe batch operations.
- `ads/shared/tabulator_page_utils.js`
  Shared helper utilities used by the Tabulator-based page scripts.

## Chinese Docs

- `ads/product_targeting_page/product_targeting_page_zh.md`
  中文說明：Product Targeting 頁面腳本
- `ads/keyword_targeting_page/keyword_targeting_page_zh.md`
  中文說明：Keyword Targeting 頁面腳本
- `ads/ad_group_page/ad_group_page_zh.md`
  中文說明：Ad Group 頁面腳本

## Install Links

- Product Targeting: `https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/product_targeting_page/product_targeting_page.user.js`
- Keyword Targeting: `https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/keyword_targeting_page/keyword_targeting_page.user.js`
- Ad Group: `https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/ad_group_page/ad_group_page.user.js`

## Maintenance Notes

- Each page script is maintained directly in its `.user.js` file.
- Use the `.user.js` links above for installs and updates so Tampermonkey recognizes them as installable userscripts.
- Product and keyword pages share a common helper via Tampermonkey `@require`.
- The pages rely on Tabulator tables rendered inside the Hourloop admin.
- Page-specific documentation is stored beside each script.
- Versions are date-based so release changes are easy to track.

## Suggested Check Flow

1. Edit the matching `.user.js` page script.
2. Reload the Hourloop page.
3. Test shortcuts on a small result set before using bulk actions broadly.
