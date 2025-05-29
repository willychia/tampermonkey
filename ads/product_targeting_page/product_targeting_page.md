# Admin Product Page Enhanced Function

Tampermonkey script that enhances the product targeting page in the Hourloop Amazon Ads Admin Panel using Tabulator.js.

## 📌 Description

This script improves the interaction and usability of the product targeting table with features including:

### ✅ Core Features

- **Row Interaction**
  - Hover: Red border
  - Selected: Yellow border

- **Floating UI**
  - Top-right live row selection count
  - Bottom-right buttons: Scroll to top/bottom, expand/collapse groups

- **Keyboard Shortcuts**
  - `Enter`: Toggle hover row selection
  - `Cmd/Ctrl + ↑ / ↓`: Move selection up/down
  - `Cmd/Ctrl + E`: Toggle select all/deselect all
  - `Cmd/Ctrl + F`: Highlight and auto-select rows that:
    - Keyword is more than one word
    - Target Quality is "Unknown"
    - State is not "Archived"
  - `Cmd/Ctrl + B`: Clear selection and row highlights
  - `Cmd/Ctrl + 1 / 2 / 3 / C`: Trigger tabulator column menu actions

- **ASIN Filtering Tool**
  - Floating input box to paste ASINs
  - Automatically selects matching ASIN rows and scrolls to top

- **Utilities**
  - Clipboard copying function
  - Auto sort by checkbox column
  - Auto scroll to first selected row

## 🌐 Match URL

- `https://admin.hourloop.com/amazon_ads/sp/product_targets?*`

## 🛠 Requirements

- Browser with [Tampermonkey](https://tampermonkey.net) extension
- Page with Tabulator table element using ID `#targets-table`

## 📥 Installation

1. Install Tampermonkey
2. Add this script using the `.user.js` file provided
3. Reload the matching page and use the enhancements

