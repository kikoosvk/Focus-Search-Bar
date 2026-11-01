async function focusSearchInTab(tab, findActiveTab = false) {
    try {
        if (!tab && findActiveTab) {
            [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        }
        if (!Number.isInteger(tab?.id) || tab.id < 0 ||
            typeof tab.url !== 'string' || !/^https?:\/\//i.test(tab.url)) {
            return;
        }
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['js/content.js']
        });
    } catch {
        // Restricted pages, closed tabs, and navigation can make injection unavailable.
    }
}

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'focus-search-field') {
        return focusSearchInTab(tab, true);
    }
});
