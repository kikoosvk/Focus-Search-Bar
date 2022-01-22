var isCtrlPressed = false;
const CTRL_KEY_CODE = 17;
const SPACE_KEY_CODE = 32;
const resetTimeoutTimeInMs = 2500;
var resetTimeoutID;

function keyDownEvent(e) {
    var keyid = e.keyCode;
    if (keyid === CTRL_KEY_CODE) {
        isCtrlPressed = true;
        resetAfterTimeout();
    }
}

function keyUpEvent(e) {
    var keyid = e.keyCode;
    if (keyid === CTRL_KEY_CODE) {
        setTimeout(() => {
            resetIsCtrlPressed();
        }, 150);
    }

    if (keyid === SPACE_KEY_CODE && isCtrlPressed === true) {
        const bar = getSearchBarElement();
        if (bar) {
            bar.focus();
            bar.select();
        }
        isCtrlPressed = false;
    }
}

function getVisibleSearchBarElement(selector) {
    let nodes = document.querySelectorAll(selector);
    return Array.from(nodes).find(e => {
        const ariaHidden = e.attributes["aria-hidden"];
        const displayNotNone = e.style.display !== 'none';
        return displayNotNone && (ariaHidden === undefined || ariaHidden.value === 'false');
    })
}

function getSearchBarElement() {
    let bar = getVisibleSearchBarElement('[type="search"]');
    if (!bar) {
        bar = getVisibleSearchBarElement('[type="text"]');
    }
    if (!bar) {
        bar = getVisibleSearchBarElement('[autocomplete="off"]');
    }
    return bar;
}

function resetAfterTimeout() {
    if (!resetTimeoutID) {
        resetTimeoutID = setTimeout(() => {
            resetIsCtrlPressed();
        }, resetTimeoutTimeInMs);
    }
}

function resetIsCtrlPressed() {
    const id = resetTimeoutID;
    resetTimeoutID = undefined;
    isCtrlPressed = false;
    clearTimeout(id);
}

document.onkeydown = keyDownEvent;
document.onkeyup = keyUpEvent;
