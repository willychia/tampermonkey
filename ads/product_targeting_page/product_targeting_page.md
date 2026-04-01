# Admin Product Page Enhanced Function

Tampermonkey script that enhances the product targeting page in the Hourloop Amazon Ads Admin Panel using Tabulator.js.

## Description

This script improves the interaction and usability of the product targeting table.

## Core Features

- Hovered rows get a red border.
- Selected rows get a yellow border.
- A floating counter shows the current selected-row count.
- Floating buttons expand or collapse groups and jump to the top or bottom of the page.
- An ASIN box selects rows that match pasted ASIN values.

## Keyboard Shortcuts

- `Enter`: Toggle the hovered row
- `Cmd/Ctrl + A`: Select matching rows and update the bid to `min(1, CPC)`
- `Cmd/Ctrl + E`: Select or deselect active rows
- `Cmd/Ctrl + B`: Clear selection
- `Cmd/Ctrl + S`: Export the table to Excel
- `Cmd/Ctrl + ↑ / ↓`: Move the selection
- `Cmd/Ctrl + 1 / 2 / 3 / 4 / X`: Trigger configured Tabulator header menu actions

## Stability Notes

- The script avoids duplicate UI injection on page re-render.
- The script safely rebinds to a recreated Tabulator instance.

## Match URL

- `https://admin.hourloop.com/amazon_ads/sp/product_targets?*`
