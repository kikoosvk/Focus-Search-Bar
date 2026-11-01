import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
const workerSource = await readFile(new URL('../js/service-worker.js', import.meta.url), 'utf8');
const currentTab = { id: 12, url: 'https://example.com/' };

function worker({ tabs = [currentTab], queryError, injectionError } = {}) {
    const listeners = { command: [], action: [] };
    const queries = [];
    const injections = [];
    const copy = value => JSON.parse(JSON.stringify(value));
    runInNewContext(workerSource, {
        chrome: {
            commands: { onCommand: { addListener: listener => listeners.command.push(listener) } },
            action: { onClicked: { addListener: listener => listeners.action.push(listener) } },
            tabs: { query: async options => {
                queries.push(copy(options));
                if (queryError) throw new Error(queryError);
                return tabs;
            } },
            scripting: { executeScript: async options => {
                injections.push(copy(options));
                if (injectionError) throw new Error(injectionError);
                return [];
            } }
        }
    });
    // These assertions run before yielding: registration must be synchronous.
    assert.equal(listeners.command.length, 1);
    assert.equal(listeners.action.length, 0);
    assert.deepEqual(queries, []);
    assert.deepEqual(injections, []);
    return { command: listeners.command[0], action: listeners.action[0], queries, injections };
}

test('manifest exposes one browser-managed command and only on-demand permissions', () => {
    assert.equal(manifest.manifest_version, 3);
    assert.match(manifest.version, /^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){0,3}$/);
    const versionParts = manifest.version.split('.').map(Number);
    assert.equal(versionParts.join('.'), manifest.version, 'Version must use canonical numeric components');
    assert.ok(versionParts.every(part => part <= 65535), 'Version components must be at most 65535');
    assert.ok(versionParts.some(part => part > 0), 'Version must not be all zero');
    assert.deepEqual(manifest.commands, {
        'focus-search-field': {
            suggested_key: { default: 'Ctrl+Space', mac: 'MacCtrl+Space' },
            description: 'Focus the page’s search field'
        }
    });
    assert.deepEqual(manifest.permissions, ['activeTab', 'scripting']);
    assert.deepEqual(manifest.background, { service_worker: 'js/service-worker.js' });
    for (const key of ['content_scripts', 'host_permissions', 'optional_permissions',
        'optional_host_permissions', 'options_page', 'options_ui']) {
        assert.equal(key in manifest, false, `Unexpected manifest key: ${key}`);
    }
    assert.equal(manifest.action.default_popup, 'popup.html');
    assert.equal(manifest.action.default_title, 'View or change your shortcut');
    assert.deepEqual(manifest.action.default_icon, manifest.icons);
});

test(`command: supplied tab is used exactly once per invocation without a query`, async () => {
    const instance = worker();
    for (const tab of [currentTab, { id: 0, url: 'http://localhost/' }, currentTab]) {
        await instance.command('focus-search-field', tab);
    }
    assert.deepEqual(instance.queries, []);
    assert.deepEqual(instance.injections, [12, 0, 12].map(tabId => ({
        target: { tabId }, files: ['js/content.js']
    })));
});

test(`command: unavailable and restricted tabs are harmless`, async () => {
    const instance = worker();
    for (const tab of [{}, { id: -1, url: currentTab.url }, { id: '12', url: currentTab.url },
        { id: 1.5, url: currentTab.url }, { id: 12 }, { id: 12, url: null },
        ...['', 'chrome://extensions/', 'chrome-extension://other/page.html',
            'about:blank', 'file:///tmp/search.html', 'data:text/html,test']
            .map(url => ({ id: 12, url }))]) {
        await instance.command('focus-search-field', tab);
    }
    assert.deepEqual(instance.queries, []);
    assert.deepEqual(instance.injections, []);
});

test(`command: injection rejection is consumed without retries`, async () => {
    const instance = worker({ injectionError: 'Cannot access this page or tab was closed' });
    await instance.command('focus-search-field', { id: 12, url: 'https://chromewebstore.google.com/' });
    assert.equal(instance.injections.length, 1);
    assert.deepEqual(instance.queries, []);
});

test(`command: a newly started worker handles its first event`, async () => {
    for (let startup = 0; startup < 2; startup++) {
        const instance = worker();
        await instance.command('focus-search-field', currentTab);
        assert.equal(instance.injections.length, 1);
    }
});

test('unknown commands do not query or inject', async () => {
    const instance = worker();
    await instance.command('unknown');
    assert.deepEqual(instance.queries, []);
    assert.deepEqual(instance.injections, []);
});

test('command without a tab resolves the active tab once', async () => {
    const instance = worker();
    await instance.command('focus-search-field');
    assert.deepEqual(instance.queries, [{ active: true, lastFocusedWindow: true }]);
    assert.deepEqual(instance.injections, [{ target: { tabId: 12 }, files: ['js/content.js'] }]);
});

test('missing active tab and rejected tab query are harmless', async () => {
    for (const options of [{ tabs: [] }, { queryError: 'No browser window available' }]) {
        const instance = worker(options);
        await instance.command('focus-search-field');
        assert.equal(instance.queries.length, 1);
        assert.deepEqual(instance.injections, []);
    }
});

test('toolbar has no focus listener', () => {
    const instance = worker();
    assert.equal(instance.action, undefined);
    assert.deepEqual(instance.queries, []);
    assert.deepEqual(instance.injections, []);
});
