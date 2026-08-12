(function (window, document) {
    'use strict';

    var core;
    var reactPicker;
    var ADAPTER_SELECTOR = "input[data-cvoc-adapter='shared-react-jsf']";

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

    function writeValue(input, value) {
        if (!input) return;
        input.value = value;
        input.setAttribute('value', value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findManagedControl(parent, name) {
        if (!parent || !name) return null;
        var element = parent.querySelector("[data-cvoc-managed-field='" + cssEscape(name) + "']");
        if (!element) return null;
        return element.matches('input, select, textarea') ? element : element.querySelector('input, select, textarea');
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

    function createAdapter(input) {
        if (input.dataset.sharedCvocMounted === 'true') return;
        input.dataset.sharedCvocMounted = 'true';

        var managedFields = parseJson(input.dataset.cvocManagedfields);
        var parent = input.closest("[data-cvoc-parentfield='" + cssEscape(input.dataset.cvocParent || '') + "']");
        var host = getHost(input, parent, managedFields);
        var vocabs = parseJson(input.dataset.cvocVocabs);
        var mode = core.getVocabularyForUri(input.value || '') || core.getDefaultVocabulary({ vocabs: vocabs });
        var nameControl = findManagedControl(parent, managedFields.personName);
        var searchValue = nameControl && nameControl.value ? nameControl.value : input.value;
        var mountNode = document.createElement('div');
        var picker;

        mountNode.className = 'shared-cvoc-jsf';
        host.appendChild(mountNode);

        function searchThroughDataverse(query) {
            var fieldName = input.dataset.cvocParent;
            if (!fieldName || typeof window.fetch !== 'function') return Promise.resolve([]);

            var params = new URLSearchParams({
                q: query,
                vocabulary: mode,
                language: input.getAttribute('lang') || document.documentElement.lang || 'en'
            });
            return window.fetch('/api/v1/external-vocabularies/' + encodeURIComponent(fieldName) + '/search?' + params)
                .then(function (response) {
                    if (!response.ok) throw new Error('Dataverse external vocabulary search failed.');
                    return response.json();
                })
                .then(function (payload) {
                    return payload.data || [];
                });
        }

        function pickerProps() {
            return {
                vocabularies: Object.keys(vocabs).map(function (vocabulary) {
                    return {
                        id: vocabulary,
                        label: vocabulary === 'orcid' ? 'Person' : vocabulary === 'ror' ? 'Organization' : vocabulary
                    };
                }),
                selectedVocabulary: mode,
                value: searchValue,
                placeholder: input.getAttribute('placeholder') || 'Select or enter...',
                required: input.required,
                onVocabularyChange: function (nextMode) {
                    mode = nextMode;
                    searchValue = '';
                    writeValue(input, '');
                    setManagedValues(parent, managedFields, core.getClearedManagedFieldValues(managedFields));
                    picker.render(pickerProps());
                },
                onValueChange: function (nextValue) {
                    searchValue = nextValue;
                    if (input.dataset.cvocAllowfreetext === 'true') {
                        writeValue(input, '');
                        setManagedValues(parent, managedFields, core.getClearedManagedFieldValues(managedFields));
                        if (managedFields.personName) setManagedValues(parent, managedFields, { personName: nextValue });
                    }
                    picker.render(pickerProps());
                },
                onSearch: searchThroughDataverse,
                onSelect: function (term) {
                    writeValue(input, term.uri);
                    setManagedValues(parent, managedFields, core.getManagedFieldValues(term, managedFields));
                    searchValue = term.label;
                    picker.render(pickerProps());
                },
                onClear: function () {
                    writeValue(input, '');
                    setManagedValues(parent, managedFields, core.getClearedManagedFieldValues(managedFields));
                    searchValue = '';
                    picker.render(pickerProps());
                }
            };
        }

        picker = reactPicker.mount(mountNode, pickerProps());
    }

    function mountAll(root) {
        (root || document).querySelectorAll(ADAPTER_SELECTOR).forEach(createAdapter);
    }

    function injectStyles() {
        if (document.getElementById('shared-cvoc-jsf-styles')) return;
        var style = document.createElement('style');
        style.id = 'shared-cvoc-jsf-styles';
        style.textContent = '.dataverse-external-vocabulary-picker__modes{display:flex;gap:16px;margin-bottom:8px}.dataverse-external-vocabulary-picker__mode{display:flex;align-items:center;gap:6px;font-weight:normal}.dataverse-external-vocabulary-picker__combobox{position:relative;max-width:36rem}.dataverse-external-vocabulary-picker__clear,.dataverse-external-vocabulary-picker__toggle{position:absolute;top:1px;bottom:1px;border:0;border-left:1px solid #b8b8b8;background:#f5f5f5;color:#333}.dataverse-external-vocabulary-picker__clear{right:2.25rem;width:2.25rem}.dataverse-external-vocabulary-picker__toggle{right:1px;width:2.25rem}.dataverse-external-vocabulary-picker__caret{display:inline-block;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #777}.dataverse-external-vocabulary-picker__results{margin-top:4px;max-height:260px;overflow:auto}.dataverse-external-vocabulary-picker__result-label,.dataverse-external-vocabulary-picker__result-caption{display:block}.dataverse-external-vocabulary-picker__status{min-height:20px;margin-top:4px}';
        document.head.appendChild(style);
    }

    document.addEventListener('DOMContentLoaded', function () {
        (function mountWhenDependenciesAreReady() {
            core = window.DataverseExternalVocabularyCore;
            reactPicker = window.DataverseExternalVocabularyReact;
            if (!core || !reactPicker) {
                window.setTimeout(mountWhenDependenciesAreReady, 25);
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
