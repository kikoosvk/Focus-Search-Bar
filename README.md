# Focus Search Bar

Jump to a page's search field with a keyboard shortcut. Focus Search Bar focuses
a suitable field and selects its existing text so you can start typing. It does
not enter a query or submit a search.

The suggested shortcut is **Ctrl+Space** (**Control+Space** on Mac). Click the
extension's toolbar icon to see your assigned shortcut or change it.

## Set or change your shortcut

Click the toolbar icon, then **Change shortcut** or **Set shortcut**. Find
**Focus Search Bar** in Chrome's shortcut settings and enter your preferred
combination. You can also open `chrome://extensions/shortcuts` directly.

If no shortcut is assigned, the popup displays **No shortcut assigned**.

## Troubleshooting

- If the shortcut does nothing, check its assignment and make sure Chrome has
  focus. Try a different combination if it conflicts with another extension or
  an operating-system shortcut. On Mac, Control+Space may switch input sources.
- The page must have a suitable search field. Chrome internal pages, the Chrome
  Web Store, and non-HTTP/HTTPS pages are not supported.
- Detection depends on the page's markup. Generic wording detection uses English
  search terms. Custom editable widgets, fields inside iframes, and Shadow DOM
  are not supported.
- After upgrading from the old implementation, refresh already-open pages to
  clear its keyboard listeners.

## Privacy

Page information is processed locally when you use the shortcut. The extension
does not save, log, or transmit it. See [Privacy](PRIVACY.md).

## Install and develop locally

1. Clone this repository or download and extract its source archive.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Check your shortcut through the toolbar icon, then try it on a page with a
   search field.

After editing extension files, click **Reload** on its card at
`chrome://extensions` and refresh the page being tested.

## Tests

Requires Node.js 18+ and an installed Chrome or Chromium browser. No npm packages
or browser download are required. From the repository root:

```sh
node --test tests/*.test.mjs
node tests/run-browser-tests.mjs
```

If the browser is not detected automatically:

```sh
CHROME_BIN="/path/to/chrome" node tests/run-browser-tests.mjs
```

Node tests use mocked Chrome APIs. Browser tests check detection, focus, and
selection on local fixtures in headless Chrome with a temporary profile. They
do not install the extension or verify live websites or OS shortcut delivery.

For a local page to test the installed extension:

```sh
node tests/run-browser-tests.mjs --manual
```

Open the printed URL in a separate Chrome profile with the extension loaded.
The page only reports what happens; it does not activate the extension itself.
Check shortcut activation, remapping, and the popup's assigned/unassigned states.
Stop the server with Ctrl+C.

Recorded on 2026-11-01: **26/26 Node tests and 154/154 browser tests passed** with
Node.js 24.18.0 and Chrome 156.0.8078.74 on macOS ARM64. Manual checks also passed
for popup states, settings navigation, keyboard accessibility, and remapped
shortcuts. Default Control+Space delivery, other operating systems, and
Store-managed upgrades were not verified.

## Package a local release candidate

Requires Python 3.8+ with no additional dependencies. Run the tests above, then:

```sh
python3 scripts/package-release.py
```

This creates `dist/focus-search-bar-<version>-rc.zip` and its `.zip.sha256`
checksum using the manifest version. Use `--output-dir /path/to/output` to
choose another location.

The package includes the manifest, runtime scripts, popup HTML/CSS, icons, and
license. Tests and development files are excluded. Fixed ZIP metadata makes
unchanged inputs produce identical packages. The script validates the archive
but does not install or publish it. To test the actual package, extract the ZIP
and load that extracted folder through **Load unpacked**.
