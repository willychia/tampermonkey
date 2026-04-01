# Admin Ad Group Additional Function

This Tampermonkey script enhances the Tabulator table used in the Amazon Ads Admin interface on Hourloop.

## Description

The script adds selection tools and safer bulk actions for the ad group page.

## Core Features

- Hover highlighting for rows
- Stronger styling for selected rows
- Floating panel with current selection count
- Batch selection by ASIN or ad group name
- Scroll position preservation after sort-driven actions

## Keyboard Shortcuts

- `Enter`: Toggle the hovered row
- `Cmd/Ctrl + E`: Select or deselect active rows
- `Cmd/Ctrl + G`: Select the first N active rows
- `Cmd/Ctrl + B`: Clear selection
- `Cmd/Ctrl + D`: Open selected product links, up to 20 tabs
- `Cmd/Ctrl + ↑ / ↓`: Move the selection
- `Cmd/Ctrl + 1 / 2 / 3 / 4 / 5 / 6 / X`: Trigger configured Tabulator header menu actions

## Stability Notes

- The script safely rebinds after the page recreates the Tabulator instance.
- The panel is created once and then reuses the current table.

## Match URL

- `https://admin.hourloop.com/amazon_ads/sp/ad_groups?*`
