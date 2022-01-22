let isCtrlPressed = false;
const CTRL_KEY_CODE = 17;
const SPACE_KEY_CODE = 32;
const resetTimeoutTimeInMs = 2500;
let resetTimeoutID;

function keyDownEvent(e) {
    const keyCode = e.keyCode;
    if (keyCode === CTRL_KEY_CODE) {
        isCtrlPressed = true;
        resetAfterTimeout();
    }
}

function keyUpEvent(e) {
    const keyCode = e.keyCode;
    if (keyCode === CTRL_KEY_CODE) {
        setTimeout(() => {
            resetIsCtrlPressed();
        }, 150);
    }

    if (keyCode === SPACE_KEY_CODE && isCtrlPressed === true) {
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
    return Array.from(nodes).find(e => checkDisplayNotNone(e) && checkAreNotHidden(e));
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
