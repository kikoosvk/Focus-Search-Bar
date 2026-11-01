import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../js/popup.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../popup.html', import.meta.url), 'utf8');
const command = shortcut => ({ name: 'focus-search-field', shortcut });
const settle = () => new Promise(resolve => setImmediate(resolve));

function popup({ getAll = async () => [command('Ctrl+Space')], create = async () => {} } = {}) {
    const elements = new Map();
    // Read initial values from the actual markup, including its loading state.
    for (const match of html.matchAll(/<(section|h2|p|button)\b([^>]*\bid="([^"]+)"[^>]*)>([^<]*)/g)) {
        const [, , attributes, id, textContent] = match;
        elements.set(id, {
            textContent,
            disabled: /\bdisabled\b/.test(attributes),
            hidden: /\bhidden\b/.test(attributes),
            attributes: Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)]
                .map(([, name, value]) => [name, value])),
            listeners: {},
            setAttribute(name, value) { this.attributes[name] = value; },
            addEventListener(name, listener) { this.listeners[name] = listener; }
        });
    }
    const calls = { lookups: 0, tabs: [], closes: 0 };
    runInNewContext(source, {
        document: { getElementById: id => {
            assert.ok(elements.has(id), `Missing element: ${id}`);
            return elements.get(id);
        } },
        chrome: {
            commands: { getAll: () => { calls.lookups++; return getAll(); } },
            tabs: { create: options => {
                calls.tabs.push(JSON.parse(JSON.stringify(options)));
                return create(options);
            } }
        },
        window: { close: () => calls.closes++ }
    });
    return {
        heading: elements.get('shortcut-heading'),
        description: elements.get('shortcut-description'),
        button: elements.get('shortcut-settings'),
        status: elements.get('shortcut-status'),
        error: elements.get('settings-error'),
        calls
    };
}

test('popup bundles its external assets and has accessible status and button markup', async () => {
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<h1>Focus Search Bar<\/h1>/);
    assert.match(html, /<button[^>]*type="button"/);
    assert.match(html, /aria-live="polite" aria-atomic="true"/);
    assert.match(html, /role="alert"/);
    assert.match(html, /<script src="js\/popup.js" defer><\/script>/);
    for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        assert.ok((await readFile(new URL(`../${asset}`, import.meta.url))).length);
    }
});

test('loading does not show a default or an unassigned result', async () => {
    let resolve;
    const instance = popup({ getAll: () => new Promise(done => { resolve = done; }) });
    assert.equal(instance.heading.textContent, 'Checking shortcut…');
    assert.equal(instance.description.textContent, '');
    assert.equal(instance.button.disabled, true);
    assert.equal(instance.status.attributes['aria-busy'], 'true');
    assert.equal(instance.error.hidden, true);
    assert.equal(instance.calls.lookups, 1);
    assert.deepEqual(instance.calls.tabs, []);
    resolve([command('Alt+K')]);
    await settle();
    assert.equal(instance.heading.textContent, 'Your shortcut: Alt+K');
    assert.equal(instance.status.attributes['aria-busy'], 'false');
    assert.equal(instance.button.disabled, false);
});

for (const shortcut of ['Ctrl+Space', 'Alt+Shift+K', '⌃Space', 'Command+Shift+F', '<b>Ctrl+K</b>']) {
    test(`displays the exact current assignment: ${shortcut}`, async () => {
        const instance = popup({ getAll: async () => [
            { name: 'unrelated', shortcut: 'Ctrl+X' }, command(shortcut)
        ] });
        await settle();
        assert.equal(instance.heading.textContent, `Your shortcut: ${shortcut}`);
        assert.equal(instance.description.textContent, 'Press it on a webpage to focus its search box.');
        assert.equal(instance.button.textContent, 'Change shortcut');
        assert.equal('innerHTML' in instance.heading, false);
    });
}

for (const shortcut of ['', undefined]) {
    test(`empty or absent assignment uses the unassigned state: ${shortcut}`, async () => {
        const instance = popup({ getAll: async () => [command(shortcut)] });
        await settle();
        assert.equal(instance.heading.textContent, 'No shortcut assigned');
        assert.equal(instance.description.textContent, 'Set a shortcut to start using Focus Search Bar.');
        assert.equal(instance.button.textContent, 'Set shortcut');
    });
}

for (const [name, getAll] of [
    ['missing command', async () => [{ name: 'unrelated', shortcut: 'Ctrl+X' }]],
    ['rejected lookup', async () => { throw new Error('Unavailable'); }],
    ['synchronous failure', () => { throw new Error('Unavailable'); }]
]) {
    test(`${name} reports an unknown assignment rather than unassigned`, async () => {
        const instance = popup({ getAll });
        await settle();
        assert.equal(instance.heading.textContent, 'Couldn’t read your shortcut');
        assert.equal(instance.description.textContent, 'Open Chrome’s shortcut settings to check your assignment.');
        assert.equal(instance.button.textContent, 'Open shortcut settings');
        assert.equal(instance.button.disabled, false);
        assert.equal(instance.status.attributes['aria-busy'], 'false');
    });
}

for (const commands of [[command('Ctrl+Space')], [command('')], []]) {
    test(`settings opens the exact URL and closes after success: ${JSON.stringify(commands)}`, async () => {
        let resolve;
        const instance = popup({
            getAll: async () => commands,
            create: () => new Promise(done => { resolve = done; })
        });
        await settle();
        const pending = instance.button.listeners.click();
        assert.equal(instance.button.disabled, true);
        assert.equal(instance.calls.closes, 0);
        await instance.button.listeners.click();
        assert.deepEqual(instance.calls.tabs, [{ url: 'chrome://extensions/shortcuts' }]);
        resolve();
        await pending;
        assert.equal(instance.calls.closes, 1);
    });
}

test('failed navigation shows the address and permits retry', async () => {
    let attempts = 0;
    const instance = popup({ create: async () => {
        if (++attempts === 1) throw new Error('Unavailable');
    } });
    await settle();
    await instance.button.listeners.click();
    assert.equal(instance.calls.closes, 0);
    assert.equal(instance.button.disabled, false);
    assert.equal(instance.error.hidden, false);
    assert.match(instance.error.textContent, /chrome:\/\/extensions\/shortcuts/);
    await instance.button.listeners.click();
    assert.equal(instance.error.hidden, true);
    assert.equal(instance.calls.tabs.length, 2);
    assert.equal(instance.calls.closes, 1);
});

test('every opening reads the assignment again, including clearing and reassignment', async () => {
    let shortcut = 'Ctrl+Space';
    let lookups = 0;
    const getAll = async () => { lookups++; return [command(shortcut)]; };
    for (shortcut of ['Ctrl+Space', 'Alt+K', '', 'Ctrl+Shift+F']) {
        const instance = popup({ getAll });
        await settle();
        assert.equal(instance.heading.textContent, shortcut ? `Your shortcut: ${shortcut}` : 'No shortcut assigned');
        assert.deepEqual(instance.calls.tabs, []);
    }
    assert.equal(lookups, 4);
});
