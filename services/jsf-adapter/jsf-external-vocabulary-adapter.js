(function (window, document) {
    'use strict';

    var core;

    var ADAPTER_SELECTOR = "input[data-cvoc-adapter='shared-core-jsf']";
    var SEARCH_DELAY = 300;

    function cssEscape(value) {
        return window.CSS && window.CSS.escape ? window.CSS.escape(value) : value.replace(/['\\]/g, '\\$&');
    }

    function parseJson(value) {
        try {
            return JSON.parse(value || '{}');
        } catch (error) {
            console.error('Invalid external vocabulary configuration in JSF markup.', error);
            return {};
        }
    }

    function triggerInputChange(input) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function writeValue(input, value) {
        if (!input) {
            return;
        }
        input.value = value;
        input.setAttribute('value', value);
        triggerInputChange(input);
    }

    function findManagedControl(parent, name) {
        if (!parent || !name) {
            return null;
        }
        var managedElement = parent.querySelector("[data-cvoc-managed-field='" + cssEscape(name) + "']");
        if (!managedElement) {
            return null;
        }
        return managedElement.matches('input, select, textarea') ? managedElement : managedElement.querySelector('input, select, textarea');
    }

    function setManagedValues(parent, managedFields, values) {
        Object.keys(values).forEach(function (key) {
            writeValue(findManagedControl(parent, managedFields[key]), values[key]);
        });
    }

    function getHost(input, parent, managedFields) {
        var nameInput = findManagedControl(parent, managedFields.personName);
        if (nameInput) {
            input.parentElement.style.display = 'none';
            nameInput.style.display = 'none';
            return nameInput.parentElement;
        }
        input.style.display = 'none';
        return input.parentElement;
    }

    function element(tag, className, text) {
        var value = document.createElement(tag);
        if (className) value.className = className;
        if (text) value.textContent = text;
        return value;
    }

    function createAdapter(input) {
        if (input.dataset.sharedCvocMounted === 'true') return;
        input.dataset.sharedCvocMounted = 'true';

        var protocol = input.dataset.cvocProtocol || '';
        var managedFields = parseJson(input.dataset.cvocManagedfields);
        var parent = input.closest("[data-cvoc-parentfield='" + cssEscape(input.dataset.cvocParent || '') + "']");
        var host = getHost(input, parent, managedFields);
        var vocabs = parseJson(input.dataset.cvocVocabs);
        var mode = core.getVocabularyForUri(input.value || '') || core.getDefaultVocabulary({ vocabs: vocabs });
        var radioGroupName = 'shared-cvoc-' + Math.random().toString(36).slice(2);
        var timeout;
        var root = element('div', 'shared-cvoc-jsf');
        var modes = element('div', 'shared-cvoc-jsf__modes');
        var search = element('input', 'form-control shared-cvoc-jsf__search');
        var results = element('div', 'list-group shared-cvoc-jsf__results');
        var status = element('div', 'help-block shared-cvoc-jsf__status');
        var clear = element('button', 'btn btn-default shared-cvoc-jsf__clear', 'Clear');

        search.type = 'text';
        search.autocomplete = 'off';
        search.placeholder = input.getAttribute('placeholder') || 'Select or enter...';
        search.setAttribute('role', 'combobox');
        search.setAttribute('aria-autocomplete', 'list');
        clear.type = 'button';
        var nameControl = findManagedControl(parent, managedFields.personName);
        search.value = nameControl && nameControl.value ? nameControl.value : input.value;

        if (protocol === 'orcid-or-ror') {
            [['orcid', 'Person'], ['ror', 'Organization']].forEach(function (choice) {
                if (!Object.prototype.hasOwnProperty.call(vocabs, choice[0])) return;
                var label = element('label', 'radio-inline');
                var radio = element('input');
                radio.type = 'radio';
                radio.name = radioGroupName;
                radio.value = choice[0];
                radio.checked = mode === choice[0];
                radio.addEventListener('change', function () {
                    mode = choice[0];
                    renderResults([]);
                    status.textContent = '';
                });
                label.appendChild(radio);
                label.appendChild(document.createTextNode(' ' + choice[1]));
                modes.appendChild(label);
            });
            root.appendChild(modes);
        }

        function renderResults(terms) {
            results.replaceChildren();
            search.setAttribute('aria-expanded', terms.length ? 'true' : 'false');
            terms.forEach(function (term) {
                var option = element('button', 'list-group-item list-group-item-action');
                option.type = 'button';
                option.appendChild(element('strong', '', term.label));
                option.appendChild(element('small', 'shared-cvoc-jsf__caption', term.vocabularyName + ' - ' + term.uri));
                option.addEventListener('click', function () {
                    writeValue(input, term.uri);
                    setManagedValues(parent, managedFields, core.getManagedFieldValues(term, managedFields));
                    search.value = term.label;
                    renderResults([]);
                    status.textContent = '';
                });
                results.appendChild(option);
            });
        }

        function clearSelection() {
            writeValue(input, '');
            setManagedValues(parent, managedFields, core.getClearedManagedFieldValues(managedFields));
            search.value = '';
            renderResults([]);
            status.textContent = '';
        }

        function searchThroughDataverse(query) {
            var fieldName = input.dataset.cvocParent;
            if (!fieldName || typeof window.fetch !== 'function') {
                return Promise.resolve([]);
            }

            var params = new URLSearchParams({
                q: query,
                vocabulary: mode,
                language: input.getAttribute('lang') || document.documentElement.lang || 'en'
            });
            return window.fetch('/api/v1/external-vocabularies/' + encodeURIComponent(fieldName) + '/search?' + params)
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('Dataverse external vocabulary search failed.');
                    }
                    return response.json();
                })
                .then(function (payload) {
                    return payload.data || [];
                });
        }

        search.addEventListener('input', function () {
            var query = search.value.trim();
            window.clearTimeout(timeout);
            renderResults([]);
            status.textContent = '';
            if (input.dataset.cvocAllowfreetext === 'true') {
                writeValue(input, '');
                setManagedValues(parent, managedFields, core.getClearedManagedFieldValues(managedFields));
                if (managedFields.personName) setManagedValues(parent, managedFields, { personName: search.value });
            }
            if (query.length < 3) return;
            timeout = window.setTimeout(function () {
                status.textContent = 'Searching...';
                searchThroughDataverse(query)
                    .then(function (terms) {
                        renderResults(terms);
                        status.textContent = terms.length ? '' : 'No results found.';
                    })
                    .catch(function () {
                        renderResults([]);
                        status.textContent = 'Unable to search the external vocabulary.';
                    });
            }, SEARCH_DELAY);
        });

        search.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') event.preventDefault();
        });

        clear.addEventListener('click', clearSelection);
        root.appendChild(search);
        root.appendChild(results);
        root.appendChild(status);
        root.appendChild(clear);
        host.appendChild(root);
    }

    function mountAll(root) {
        (root || document).querySelectorAll(ADAPTER_SELECTOR).forEach(createAdapter);
    }

    function injectStyles() {
        if (document.getElementById('shared-cvoc-jsf-styles')) return;
        var style = document.createElement('style');
        style.id = 'shared-cvoc-jsf-styles';
        style.textContent = '.shared-cvoc-jsf__modes{display:flex;gap:16px;margin-bottom:8px}.shared-cvoc-jsf__results{margin-top:4px;max-height:260px;overflow:auto}.shared-cvoc-jsf__caption{display:block;color:#666;margin-top:2px}.shared-cvoc-jsf__status{min-height:20px;margin-top:4px}.shared-cvoc-jsf__clear{margin-top:6px}';
        document.head.appendChild(style);
    }

    document.addEventListener('DOMContentLoaded', function () {
        (function mountWhenCoreIsReady() {
            core = window.DataverseExternalVocabularyCore;
            if (!core) {
                window.setTimeout(mountWhenCoreIsReady, 25);
                return;
            }
            injectStyles();
            mountAll();
            new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    mutation.addedNodes.forEach(function (node) {
                        if (node.nodeType === Node.ELEMENT_NODE) mountAll(node);
                    });
                });
            }).observe(document.body, { childList: true, subtree: true });
        }());
    });
}(window, document));
