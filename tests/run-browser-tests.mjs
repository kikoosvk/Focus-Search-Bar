import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';

// Serve an observation-only fixture for exercising the actual unpacked extension.
// No production script is injected and no browser profile is changed here.
if (process.argv.includes('--manual')) {
    const body = await readFile(new URL('./manual.html', import.meta.url));
    const server = createServer((request, response) => {
        const isFixture = new URL(request.url, 'http://localhost').pathname === '/';
        response.writeHead(isFixture ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(isFixture ? body : 'Not found');
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    console.log(`Manual fixture: http://localhost:${server.address().port}/`);
    console.log('Load the unpacked extension in an isolated Chrome profile. Ctrl+C stops this server.');
    await new Promise(resolve => {
        process.once('SIGINT', resolve);
        process.once('SIGTERM', resolve);
    });
    await new Promise(resolve => server.close(resolve));
    process.exit(0);
}

const browserCandidates = process.env.CHROME_BIN ? [process.env.CHROME_BIN] : [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
    ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
        .filter(Boolean).map(directory => join(directory, 'Google', 'Chrome', 'Application', 'chrome.exe'))
];

async function findBrowser() {
    for (const candidate of browserCandidates) {
        const paths = isAbsolute(candidate) ? [candidate] :
            (process.env.PATH || '').split(delimiter).map(directory => join(directory, candidate));
        for (const path of paths) {
            try {
                await access(path, constants.X_OK);
                return path;
            } catch {
                // Try the next installed browser location.
            }
        }
    }
    throw new Error('Chrome/Chromium not found. Set CHROME_BIN to its executable path. Browser tests were NOT run.');
}

let server;
let profile;
let browser;
let closed;
try {
    const executable = await findBrowser();
    const routes = new Map(await Promise.all([
        ['/', './browser.html', 'text/html'],
        ['/browser.js', './browser.js', 'text/javascript'],
        ['/content.js', '../js/content.js', 'text/javascript']
    ].map(async ([route, path, type]) => [route, { type, body: await readFile(new URL(path, import.meta.url)) }])));
    // Re-execute the exact production source in the fixture's global scope.
    routes.get('/browser.js').body = `const contentScriptSource = ${JSON.stringify(routes.get('/content.js').body.toString())};\n` +
        routes.get('/browser.js').body;
    server = createServer((request, response) => {
        const resource = routes.get(request.url);
        response.writeHead(resource ? 200 : 404, { 'Content-Type': resource?.type || 'text/plain' });
        response.end(resource?.body || 'Not found');
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    profile = await mkdtemp(join(tmpdir(), 'focus-search-bar-tests-'));
    const url = `http://127.0.0.1:${server.address().port}/`;
    console.log(`Browser: ${executable}`);
    browser = spawn(executable, [
        '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--disable-extensions', '--disable-sync',
        `--user-data-dir=${profile}`, '--dump-dom', url
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    browser.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    browser.stderr.setEncoding('utf8').on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
    closed = new Promise(resolve => browser.once('close', resolve));
    const exitCode = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Browser tests timed out after 30 seconds.')), 30_000);
        browser.once('error', error => { clearTimeout(timeout); reject(error); });
        browser.once('close', code => { clearTimeout(timeout); resolve(code); });
    });
    if (exitCode !== 0) throw new Error(`Chrome exited with code ${exitCode}.\n${stderr}`);
    const serialized = stdout.match(/<script id="test-results" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    if (!serialized) throw new Error(`Browser returned no test results.\n${stderr}`);
    const { results } = JSON.parse(serialized);
    if (!Array.isArray(results) || !results.length || results.some(result => typeof result.passed !== 'boolean')) {
        throw new Error('Browser returned invalid test results.');
    }
    const failures = results.filter(result => !result.passed);
    for (const failure of failures) console.error(`FAIL: ${failure.name}\n  ${failure.error}`);
    console.log(`${results.length - failures.length}/${results.length} browser regression tests passed.`);
    if (failures.length) process.exitCode = 1;
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    if (browser && browser.exitCode === null && browser.signalCode === null) {
        browser.kill('SIGTERM');
        const forceKill = setTimeout(() => browser.kill('SIGKILL'), 2000);
        await closed;
        clearTimeout(forceKill);
    }
    if (server) await new Promise(resolve => server.close(resolve));
    if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
