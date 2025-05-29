# Admin Keyword Page Enhanced Function

Tampermonkey script that enhances the keyword management interface in the Hourloop Amazon Ads Admin Panel using Tabulator.

## 📌 Description

This script improves the interactivity and efficiency of working with the keyword table by enabling:

### ✅ Key Features

- **Row Highlighting**:
  - Hover: Red border
  - Selected: Yellow border
- **Selection Tracker**: Floating count of selected rows
- **Keyboard Shortcuts**:
  - `Enter`: Toggle current hovered row selection
  - `Cmd/Ctrl + ↑ / ↓`: Move selection up/down
  - `Cmd/Ctrl + E`: Toggle select all / deselect all
  - `Cmd/Ctrl + F`: Auto-select rows where:
    - keyword is more than one word
    - target_quality is "Unknown"
    - state is not "Archived"
  - `Cmd/Ctrl + B`: Clear all highlighting and deselect
  - `Cmd/Ctrl + 1 / 2 / 3 / C`: Trigger header menu options for sorting or filtering
- **Scroll Buttons**:
  - Top-right buttons for scroll to top / bottom
  - Expand / collapse grouped rows
- **Auto-scroll to first selected row**

## 🧠 Hidden Utilities

- `sortByCheckBox()`: Triggers sorting on checkbox column
- `isSingleSpace(str)`: Helper for keyword spacing filter

## 🌐 Match URL

- `https://admin.hourloop.com/amazon_ads/sp/keywords?*`

## 🛠 Requirements

- Browser with Tampermonkey extension installed
- Table must use `#keywords-table` as Tabulator selector

## 📥 Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Create a new script and paste in `Admin_Keyword_Page_Enhanced_Function.user.js`
3. Save and activate it for the matching page
