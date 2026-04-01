# Shared Tabulator Page Utils

Shared helper utilities for the Tabulator-based Tampermonkey scripts.

## Purpose

- Keep common table-init logic in one place
- Reuse keyboard-safety helpers across page scripts
- Reuse shared selection, counter, and observer behavior

## Used By

- `ads/product_targeting_page/product_targeting_page.user.js`
- `ads/keyword_targeting_page/keyword_targeting_page.user.js`

## Provided Helpers

- `getTableBySelector`
- `isEditingEvent`
- `ensureCounter`
- `ensureButtons`
- `bindSelectionState`
- `sortByField`
- `scrollFirstSelectedToTop`
- `startInitObserver`
- `wait`
