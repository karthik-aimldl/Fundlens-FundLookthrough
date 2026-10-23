# FundScope V2.3 — Browser-Only / No Server Uploads

**Privacy design:** User spreadsheets, calculated investment records, and exports are processed in the browser. No Flask/Python backend, API endpoints, cloud storage, tracking pixels, analytics, CDNs, external fonts, or outgoing data requests are used. `connect-src 'none'` Content Security Policy prohibits browser fetch/XHR/WebSocket/beacon connections from this site. The browser fetches only its static application assets from Render on initial page load. `localStorage` holds **only the colour theme preference**, not investment data. Exported files are saved on the user's device, at the user's request.

## Files

- `index.html` — original V2.3 appearance and navigation, with privacy messaging
- `app.js` — page flow, hierarchy charts, drill-down and exports
- `engine.js` — deterministic parent/child allocation analysis
- `spreadsheet.js` — CSV, XLSX, XLSM reader and XLSX writer, all local
- `vendor/jszip.min.js` — bundled JSZip 3.10.1 (MIT/GPL dual licence), ZIP codec for Excel files. No external network requests
- `render.yaml` — static hosting and restrictive security headers
- `sample-data/fundscope_demo.csv` — fictional demo data

## Run on your computer

Open **`index.html`** in Chrome or Edge. Click **Try synthetic demo data**, verify column mapping and Generate dashboard. Or open a CSV, XLSX, or XLSM file. No Python or internet connection is needed for local use.

## Deploy to Render

1. Create a GitHub repository and upload **the contents of this folder**, with `index.html` at the repository root.
2. On Render select **New → Static Site** and connect that repository.
3. Set `Build command`: `echo "No build required"`.
4. Set `Publish directory`: `.` (a dot). Leave `Root directory` blank.
5. Deploy. You can alternatively deploy via Render Blueprint using `render.yaml`.
6. Once online, verify on a dummy dataset using browser DevTools → Network. There should be **zero network requests on data import, mapping, analysis, and export**. Opening the page itself of course downloads application assets from Render.

## Features retained

- Flexible Parent, Child, Allocation % mapping; optional Parent Amount and Currency.
- Multi-level effective allocations, portfolio summary, consolidated terminal holdings, data-quality checks.
- Hierarchy explorer, Sankey-style flow, sunburst, heatmap, treemap, data table, executive themes.
- Complete or portfolio-filtered Excel, JSON, self-contained HTML snapshot, and Print → PDF.
- 30,000 data row / 20 MB file limits. XLSX/XML ZIP uncompressed-size safety limit.

## Spreadsheet guidance / known limits

- Input data must be in the **first worksheet**, with column headings on row 1. There is no macros execution; `.xlsm` is read as a worksheet archive only.
- Only cached formula values (not the formulas themselves) are read. If a workbook has formulas without saved values, calculate/save it in Excel first.
- Excel formatting beyond percentage-formatted numeric allocation values is not reproduced. A numeric Excel cell formatted `60%` reads as 60, matching the allocation field's expected 0–100 scale.
- CSV is UTF-8 and comma-separated. Password-protected Excel files, legacy `.xls`, multi-sheet merges, and complex pivot data sources are not supported.
- The treemap and sunburst are rendered directly with browser SVG, replacing the previous external D3.js runtime. Treemap is a proportional binary layout, not the older squarify layout.
- The analysis is session-only; refreshing or closing the page clears uploaded data and calculated results. Theme preference alone persists.
- The web host receives normal page requests and connection metadata, but no selected spreadsheet or calculated data is sent by the app. Export files and browser/device behaviour remain the responsibility of the device owner.

## Verify client-side privacy

Open DevTools → Network, select `Fetch/XHR`, import and analyse the sample spreadsheet, then export. Expect **no requests**. The static app is also protected with a CSP prohibiting `connect-src`.

## Third-party library

JSZip 3.10.1 (Dual MIT or GPLv3) is included locally under `vendor/`. License: https://github.com/Stuk/jszip/blob/main/LICENSE.markdown. No other third-party JavaScript dependencies.
