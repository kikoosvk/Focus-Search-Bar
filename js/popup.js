(() => {
    const settingsUrl = 'chrome://extensions/shortcuts';
    const status = document.getElementById('shortcut-status');
    const heading = document.getElementById('shortcut-heading');
    const description = document.getElementById('shortcut-description');
    const button = document.getElementById('shortcut-settings');
    const error = document.getElementById('settings-error');

    async function loadShortcut() {
        try {
            const commands = await chrome.commands.getAll();
            const command = commands.find(({ name }) => name === 'focus-search-field');
            if (!command) throw new Error('Focus command is missing');

            if (command.shortcut) {
                heading.textContent = `Your shortcut: ${command.shortcut}`;
                description.textContent = 'Press it on a webpage to focus its search box.';
                button.textContent = 'Change shortcut';
            } else {
                heading.textContent = 'No shortcut assigned';
                description.textContent = 'Set a shortcut to start using Focus Search Bar.';
                button.textContent = 'Set shortcut';
            }
        } catch {
            heading.textContent = 'Couldn’t read your shortcut';
            description.textContent = 'Open Chrome’s shortcut settings to check your assignment.';
            button.textContent = 'Open shortcut settings';
        } finally {
            status.setAttribute('aria-busy', 'false');
            button.disabled = false;
        }
    }

    button.addEventListener('click', async () => {
        if (button.disabled) return;
        button.disabled = true;
        error.hidden = true;
        try {
            await chrome.tabs.create({ url: settingsUrl });
            window.close();
        } catch {
            error.textContent = `Couldn’t open settings. Try again or open ${settingsUrl} in Chrome.`;
            error.hidden = false;
            button.disabled = false;
        }
    });

    loadShortcut();
})();
