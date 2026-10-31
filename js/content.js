function hasSearchWords(value) {
    const words = (value || '')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u);
    return words.some(word => word === 'search' || word === 'searchbox');
}

function hasSearchAttributes(element) {
    const isControl = isSupportedSearchControl(element);
    const attributes = ['id', 'name', 'aria-label'];
    if (isControl) attributes.push('placeholder');
    // Named form controls can shadow methods on the form itself.
    const values = attributes.map(attribute => Element.prototype.getAttribute.call(element, attribute));
    const labelIds = (Element.prototype.getAttribute.call(element, 'aria-labelledby') || '').trim().split(/\s+/);
    for (const id of labelIds) {
        values.push(document.getElementById(id)?.textContent);
    }
    for (const label of isControl ? element.labels : []) {
        values.push(label.textContent);
    }
    return values.some(hasSearchWords);
}

function isSupportedSearchControl(element) {
    return element.tagName === 'TEXTAREA' ||
        (element.tagName === 'INPUT' && ['text', 'search'].includes(element.type));
}

function getSearchCandidates(hostname = window.location.hostname) {
    const tiers = [[], [], [], []];
    const isGoogle = hostname === 'google.com' || hostname === 'www.google.com';
    for (const element of document.querySelectorAll('input, textarea')) {
        if (!isSupportedSearchControl(element)) {
            continue;
        }
        // Assign each control to its strongest signal, preserving DOM order per tier.
        if (isGoogle && element.getAttribute('name') === 'q') {
            tiers[0].push(element);
        } else if (element.type === 'search' || element.getAttribute('role') === 'searchbox') {
            tiers[1].push(element);
        } else if (element.closest('search, [role="search"]') ||
            (element.form && hasSearchAttributes(element.form))) {
            tiers[2].push(element);
        } else if (hasSearchAttributes(element)) {
            tiers[3].push(element);
        }
    }
    return tiers.flat();
}

function isEligibleSearchField(element) {
    if (!element.isConnected || !isSupportedSearchControl(element) ||
        element.readOnly || element.matches(':disabled')) {
        return false;
    }
    // Visibility is inherited, but a descendant can explicitly make itself visible.
    const visibility = getComputedStyle(element).visibility;
    if (visibility === 'hidden' || visibility === 'collapse') {
        return false;
    }
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        if (Element.prototype.hasAttribute.call(ancestor, 'hidden') ||
            Element.prototype.hasAttribute.call(ancestor, 'inert') ||
            Element.prototype.getAttribute.call(ancestor, 'aria-hidden')?.toLowerCase() === 'true') {
            return false;
        }
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }
    }
    return Array.from(element.getClientRects()).some(rect => rect.width > 0 && rect.height > 0);
}

function focusSearchField(hostname = window.location.hostname) {
    for (const element of getSearchCandidates(hostname)) {
        if (!isEligibleSearchField(element)) {
            continue;
        }
        try {
            element.focus();
        } catch {
            continue;
        }
        if (document.activeElement !== element) {
            continue;
        }
        try {
            if (typeof element.select === 'function') {
                element.select();
            }
        } catch {
            // Selection is optional; keep the field that successfully received focus.
        }
        return;
    }
}

focusSearchField();
