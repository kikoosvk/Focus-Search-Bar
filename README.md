# Focus Search Bar

Focus Search Bar focuses a suitable search field on the current page and attempts
to select its existing text. It does not enter a query or submit a search.

Press **Ctrl+Space** (Control, including on macOS), or click the extension's
toolbar button. Both perform the same action; the toolbar button opens no popup.
You can pin Focus Search Bar through Chrome's Extensions menu for easy access.
The extension runs only when invoked, on HTTP/HTTPS pages. Chrome internal pages,
the Chrome Web Store, and other restricted pages cannot be scripted; invoking the
extension there has no effect. If no suitable field can be focused, it takes no
further action.

## Install an unpacked copy

1. Clone this repository, or download and extract its source archive.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and select the repository root containing `manifest.json`.
4. Open an ordinary HTTP/HTTPS page with a search field and invoke the extension.

For development, edit the local files and click **Reload** on the extension's
card at `chrome://extensions`. Refresh the page before checking the changes.
When upgrading from the previous implementation, reload existing web pages as
well as the extension to clear the old injected keyboard listeners.

## Change the shortcut

Open `chrome://extensions/shortcuts`, find **Focus Search Bar**, and edit or clear
**Focus the page’s search field**. Chrome manages the binding; after remapping,
the old shortcut no longer activates this extension. The toolbar button also
works when no shortcut is assigned. Bare `/` activation is not supported.

The shortcut is a suggested default and may be unassigned if it conflicts with
another binding. It works while Chrome has focus.

## Troubleshooting

If the shortcut does nothing, try the toolbar button on the same page. If that
works, check the assignment at `chrome://extensions/shortcuts` and choose a
different combination if needed. OS/browser shortcuts and other extensions can
conflict with the suggested default. In particular, macOS may use Control+Space
to switch input sources
([Apple keyboard shortcuts](https://support.apple.com/en-ie/102650)). If the
shortcut is unassigned or intercepted, choose another combination on Chrome's
shortcuts page. On macOS the default uses **Control**, not Command.

If neither activation method works, confirm that the extension is enabled and
the page has a suitable search field. `chrome://` pages, the Chrome Web Store,
and other Chrome-restricted pages cannot be scripted. Non-HTTP/HTTPS URLs,
including `file://` pages, are skipped. Restricted-page failures are silent;
there is no error popup. The detection limitations below can also explain why a
field is not focused.

## Search detection and limitations

Detection prefers Google's `name="q"` controls on exactly `google.com` and
`www.google.com`, then search inputs/roles, search containers/forms, and clear
search wording in field attributes or labels. Candidates are tried in document
order within each priority group. Hidden, disabled, inert, read-only, and
unsupported controls are skipped, and unsuccessful focus attempts fall through
to the next candidate.

Generic detection recognizes the English tokens `search` and `searchbox`,
including punctuation and camel-case boundaries. An arbitrary text field,
`autocomplete="off"`, or a name such as `q` or `query` alone is insufficient.
Country-specific Google domains use generic detection. Custom editable widgets,
iframes, and Shadow DOM are not supported.

## Privacy

The extension accesses and processes relevant page information locally only
when invoked. It does not persistently store, log, or transmit that information.
See [Privacy](PRIVACY.md) for the information accessed and permission explanations.

## Regression tests

Requires Node.js 18+ and an installed Chrome or Chromium browser. No npm packages
or downloaded browser are required. From the repository root, run:

```sh
node --test tests/service-worker.test.mjs
node tests/run-browser-tests.mjs
```

The runner finds common browser installations, or accepts an explicit executable:

```sh
CHROME_BIN="/path/to/chrome" node tests/run-browser-tests.mjs
```

It serves local fixtures on loopback, launches headless Chrome with a temporary
profile, checks reported results, and cleans up. Failures, missing browsers,
missing results, and timeouts produce a nonzero exit code.

Node tests check the manifest and service-worker routing with mocked Chrome APIs,
including missing tabs, injection failures, and synchronous event registration.
The browser tests use real layout, focus, and text selection, and repeatedly
execute the production focus script. Google
hostname cases pass hostnames into the internal detection helper; they do not
visit Google. Synthetic keyboard events check that no document shortcut listener
remains. Tests do not load the installed extension or verify operating-system
shortcut delivery, actual worker wake-up, or live-site compatibility.

For installed-extension testing, `node tests/run-browser-tests.mjs --manual`
serves an observation-only fixture on loopback until Ctrl+C. It does not launch
Chrome, install the extension, or invoke its code. Open the printed URL in an
isolated Chrome profile with the unpacked extension loaded.

### Recorded result

On 2026-10-31, at source commit `bbb0912`, both commands above passed:

| Check | Result |
| --- | --- |
| Service-worker and manifest tests | 13/13 passed |
| Browser regression fixtures | 154/154 passed |

Environment: Node.js 24.18.0, Google Chrome 156.0.8078.74, macOS ARM64.
These are results for the test methods described above, not a browser-version
support guarantee.

## Prepare a local release candidate

Packaging requires Python 3.8+ and uses only its standard library. Run the
regression tests above first, then:

```sh
python3 scripts/package-release.py
```

The script validates the release inputs, creates
`dist/focus-search-bar-1.0.8-rc.zip` and its `.zip.sha256` checksum, and verifies
the archive. The filename is derived from the manifest version. To use another
output directory, pass `--output-dir /path/to/output`.

Only the manifest, two runtime scripts, four icons, and license are included.
Entries use fixed metadata and no compression, so unchanged inputs produce
identical ZIP bytes. Packaging validates file structure and configuration; it
does not run the regression suites or install the extension in Chrome.

Version **1.0.8 is an unverified release candidate**, pending developer manual
checks.
