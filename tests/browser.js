(() => {
    const fixture = document.getElementById('fixture');
    const results = [];
    const byId = id => document.getElementById(id);

    function assert(condition, message) {
        if (!condition) throw new Error(message);
    }

    function scene(html) {
        document.activeElement?.blur();
        fixture.innerHTML = html;
    }

    const inject = () => (0, eval)(contentScriptSource);

    function test(name, run) {
        try {
            run();
            results.push({ name, passed: true });
        } catch (error) {
            results.push({ name, passed: false, error: error.message });
        }
    }

    function expectFocus(id, hostname = 'example.com') {
        focusSearchField(hostname);
        assert(document.activeElement === byId(id), `Expected focus on ${id}`);
    }

    function expectNoSearch(html, hostname = 'example.com') {
        scene(`<button id="previous">Previous focus</button>${html}`);
        byId('previous').focus();
        expectFocus('previous', hostname);
    }

    for (const hostname of ['google.com', 'www.google.com']) {
        for (const tag of ['input', 'textarea']) {
            test(`${hostname}: semantic ${tag} wins over unrelated autocomplete and generic search`, () => {
                scene(`<input autocomplete="off"><form autocomplete="off"></form>
                    <input type="search" id="generic"><${tag} name="q" id="google"></${tag}>`);
                expectFocus('google', hostname);
            });
        }
    }

    for (const hostname of ['notgoogle.com', 'google.com.evil.test', 'evilgoogle.com',
        'google.evil.test', 'maps.google.com', 'www.google.sk', 'google.co.uk']) {
        test(`${hostname}: q alone does not trigger Google's rule`, () => {
            expectNoSearch('<input name="q"><textarea name="q"></textarea>', hostname);
        });
    }

    test('Country domains still use generic search detection', () => {
        scene('<input name="q"><input id="field" aria-label="Search">');
        expectFocus('field', 'www.google.sk');
    });

    const signals = [
        ['search input', '<input type="search" id="field">'],
        ['input searchbox role', '<input role="searchbox" id="field">'],
        ['textarea searchbox role', '<textarea role="searchbox" id="field"></textarea>'],
        ['search element', '<search><input id="field" name="q"></search>'],
        ['search landmark', '<div role="search"><textarea id="field"></textarea></div>'],
        ['form id', '<form id="siteSearch"><input id="field"></form>'],
        ['form name', '<form name="site-search"><input id="field"></form>'],
        ['form with a control named labels', '<form name="search"><input name="labels" id="field"></form>'],
        ['form aria-label', '<form aria-label="Search this site"><input id="field"></form>'],
        ['form labelledby', '<span id="label">Search</span><form aria-labelledby="label"><input id="field"></form>'],
        ['external form owner', '<form id="searchForm"></form><input id="field" form="searchForm">'],
        ['name', '<input name="site-search" id="field">'],
        ['placeholder', '<input placeholder="Search articles" id="field">'],
        ['aria-label', '<input aria-label="SEARCH THIS SITE" id="field">'],
        ['labelledby references', '<span id="prefix">Site</span><span id="label">Search</span><input aria-labelledby="missing prefix label" id="field">'],
        ['explicit label', '<label for="field">Search</label><input id="field">'],
        ['wrapping label', '<label>Search <input id="field"></label>'],
        ['textarea placeholder', '<textarea placeholder="Search" id="field"></textarea>'],
        ['searchbox token', '<input name="SEARCHBOX" id="field">'],
        ['camel case', '<input name="siteSearchQuery" id="field">'],
        ['acronym boundary', '<input name="HTMLSearch" id="field">']
    ];
    for (const [name, html] of signals) {
        test(`Accepts ${name}`, () => {
            scene(`<input name="unrelated">${html}`);
            expectFocus('field');
        });
    }

    test('Accepts search wording in the field id', () => {
        scene('<input id="siteSearch">');
        expectFocus('siteSearch');
    });

    test('A form control named getAttribute does not block unrelated search fields', () => {
        scene('<form><input name="getAttribute"></form><input type="search" id="field">');
        expectFocus('field');
    });

    test('Form labels remain readable when getAttribute is shadowed', () => {
        scene('<span id="label">Search</span><form aria-labelledby="label"><input type="hidden" name="getAttribute"><input id="field"></form>');
        expectFocus('field');
    });

    for (const method of ['getAttribute', 'hasAttribute']) {
        test(`Ancestor eligibility checks tolerate a form control named ${method}`, () => {
            scene(`<form><input type="hidden" name="${method}"><input type="search" id="field"></form>`);
            expectFocus('field');
        });
    }

    const negatives = [
        ['login form', '<form id="login"><label>Username<input type="text" autocomplete="off"></label><input type="password"></form>'],
        ['unrelated text and textarea', '<input type="text" name="title"><input><textarea placeholder="Your message"></textarea>'],
        ['ambiguous names', '<input name="q"><input name="query"><textarea name="query"></textarea>'],
        ['autocomplete only', '<form autocomplete="off"><input autocomplete="off"></form>'],
        ['form placeholder is not a search signal', '<form placeholder="Search"><input></form>'],
        ['research substring', '<input id="research" name="researcher" placeholder="Research notes">'],
        ['Unicode word boundary', '<input name="searché"><input name="ésearch">'],
        ['unrelated labelledby', '<span id="label">Username</span><input aria-labelledby="missing label">'],
        ['non-controls', '<form role="searchbox" autocomplete="off"></form><div role="searchbox" tabindex="0"></div>'],
        ['contenteditable', '<div contenteditable="true" role="searchbox">Search</div>']
    ];
    for (const [name, html] of negatives) {
        test(`Rejects ${name}`, () => expectNoSearch(html));
    }
    for (const type of ['password', 'email', 'number', 'url', 'tel', 'hidden', 'checkbox', 'button', 'submit']) {
        test(`Rejects ${type} even with search signals and Google q`, () => {
            expectNoSearch(`<form role="search"><input type="${type}" name="q" aria-label="Search" role="searchbox"></form>`, 'google.com');
        });
    }

    test('Ranks signals and deduplicates controls in document order', () => {
        scene(`<input id="attribute" aria-label="Search">
            <search><input id="context"></search>
            <input id="explicit" type="search"><textarea id="role" role="searchbox"></textarea>
            <search><input id="google" name="q" type="search" aria-label="Search"></search>`);
        const ids = getSearchCandidates('google.com').map(element => element.id);
        assert(ids.join(',') === 'google,explicit,role,context,attribute', `Unexpected order: ${ids}`);
        expectFocus('google', 'google.com');
    });

    test('First eligible candidate wins within a tier', () => {
        scene('<input type="search" id="first"><input type="search" id="second">');
        expectFocus('first');
    });

    const hiddenWrappers = [
        ['hidden attribute', 'hidden'],
        ['hidden until found', 'hidden="until-found"'],
        ['inert', 'inert'],
        ['aria-hidden', 'aria-hidden="true"'],
        ['uppercase aria-hidden', 'aria-hidden="TRUE"'],
        ['stylesheet display', 'class="css-hidden"'],
        ['stylesheet visibility', 'class="css-invisible"'],
        ['inline display', 'style="display:none"'],
        ['visibility collapse', 'style="visibility:collapse"'],
        ['content visibility', 'style="content-visibility:hidden"'],
        ['opacity zero', 'style="opacity:0"']
    ];
    for (const [name, attributes] of hiddenWrappers) {
        for (const ancestor of [false, true]) {
            for (const hostname of ['example.com', 'google.com']) {
                test(`${hostname}: skips ${ancestor ? 'ancestor' : 'own'} ${name}`, () => {
                    const field = '<input id="bad" name="q" type="search">';
                    const hidden = ancestor ? `<div ${attributes}>${field}</div>` :
                        `<input id="bad" name="q" type="search" ${attributes}>`;
                    scene(`${hidden}<input id="good" type="search">`);
                    expectFocus('good', hostname);
                });
            }
        }
    }

    const unsuitable = [
        ['disabled input', '<input type="search" name="q" disabled>'],
        ['disabled textarea', '<textarea name="q" role="searchbox" disabled></textarea>'],
        ['disabled fieldset', '<fieldset disabled><input type="search" name="q"></fieldset>'],
        ['readonly input', '<input type="search" name="q" readonly>'],
        ['readonly textarea', '<textarea name="q" role="searchbox" readonly></textarea>'],
        ['zero dimensions', '<input type="search" name="q" class="zero-size">'],
        ['closed details', '<details><summary>More</summary><input type="search" name="q"></details>'],
        ['aria-hidden ancestor cannot be overridden', '<div aria-hidden="true"><input type="search" name="q" aria-hidden="false"></div>']
    ];
    for (const [name, html] of unsuitable) {
        for (const hostname of ['example.com', 'google.com']) {
            test(`${hostname}: skips ${name}`, () => {
                scene(`${html}<input type="search" id="good">`);
                expectFocus('good', hostname);
            });
        }
    }

    for (const visibility of ['hidden', 'collapse']) {
        for (const hostname of ['example.com', 'google.com']) {
            test(`${hostname}: visible controls can override ancestor visibility ${visibility}`, () => {
                scene(`<div style="visibility:${visibility}"><input type="search" name="q" id="field" style="visibility:visible"></div>`);
                assert(getComputedStyle(byId('field')).visibility === 'visible', 'Control is not visibly rendered');
                byId('field').focus();
                assert(document.activeElement === byId('field'), 'Browser cannot focus the visible control');
                byId('field').blur();
                expectFocus('field', hostname);
            });
        }
    }

    test('Detached controls are ineligible', () => {
        scene('<input type="search" id="field">');
        const field = byId('field');
        field.remove();
        assert(!isEligibleSearchField(field), 'Detached control was eligible');
    });

    test('aria-hidden false, negative tabindex, and partial opacity remain eligible', () => {
        scene('<div aria-hidden="false" style="opacity:0.5"><input type="search" tabindex="-1" id="field"></div>');
        expectFocus('field');
    });

    test('Disabled fieldset first legend exception remains eligible', () => {
        scene('<fieldset disabled><legend><input type="search" id="field"></legend></fieldset>');
        expectFocus('field');
    });

    test('Offscreen search fields can be focused', () => {
        scene('<input type="search" id="field" style="position:absolute;top:3000px">');
        expectFocus('field');
        window.scrollTo(0, 0);
    });

    for (const failure of ['throws', 'no-op', 'redirects']) {
        test(`Tries the next candidate when focus ${failure}`, () => {
            scene('<button id="other">Other</button><input type="search" id="first"><input type="search" id="second">');
            byId('first').focus = () => {
                if (failure === 'throws') throw new Error('Focus unavailable');
                if (failure === 'redirects') byId('other').focus();
            };
            expectFocus('second');
        });
    }

    test('Google focus failure falls back to a generic candidate', () => {
        scene('<input name="q" id="first"><input type="search" id="second">');
        byId('first').focus = () => {};
        expectFocus('second', 'google.com');
    });

    test('Rechecks eligibility after a failed focus changes another candidate', () => {
        scene('<input type="search" id="first"><input type="search" id="second"><input type="search" id="third">');
        byId('first').focus = () => { byId('second').disabled = true; };
        expectFocus('third');
    });

    for (const tag of ['input', 'textarea']) {
        test(`Selects existing ${tag} text`, () => {
            scene(`<${tag} id="field" aria-label="Search"></${tag}>`);
            byId('field').value = 'existing search';
            expectFocus('field');
            assert(byId('field').selectionStart === 0 && byId('field').selectionEnd === 15,
                'Expected all text to be selected');
        });
    }

    for (const selection of [undefined, 42, () => { throw new Error('Cannot select'); }]) {
        test(`Retains focus when select is ${typeof selection}`, () => {
            scene('<input type="search" id="field"><input type="search" id="other">');
            byId('field').select = selection;
            expectFocus('field');
        });
    }

    test('No suitable field preserves current focus', () => expectNoSearch('<input type="search" hidden>'));
    test('No candidates is harmless', () => expectNoSearch(''));
    test('All focus attempts failing is harmless', () => {
        scene('<button id="previous">Previous</button><input type="search" id="field">');
        byId('previous').focus();
        byId('field').focus = () => { throw new Error('Cannot focus'); };
        expectFocus('previous');
    });

    function key(type, options) {
        const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...options });
        document.dispatchEvent(event);
        return event;
    }

    test('Each script execution focuses and selects once, including after DOM changes', () => {
        let focusCalls = 0;
        let selectCalls = 0;
        for (let replacement = 0; replacement < 2; replacement++) {
            scene('<button id="previous">Previous</button><input type="search" id="field" value="hello">');
            const field = byId('field');
            const originalFocus = field.focus.bind(field);
            const originalSelect = field.select.bind(field);
            field.focus = () => { focusCalls++; originalFocus(); };
            field.select = () => { selectCalls++; originalSelect(); };
            for (let repeat = 0; repeat < 2; repeat++) {
                byId('previous').focus();
                const before = focusCalls;
                inject();
                assert(focusCalls === before + 1 && selectCalls === focusCalls,
                    'Expected exactly one focus and selection per injection');
                assert(document.activeElement === field, 'Injected script did not focus current field');
                assert(field.selectionStart === 0 && field.selectionEnd === 5, 'Text was not selected');
            }
        }
    });

    test('A newly inserted search field waits for the next invocation', () => {
        scene('<input id="previous" value="unrelated text">');
        byId('previous').focus();
        inject();
        assert(document.activeElement === byId('previous'), 'Empty invocation moved focus');
        fixture.insertAdjacentHTML('beforeend', '<input type="search" id="field" value="new search">');
        assert(document.activeElement === byId('previous'), 'Insertion moved focus');
        inject();
        const field = byId('field');
        assert(document.activeElement === field, 'Inserted field was not focused');
        assert(field.selectionStart === 0 && field.selectionEnd === field.value.length,
            'Inserted field text was not selected');
    });

    for (const attribute of ['hidden', 'disabled', 'inert']) {
        test(`Each invocation rechecks a candidate's ${attribute} state`, () => {
            scene('<button id="previous">Previous</button><input type="search" id="first"><input type="search" id="second">');
            for (const blocked of [false, true, false]) {
                byId('first').toggleAttribute(attribute, blocked);
                byId('previous').focus();
                inject();
                assert(document.activeElement === byId(blocked ? 'second' : 'first'),
                    `Incorrect target with ${attribute}=${blocked}`);
            }
        });
    }

    test('Same-document navigation uses the replacement search field', () => {
        const originalUrl = location.href;
        const originalState = history.state;
        try {
            scene('<input type="search" id="old" value="old query">');
            inject();
            const oldField = byId('old');
            assert(document.activeElement === oldField, 'Initial field was not focused');
            history.pushState({ fixture: true }, '', '?fixture=results');
            scene('<button id="previous">Previous</button><textarea role="searchbox" id="replacement">new query</textarea>');
            byId('previous').focus();
            inject();
            const replacement = byId('replacement');
            assert(!oldField.isConnected, 'Old field was not removed');
            assert(document.activeElement === replacement, 'Replacement field was not focused');
            assert(replacement.selectionStart === 0 && replacement.selectionEnd === replacement.value.length,
                'Replacement text was not selected');
        } finally {
            history.replaceState(originalState, '', originalUrl);
            scene('');
        }
    });

    for (const tag of ['input', 'textarea']) {
        test(`Selecting ${tag} preserves its value without editing or submitting`, () => {
            scene(`<form><${tag} id="field" aria-label="Search"></${tag}><button>Submit</button></form>`);
            const field = byId('field');
            const value = tag === 'textarea' ? 'first line\nsecond line 🔎' : 'search café 🔎';
            field.value = value;
            const events = [];
            for (const type of ['input', 'change', 'submit']) {
                field.form.addEventListener(type, event => {
                    event.preventDefault();
                    events.push(type);
                });
            }
            inject();
            assert(document.activeElement === field, 'Search was not focused');
            assert(field.value === value, 'Selection changed the value');
            assert(field.selectionStart === 0 && field.selectionEnd === value.length,
                'Text was not fully selected');
            field.blur(); // A change event may be deferred until blur.
            assert(events.length === 0, `Unexpected events: ${events}`);
        });

        test(`No-search invocation preserves ${tag} focus and partial selection`, () => {
            scene(`<${tag} id="previous"></${tag}><input type="search" hidden>`);
            const previous = byId('previous');
            previous.value = 'unrelated text';
            previous.focus();
            previous.setSelectionRange(2, 7, 'backward');
            inject();
            assert(document.activeElement === previous, 'Existing focus was lost');
            assert(previous.selectionStart === 2 && previous.selectionEnd === 7 &&
                previous.selectionDirection === 'backward', 'Existing selection was changed');
        });
    }

    test('Fallback skips a candidate detached by an earlier focus attempt', () => {
        scene('<input type="search" id="first"><input type="search" id="second"><input type="search" id="third">');
        const second = byId('second');
        let detachedFocusCalls = 0;
        second.focus = () => { detachedFocusCalls++; };
        byId('first').focus = () => { second.remove(); };
        inject();
        assert(document.activeElement === byId('third'), 'Fallback did not reach the connected candidate');
        assert(detachedFocusCalls === 0, 'Attempted to focus a detached candidate');
    });

    for (const [name, options] of [
        ['Ctrl+Space', { key: ' ', code: 'Space', ctrlKey: true }],
        ['Space', { key: ' ', code: 'Space' }],
        ['/', { key: '/', code: 'Slash' }]
    ]) {
        test(`${name} document events do not activate or prevent default after repeated injection`, () => {
            scene('<button id="previous">Previous</button><input type="search" id="field">');
            byId('previous').focus();
            const events = [];
            if (options.ctrlKey) events.push(key('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true }));
            events.push(key('keydown', options), key('keyup', options));
            if (options.ctrlKey) events.push(key('keyup', { key: 'Control', code: 'ControlLeft' }));
            assert(events.every(event => !event.defaultPrevented), 'Document event default was prevented');
            assert(document.activeElement === byId('previous'), 'Document event activated search');
        });
    }

    fixture.replaceChildren();
    const failures = results.filter(result => !result.passed);
    document.getElementById('report').textContent = `${results.length - failures.length}/${results.length} passed\n` +
        failures.map(result => `${result.name}: ${result.error}`).join('\n');
    document.getElementById('test-results').textContent = JSON.stringify({ results });
})();
