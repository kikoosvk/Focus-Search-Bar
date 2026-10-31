# Focus Search Bar

Press **Ctrl+Space** to focus and select a suitable search field on the current page.

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
node tests/run-browser-tests.mjs
```

The runner finds common browser installations, or accepts an explicit executable:

```sh
CHROME_BIN="/path/to/chrome" node tests/run-browser-tests.mjs
```

It serves local fixtures on loopback, launches headless Chrome with a temporary
profile, checks reported results, and cleans up. Failures, missing browsers,
missing results, and timeouts produce a nonzero exit code.

These automated tests use real browser layout, focus, and text selection. Google
hostname cases pass hostnames into the internal detection helper; they do not
visit Google. Keyboard integration uses synthetic events against the actual
content-script listeners. Tests do not load the installed extension or verify
operating-system shortcut delivery or live-site compatibility.
