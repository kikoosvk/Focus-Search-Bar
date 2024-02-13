let isCtrlPressed = false;
const CTRL_KEY = 'Control';
const SPACE_KEY_CODE = 'Space';
const resetTimeoutTimeInMs = 2500;
let resetTimeoutID;

function keyDownEvent(e) {
    if (e.key === CTRL_KEY) {
        isCtrlPressed = true;
        resetAfterTimeout();
        return;
    }
    if (e.code === SPACE_KEY_CODE && e.ctrlKey) {
        e.preventDefault();
    }
}

function keyUpEvent(e) {
    if (e.key === CTRL_KEY) {
        setTimeout(() => {
            resetIsCtrlPressedTimeout();
        }, 150);
        return;
    }
    if (e.code === SPACE_KEY_CODE && isCtrlPressed === true) {
        const bar = getSearchBarElement();
        if (bar) {
            bar.focus();
            bar.select();
        }
        isCtrlPressed = false;
    }
}

function getSearchBarElement() {
    let bar = getSpecificSearchElement();
    if (!bar) {
        bar = getVisibleSearchBarElement('[type="search"]');
    }
    if (!bar) {
        bar = getVisibleSearchBarElement('[type="text"]');
    }
    if (!bar) {
        bar = getVisibleSearchBarElement('[autocomplete="off"]');
    }
    return bar;
}

function getSpecificSearchElement() {
    if (window.location.hostname.includes("google")) {
        return document.querySelectorAll('[autocomplete="off"]')[1];
    }
    return undefined;
}

function getVisibleSearchBarElement(selector) {
    let nodes = document.querySelectorAll(selector);
    return Array.from(nodes).find(e => checkDisplayNotNone(e) && checkAreNotHidden(e));
}

function checkAreNotHidden(e) {
    const ariaHidden = e.attributes["aria-hidden"];
    return (ariaHidden === undefined || ariaHidden.value === 'false');
}

function checkDisplayNotNone(e) {
    return e.style.display !== 'none';
}

function resetAfterTimeout() {
    if (!resetTimeoutID) {
        resetTimeoutID = setTimeout(() => {
            resetIsCtrlPressedTimeout();
        }, resetTimeoutTimeInMs);
    }
}

function resetIsCtrlPressedTimeout() {
    const id = resetTimeoutID;
    resetTimeoutID = undefined;
    isCtrlPressed = false;
    clearTimeout(id);
}

document.addEventListener('keydown', keyDownEvent, { capture: true });
document.addEventListener('keyup', keyUpEvent, { capture: true });
