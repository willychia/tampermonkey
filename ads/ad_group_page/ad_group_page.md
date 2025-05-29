# Admin Ad Group Additional Function

This Tampermonkey script enhances the Tabulator table used in the Amazon Ads Admin interface on Hourloop.

## 📌 Description

The script provides a suite of UI and functional enhancements for interacting with ad groups, including:

### ✅ Core Features

- **Hover Highlighting**: Rows highlight red when hovered.
- **Row Selection Border**: Selected rows get a white border.
- **Selection Counter**: Top-right floating display of selected row count.
- **Keyboard Shortcuts**:
  - `Enter`: Toggle selection of hovered row.
  - `Cmd/Ctrl + ↑ / ↓`: Move selection up/down.
  - `Cmd/Ctrl + E`: Select or deselect all.
  - `Cmd/Ctrl + F`: Highlight rows where `num_enabled_targets < 10` and auto-scroll to topmost match.
  - `Cmd/Ctrl + B`: Clear highlighting and selections.
  - `Cmd/Ctrl + D`: Open product image links from selected rows.
  - `Cmd/Ctrl + K`: Open `num_enabled_targets` links from selected rows.
  - `Cmd/Ctrl + S`: Export filtered table data to Excel.
  - `Cmd/Ctrl + J`: Select all rows with missing product image URLs.
  - `Cmd/Ctrl + 1-5, C`: Clicks column header menu items by index.
- **Scroll Buttons**: Buttons in lower-right corner for scrolling to top/bottom.
- **Group Expand/Collapse Buttons**: Buttons to expand/collapse grouped rows.
- **ASIN Filter Box**: Manually enter ASINs to auto-select matching rows.

## 🌐 Match URL

- `https://admin.hourloop.com/amazon_ads/sp/ad_groups?*`

## 🛠 Requirements

- Browser with Tampermonkey extension
- Page must use a Tabulator instance with `#ad-groups-table` ID

## 📥 Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Create a new script and paste the contents of `Admin Ad Group Additional Function-2.0.user.js`
3. Save the script and ensure it is enabled when visiting the matched URL.

