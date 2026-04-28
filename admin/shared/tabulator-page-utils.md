# Shared Tabulator Page Utils

Shared helper utilities for the Tabulator-based Tampermonkey scripts.

## Purpose

- Keep common table-init logic in one place
- Reuse keyboard-safety helpers across page scripts
- Reuse shared selection, counter, and observer behavior

## Used By

- `admin/product-targeting-page/product-targeting-page.user.js`
- `admin/keyword-targeting-page/keyword-targeting-page.user.js`

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
