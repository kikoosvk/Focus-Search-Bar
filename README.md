# Focus Search Bar

Press **Ctrl+Space** (Control, including on macOS), or click the extension's
toolbar button, to focus and select a suitable search field on the current page.
The extension runs only when invoked, on HTTP/HTTPS pages. Chrome internal pages,
the Chrome Web Store, and other restricted pages cannot be scripted; invoking the
extension there has no effect.

## Change the shortcut

Open `chrome://extensions/shortcuts`, find **Focus Search Bar**, and edit or clear
**Focus the page’s search field**. Chrome manages the binding; after remapping,
the old shortcut no longer activates this extension. The toolbar button also
works when no shortcut is assigned. Bare `/` activation is not supported.

OS/browser shortcuts and other extensions can conflict with the suggested
default. In particular, macOS may use Control+Space to switch input sources
([Apple keyboard shortcuts](https://support.apple.com/en-ie/102650)). If the
shortcut is unassigned or intercepted, choose another combination on Chrome's
shortcuts page. The shortcut works while Chrome has focus.

When updating an unpacked copy from the previous implementation, reload existing
web pages as well as the extension to clear the old injected keyboard listeners.

## Search detection

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
