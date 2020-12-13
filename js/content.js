var isCtrlPressed = false;
const CTRL_KEY_CODE = 17;
const SPACE_KEY_CODE = 32;

function keyDownEvent(e) {
    var keyid = e.keyCode;
    if (keyid == CTRL_KEY_CODE) {
        isCtrlPressed = true;
    }
}

function keyUpEvent(e) {
    var keyid = e.keyCode;
    if (keyid == CTRL_KEY_CODE) {
        setTimeout(() => {
            isCtrlPressed = false;
        }, 150);
    }

    if (keyid == SPACE_KEY_CODE && isCtrlPressed == true) {
        const bar = getSearchBarElement();
        if (bar) {
            bar.focus();
            bar.select();
        }
        isCtrlPressed = false;
    }
}

function getSearchBarElement() {
    let bar = document.querySelector('[type="text"]');
    if (!bar) {
        bar = document.querySelector('[autocomplete="off"]');
    }
    return bar;
}
document.onkeydown = keyDownEvent;
document.onkeyup = keyUpEvent;
