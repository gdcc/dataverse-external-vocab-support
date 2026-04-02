window.publications = window.publications || {};
window.publications.config = window.publications.config || {
    publicationSelector: "span[data-cvoc-protocol='publication']",
    publicationInputSelector: "input[data-cvoc-protocol='publication']",
    selectedFormat: 'chicago-author-date'
};

window.publications.state = window.publications.state || {
    orcidBaseUrl: null,
    i18n: null,
    i18nPromise: null,
    cslStylePromise: null
};

$(document).ready(function() {
    $.getScript("https://cdn.jsdelivr.net/npm/citation-js").done(function() {
        // Fetch and cache the CSL style file once on load
        var selectedFormat = window.publications.config.selectedFormat;
        if(!window.publications.state.cslStylePromise) {
            window.publications.state.cslStylePromise = fetch('https://raw.githubusercontent.com/citation-style-language/styles/master/' + selectedFormat + '.csl')
                .then(r => r.text())
                .then(styleXml => {
                    Cite.plugins.config.get('@csl').templates.add(selectedFormat, styleXml);
                    return styleXml;
                });
        }
        var lang = $('html').attr('lang') || 'en';
        var scriptSrc = $('script[src*="publications.js"]').attr('src');
        loadI18n(lang, scriptSrc).then(function() {
            expandPublications();
            updatePublicationInputs();
        });
    });
});

function getPidUrl(identifierType, identifier, explicitUrl) {
    var normalizedIdentifierType = (identifierType || '').toLowerCase();
    var trimmedIdentifier = (identifier || '').trim();

    if (explicitUrl) {
        return explicitUrl;
    }

    if (!trimmedIdentifier) {
        return '';
    }

    if (normalizedIdentifierType === 'doi') {
        return 'https://doi.org/' + trimmedIdentifier.replace(/^doi:/i, '');
    }

    if (normalizedIdentifierType === 'uri' || normalizedIdentifierType === 'url') {
        return trimmedIdentifier;
    }

    return '';
}

function normalizeUrlForComparison(url) {
    return (url || '').trim().replace(/\/+$/, '').toLowerCase();
}

function getElementValue(element) {
    if (!element || element.length === 0) {
        return '';
    }

    if (element.is('input, textarea, select')) {
        return (element.val() || '').trim();
    }

    return (element.text() || '').trim();
}

function expandPublications() {
    $(window.publications.config.publicationSelector).each(function() {
        var publicationIdentifierElement = this;
        if (!$(publicationIdentifierElement).hasClass('expanded')) {
            $(publicationIdentifierElement).addClass('expanded');

            var identifier = (publicationIdentifierElement.textContent || '').trim();
            var cvocIndex = $(publicationIdentifierElement).attr('data-cvoc-index');

            var relationTypeElement = $('[data-cvoc-metadata-name="publicationRelationType"][data-cvoc-index="' + cvocIndex + '"]');
            var citationElement = $('[data-cvoc-metadata-name="publicationCitation"][data-cvoc-index="' + cvocIndex + '"]');
            var identifierTypeElement = $('[data-cvoc-metadata-name="publicationIDType"][data-cvoc-index="' + cvocIndex + '"]');
            var urlElement = $('[data-cvoc-metadata-name="publicationURL"][data-cvoc-index="' + cvocIndex + '"]');

            var relationType = getElementValue(relationTypeElement);
            if(!relationType) {
                relationType = window.publications.state.i18n.relationNotSpecified;
            }
            var citationText = getElementValue(citationElement);
            var identifierType = getElementValue(identifierTypeElement);
            var urlValue = getElementValue(urlElement);
            var pidUrl = getPidUrl(identifierType, identifier, '');

            if (!citationText) {
                citationText = identifier;
            }

            var citationContent = $('<div/>').css({
                'margin-left': '2em',
                'margin-right': '2em',
                'background-color': '#e3f2fd',
                'padding': '0.75em',
                'border-radius': '0.5em',
                'display': 'block'
            }).text(citationText);

            if (pidUrl) {
                citationContent.append(
                    $('<a/>')
                        .attr('href', pidUrl)
                        .attr('target', '_blank')
                        .attr('rel', 'noopener noreferrer')
                        .text(' [PID]')
                );
            }

            if (urlValue && normalizeUrlForComparison(urlValue) !== normalizeUrlForComparison(pidUrl)) {
                citationContent.append(
                    $('<a/>')
                        .attr('href', urlValue)
                        .attr('target', '_blank')
                        .attr('rel', 'noopener noreferrer')
                        .text(' [URL]')
                );
            }

            var displayElement = $('<div/>');

            if (relationType) {
                relationTypeElement.parent().contents().filter(function() {
                    return this.nodeType === 3;
                }).wrap('<span style="display:none;"></span>');

                displayElement.append($('<div/>').css({
                    'font-style': 'italic',
                    'margin-bottom': '0.5em'
                }).text(relationType));

                displayElement.append($('<div/>').css('margin-left', '2em').append(citationContent));
            } else {
                displayElement.append(citationContent);
            }

            $(publicationIdentifierElement).hide();
            displayElement.insertBefore($(publicationIdentifierElement));
        }
    });
}

// --------------------------------------------------------------------------
// Internationalization (i18n) Support
// --------------------------------------------------------------------------

/**
 * Asynchronously loads the internationalization properties for the current locale.
 * Defaults to 'en' if the locale is not found.
 * @param {string} lang - The language code (e.g., 'en', 'fr').
 * @param {string} scriptPath - The path to the current script.
 * @returns {Promise<Object>} A promise that resolves with the i18n object.
 */
function loadI18n(lang, scriptPath) {
    var state = window.publications.state;

    if (state.i18n) {
        return Promise.resolve(state.i18n);
    }

    if (state.i18nPromise) {
        return state.i18nPromise;
    }

    function getDefaultI18n() {
        return {
            searchAndSelectPublication: "Search and select a publication:",
            cancel: "Cancel",
            loadingPublicationsOne: "Loading publications from ORCID profile...",
            loadingPublicationsMany: "Loading publications from {0} ORCID profiles...",
            selectPublication: "Select a publication",
            findUsingOrcid: "Find using ORCID",
            findUsingOrcid_ariaLabel: "Simplify adding publications by importing them the authors' ORCID profiles",
            findAndImportPublicationFromOrcid: "Find and import publication from ORCID",
            addOrcidForAuthorsHint: "Hint: If you add ORCIDs for authors, you can select Related Publications from their profiles!",
            relationNotSpecified: "(Relation not specified)"
        };
    }

    function fetchI18n(targetLang) {
        var langFile = scriptPath.substring(0, scriptPath.lastIndexOf('/')) + '/i18n/publications_' + targetLang + '.json';

        return fetch(langFile)
            .then(function(response) {
                if (response.ok) {
                    return response.json();
                }

                if (targetLang !== 'en') {
                    console.warn("Language file not found for: " + targetLang + ". Falling back to 'en'.");
                    return fetchI18n('en');
                }

                throw new Error('Default language file "en.json" not found.');
            })
            .catch(function(error) {
                console.error('Failed to load i18n file:', error);

                if (targetLang !== 'en') {
                    return fetchI18n('en');
                }

                return getDefaultI18n();
            });
    }

    state.i18nPromise = fetchI18n(lang || 'en')
        .then(function(data) {
            state.i18n = data;
            return data;
        })
        .finally(function() {
            state.i18nPromise = null;
        });

    return state.i18nPromise;
}

/**
 * Simple string formatter. Replaces {0}, {1}, etc. with arguments.
 * @param {string} str - The string to format.
 * @returns {string} The formatted string.
 */
function formatString(str) {
    var args = Array.prototype.slice.call(arguments, 1);
    return str.replace(/{(\d+)}/g, function(match, number) {
        return typeof args[number] != 'undefined' ? args[number] : match;
    });
}

function updatePublicationInputs() {
    var i18n = window.publications.state.i18n;

    $(window.publications.config.publicationInputSelector).each(function () {
        var identifierInput = this;
        if (!identifierInput.hasAttribute('data-pub-lookup')) {
            let num = Math.floor(Math.random() * 100000000000);
            $(identifierInput).attr('data-pub-lookup', num);

            getOrcidBaseUrl(identifierInput);

            // Find the citation field to place the button above it
            let parentField = $(identifierInput).attr('data-cvoc-parent');
            let hasParentField = $("[data-cvoc-parentfield='" + parentField + "']").length > 0;

            if (hasParentField) {
                var parent = $(identifierInput).closest("[data-cvoc-parentfield='" + parentField + "']");
                let managedFields = JSON.parse($(identifierInput).attr('data-cvoc-managedfields'));

                // Find the citation field
                if (managedFields['citation']) {
                    let citationField = $(parent).find("textarea[data-cvoc-managed-field='" + managedFields['citation'] + "']");

                    if (citationField.length > 0) {
                        // Only add the button if there are authors with ORCID identifiers
                        var authorOrcids = findAuthorOrcids();
                        if (authorOrcids.length > 0) {
                            // Create button and modal above the citation field
                            var modalId = "orcidModal_" + num;
                            var selectId = "pubPidAddSelect_" + num;

                            // ORCID SVG icon for the button
                            var orcidIconSvg = '<svg width="16" height="16" viewBox="0 0 256 256" style="vertical-align: text-bottom; margin-right: 5px;"><path fill="#A6CE39" d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z"/><path fill="#FFF" d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7C191.7 111.2 183.8 88 148.8 88h-24.5v84.4zM80.4 66.4c-8.5 0-15.4-6.9-15.4-15.4 0-8.5 6.9-15.4 15.4-15.4 8.5 0 15.4 6.9 15.4 15.4 0 8.5-6.9 15.4-15.4 15.4z"/></svg>';

                            // Create button HTML (to be inserted before citation field)
                            var buttonHtml =
                                '<div style="margin-bottom: 10px;">' +
                                '  <button id="findOnOrcid_' + num + '" class="btn btn-default" type="button" aria-label="' + i18n.findUsingOrcid_ariaLabel + '" title="' + i18n.findUsingOrcid_ariaLabel + '">' + i18n.findUsingOrcid + ' ' + orcidIconSvg + '</button>' +
                                '</div>';

                            // Create modal HTML with centered positioning
                            var modalHtml =
                                '<div id="' + modalId + '" class="modal fade" tabindex="-1" role="dialog" style="padding-top: 60px;">' +
                                '  <div class="modal-dialog modal-lg" role="document" style="margin: 30px auto;">' +
                                '    <div class="modal-content">' +
                                '      <div class="modal-header">' +
                                '        <button type="button" class="close" data-dismiss="modal" aria-label="Close">' +
                                '          <span aria-hidden="true">&times;</span>' +
                                '        </button>' +
                                '        <h4 class="modal-title">' + i18n.findAndImportPublicationFromOrcid + '</h4>' +
                                '      </div>' +
                                '      <div class="modal-body">' +
                                '        <div class="form-group">' +
                                '          <label for="' + selectId + '">' + i18n.searchAndSelectPublication + '</label>' +
                                '          <select id="' + selectId + '" class="form-control add-resource select2" style="width: 100%;"></select>' +
                                '        </div>' +
                                '      </div>' +
                                '      <div class="modal-footer">' +
                                '        <button type="button" class="btn btn-default" data-dismiss="modal">' + i18n.cancel + '</button>' +
                                '      </div>' +
                                '    </div>' +
                                '  </div>' +
                                '</div>';

                            // Insert button above citation field
                            citationField.before(buttonHtml);

                            // Append modal to body (this fixes the z-index issue)
                            $('body').append(modalHtml);

                            // Initialize select2 early with basic configuration
                            $("#" + selectId).select2({
                                theme: "classic",
                                placeholder: i18n.selectPublication,
                                allowClear: true,
                                width: '100%',
                                dropdownParent: $("#" + modalId),
                                minimumResultsForSearch: 0  // Always show search box
                            });

                            // Button click handler
                            $("#findOnOrcid_" + num).on('click', function (e) {
                                e.preventDefault();
                                e.stopPropagation();

                                // Find all author ORCIDs
                                var authorOrcids = findAuthorOrcids();

                                // Show the modal
                                $("#" + modalId).modal('show');

                                // Show loading indicator
                                var loadingMessage = authorOrcids.length === 1
                                    ? "Loading publications from ORCID profile..."
                                    : "Loading publications from " + authorOrcids.length + " ORCID profiles...";
                                $("#" + selectId).empty().append(new Option(loadingMessage, "")).prop("disabled", true);

                                // Get current PID value to pre-select
                                var currentPid = $(identifierInput).val();

                                // Fetch works from all ORCIDs
                                fetchOrcidWorks(authorOrcids, selectId, currentPid);

                                return false;
                            });

                            // Handle selection
                            $('#' + selectId).on('select2:select', function (e) {
                                var data = e.params.data;

                                // Get current PID value
                                var currentPid = $(identifierInput).val().trim();

                                // If selecting the same DOI that's already there and it's not blank, close modal without changes
                                if (currentPid && data.id === currentPid) {
                                    $("#" + modalId).modal('hide');
                                    return;
                                }

                                // Otherwise, update the DOI field (whether it was blank or different)
                                $(identifierInput).val(data.id);

                                // Handle managed fields
                                for (var key in managedFields) {
                                    if (key == 'idType') {
                                        // Set the identifier type to the selected external-id-type
                                        let selectContainer = $(parent).find("[data-cvoc-managed-field='" + managedFields[key] + "']");
                                        let selectField = $(parent).find("[data-cvoc-managed-field='" + managedFields[key] + "']").find("select");
                                        let selectedIdentifierType = (data.identifierType || '').toLowerCase();
                                        let fieldIdentifierType = selectedIdentifierType === 'uri' ? 'url' : selectedIdentifierType;
                                        let identifierOption = $(selectField).find('option').filter(function () {
                                            return $(this).text().trim().toLowerCase() === fieldIdentifierType;
                                        }).first();
                                        let identifierVal = identifierOption.val();

                                        if (identifierVal !== undefined) {
                                            $(selectField).val(identifierVal).attr('value', identifierVal);
                                            selectField.find('option').removeAttr('selected');
                                            identifierOption.attr('selected', 'selected');

                                            let label = selectContainer.find('label.ui-selectonemenu-label');
                                            if (label.length > 0) {
                                                label.text(fieldIdentifierType);
                                                label.removeClass('ui-state-default');
                                            }
                                        }
                                    } else if (key == 'url') {
                                        // Set the URL for the selected identifier
                                        let urlField = $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']");
                                        let urlValue = data.url;
                                        if (!urlValue && data.identifierType === 'doi') {
                                            urlValue = 'https://doi.org/' + data.id;
                                        }
                                        $(urlField).val(urlValue).attr('value', urlValue);
                                    } else if (key == 'citation') {
                                        let citationField = $(parent).find("textarea[data-cvoc-managed-field='" + managedFields[key] + "']");

                                        $(citationField).val('Loading citation...').attr('value', 'Loading citation...');

                                        fetchWorkDetails(data.orcidId, data.putCode)
                                            .then(function (workDetails) {
                                                return formatCitation(
                                                    data.workSummary,
                                                    workDetails,
                                                    data.identifierType,
                                                    data.id
                                                );
                                            })
                                            .then(function (citation) {
                                                $(citationField).val(citation).attr('value', citation);
                                            })
                                            .catch(function (error) {
                                                console.error("Error formatting citation: ", error);
                                                var citation = formatBasicCitation(data.workSummary);
                                                $(citationField).val(citation).attr('value', citation);
                                            });
                                    }
                                }

                                // Close the modal after selection
                                $("#" + modalId).modal('hide');
                            });
                            // Handle clear
                            $('#' + selectId).on('select2:clear', function (e) {
                                $(identifierInput).val('').attr('value', '');

                                // Clear managed fields
                                for (var key in managedFields) {
                                    if (key == 'idType') {
                                        // Clear the identifier type select field
                                        let selectField = $(parent).find("[data-cvoc-managed-field='" + managedFields[key] + "']").find("select");
                                        $(selectField).val('').attr('value', '');

                                        // Clear the selected attribute on all options
                                        selectField.find('option').removeAttr('selected');

                                        // Update the visible label to show placeholder/empty state
                                        let selectContainer = selectField.closest('.ui-selectonemenu');
                                        let label = selectContainer.find('label.ui-selectonemenu-label');
                                        if (label.length > 0) {
                                            label.text('Select...');
                                            label.addClass('ui-state-default');
                                        }
                                    } else if (key == 'url') {
                                        $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']").val('').attr('value', '');
                                    } else if (key == 'citation') {
                                        $(parent).find("textarea[data-cvoc-managed-field='" + managedFields[key] + "']").val('').attr('value', '');
                                    }
                                }
                            });

                        } else {
                            // Add a hint for users when no ORCIDs are available
                            showOrcidTeaser();
                        }
                    }
                }
            }
        }
    });
}

/**
 * Fetches works from one or more ORCID profiles and populates a select element.
 *
 * @param {string|Array<string>} orcidIds - Single ORCID ID or array of ORCID IDs
 * @param {string} selectId - The ID of the select element to populate
 * @param {string} preselectedPid - Optional DOI to pre-select in the dropdown
 */
function fetchOrcidWorks(orcidIds, selectId, preselectedPid) {
    // Normalize input to always be an array
    var orcidArray = Array.isArray(orcidIds) ? orcidIds : [orcidIds];

    if (orcidArray.length === 0) {
        $("#" + selectId).empty().append(new Option("No ORCID identifiers provided", "")).prop("disabled", true);
        return;
    }

    // Track all AJAX requests
    var requests = [];

    // Create a request for each ORCID
    orcidArray.forEach(function(orcidId) {
        var request = $.ajax({
            type: "GET",
            url: window.publications.state.orcidBaseUrl + orcidId + "/works",
            dataType: 'json',
            headers: {
                'Accept': 'application/json'
            }
        }).then(
            function(data) {
                // Success - return the works with the ORCID ID for reference
                return {
                    orcidId: orcidId,
                    works: data.group || [],
                    success: true
                };
            },
            function(jqXHR, textStatus, errorThrown) {
                // Error - return error info
                console.error("Error fetching works for ORCID " + orcidId + ": " + textStatus, errorThrown);
                return {
                    orcidId: orcidId,
                    works: [],
                    success: false,
                    error: textStatus
                };
            }
        );

        requests.push(request);
    });

    // Wait for all requests to complete
    $.when.apply($, requests).then(function() {
        // Arguments will be the results from each request
        var results = arguments.length === 1 ? [arguments[0]] : Array.prototype.slice.call(arguments);

        var options = [];
        var identifierMap = new Map(); // To track unique identifiers and avoid duplicates
        var successCount = 0;
        var errorCount = 0;
        var fallbackExternalIdTypes = [
            'ark', 'arxiv', 'bibcode', 'cstr', 'ean13', 'eissn', 'handle',
            'isbn', 'issn', 'istc', 'lissn', 'lsid', 'pmid', 'purl',
            'upc', 'url', 'uri', 'urn'
        ];

        function getPreferredExternalId(externalIds) {
            if (!Array.isArray(externalIds)) {
                return null;
            }

            var selfIds = externalIds.filter(function(id) {
                return id && id['external-id-relationship'] === 'self';
            });

            if (selfIds.length === 0) {
                return null;
            }

            var doiId = selfIds.find(function(id) {
                return (id['external-id-type'] || '').toLowerCase() === 'doi';
            });

            if (doiId) {
                return doiId;
            }

            return selfIds.find(function(id) {
                var type = (id['external-id-type'] || '').toLowerCase();
                return fallbackExternalIdTypes.includes(type);
            }) || null;
        }

        // Process results from all ORCIDs
        results.forEach(function(result) {
            if (result.success) {
                successCount++;

                result.works.forEach(function(workGroup) {
                    workGroup['work-summary'].forEach(function(workSummary) {
                        if (workSummary['external-ids'] &&
                            workSummary['external-ids']['external-id']) {

                            var externalIds = workSummary['external-ids']['external-id'];
                            var preferredExternalId = getPreferredExternalId(externalIds);

                            if (preferredExternalId) {
                                const identifierValue = preferredExternalId['external-id-value'];
                                const identifierType = (preferredExternalId['external-id-type'] || '').toLowerCase();
                                let urlValue;
                                if(preferredExternalId['external-id-url'] && preferredExternalId['external-id-url']['value']) {
                                    urlValue = preferredExternalId['external-id-url']['value'];
                                }
                                // Only add if we haven't seen this identifier before
                                if (!identifierMap.has(identifierValue)) {
                                    // Get publication year if available
                                    let year = "";
                                    let yearValue = 0;
                                    if (workSummary['publication-date'] &&
                                        workSummary['publication-date']['year'] &&
                                        workSummary['publication-date']['year']['value']) {
                                        yearValue = parseInt(workSummary['publication-date']['year']['value']);
                                        year = " (" + yearValue + ")";
                                    }

                                    const option = {
                                        id: identifierValue,
                                        text: workSummary.title.title.value + year,
                                        year: yearValue,
                                        orcidId: result.orcidId,
                                        workSummary: workSummary,
                                        putCode: workSummary['put-code'],
                                        identifierType: identifierType,
                                        url: urlValue
                                    };

                                    options.push(option);
                                    identifierMap.set(identifierValue, option);
                                }
                            }
                        }
                    });
                });
            } else {
                errorCount++;
            }
        });

        // Sort by year (newest first)
        options.sort(function(a, b) {
            return b.year - a.year;
        });

        // Enable select2 with search capability
        if (options.length > 0) {
            // Destroy existing Select2 instance if it exists
            if ($("#" + selectId).hasClass("select2-hidden-accessible")) {
                $("#" + selectId).select2('destroy');
            }

            // Clear and re-enable the select element
            $("#" + selectId).empty().prop("disabled", false);

            // Initialize Select2 with proper configuration
            $("#" + selectId).select2({
                data: options,
                theme: "classic",
                placeholder: "Type to search publications",
                allowClear: true,
                width: '100%',
                minimumResultsForSearch: 0, // Always show search box
                templateResult: formatPublication,
                matcher: customMatcher,
                dropdownParent: $("#" + selectId).closest('.modal-body') // Ensure dropdown renders within modal
            });

            // Pre-select the current DOI if it exists in the options
            var matchingOption;
            if (preselectedPid) {
                var normalizedPreselected = preselectedPid.trim().toLowerCase();
                matchingOption = options.find(function(opt) {
                    return opt.id.toLowerCase() === normalizedPreselected;
                });
            }
            if (matchingOption) {
                $("#" + selectId).val(matchingOption.id).trigger('change');
            } else {
                // If no pre-selection, ensure the placeholder is shown
                $("#" + selectId).val(null).trigger('change');
            }


            // Small delay to ensure DOM is ready, then open the dropdown
            setTimeout(function() {
                $("#" + selectId).select2('open');
                // Focus the search input
                $('.select2-search__field').focus();
            }, 100);
        } else {
            var message = "No identifiers found";
            if (successCount > 0) {
                message += " in " + successCount + " ORCID profile" + (successCount > 1 ? "s" : "");
            }
            if (errorCount > 0) {
                message += " (" + errorCount + " profile" + (errorCount > 1 ? "s" : "") + " failed to load)";
            }
            $("#" + selectId).empty().append(new Option(message, "")).prop("disabled", true);
        }
    });
}

// Custom matcher for better search experience
function customMatcher(params, data) {
    // If there are no search terms, return all of the data
    if ($.trim(params.term) === '') {
        return data;
    }

    // Do not display the item if there is no 'text' property
    if (typeof data.text === 'undefined') {
        return null;
    }

    // `params.term` should be the term that is used for searching
    // `data.text` is the text that is displayed for the data object
    if (data.text.toLowerCase().indexOf(params.term.toLowerCase()) > -1) {
        return data;
    }

    // Return `null` if the term should not be displayed
    return null;
}

// Format the publication display in the dropdown
function formatPublication(publication) {
    if (!publication.id) {
        return publication.text;
    }

    var orcidInfo = '';
    if (publication.orcidId) {
        orcidInfo = '<div class="publication-orcid text-muted small">From ORCID: ' + publication.orcidId + '</div>';
    }

    return $(
        '<div class="publication-item">' +
        '<div class="publication-title">' + publication.text + '</div>' +
        '<div class="publication-doi text-muted small">' + publication.identifierType + ': ' + publication.id + '</div>' +
        orcidInfo +
        '</div>'
    );
}

/**
 * Extracts the ORCID iD from a full ORCID URL.
 *
 * @param {string} orcidUrlOrId - The full ORCID URL (e.g., "https://orcid.org/0000-0001-8462-650X")
 *                                 or an ORCID iD itself.
 * @return {string|null} The extracted ORCID iD (e.g., "0000-0001-8462-650X"),
 *                       or the original string if it's not a URL.
 *                       Returns null if the input is null or empty.
 */
function extractOrcidIdFromUrl(orcidUrlOrId) {
    if (!orcidUrlOrId || orcidUrlOrId.trim() === '') {
        return null;
    }

    var orcidUrlPattern = /^https?:\/\/(?:sandbox\.)?orcid\.org\/(.+)$/i;
    var match = orcidUrlOrId.match(orcidUrlPattern);

    if (match && match[1]) {
        return match[1];
    }

    // If it's not a URL, assume it's already the ID
    return orcidUrlOrId;
}

/**
 * Finds all ORCID identifiers from input elements with data-cvoc-protocol="orcid"
 * and data-cvoc-parent="author".
 *
 * @return {Array<string>} Array of ORCID IDs (not URLs)
 */
function findAuthorOrcids() {
    var orcidIds = [];
    var orcidInputs = $('input[data-cvoc-protocol^="orcid"][data-cvoc-parent="author"]');

    orcidInputs.each(function() {
        var value = $(this).val();
        if (value) {
            var orcidId = extractOrcidIdFromUrl(value);
            if (orcidId && !orcidIds.includes(orcidId)) {
                orcidIds.push(orcidId);
            }
        }
    });

    return orcidIds;
}

/**
 * Fetches detailed work information from ORCID API
 *
 * @param {string} orcidId - The ORCID identifier
 * @param {string} putCode - The put-code for the specific work
 * @return {Promise} Promise that resolves with the work details
 */
function fetchWorkDetails(orcidId, putCode) {
    return $.ajax({
        type: "GET",
        url: window.publications.state.orcidBaseUrl + orcidId + "/work/" + putCode,
        dataType: 'json',
        headers: {
            'Accept': 'application/json'
        }
    });
}

/**
 * Formats a citation from ORCID work data.
 * For DOI identifiers, tries Cite first. Otherwise, or on failure, uses
 * ORCID's citation-value if available, then falls back to basic formatting.
 *
 * @param {Object} workSummary - The work summary object from ORCID API
 * @param {Object} workDetails - The detailed work object from ORCID API
 * @param {string} identifierType - The selected identifier type
 * @param {string} identifier - The selected identifier value
 * @return {Promise<string>} Promise resolving to a formatted citation string
 */
function formatCitation(workSummary, workDetails, identifierType, identifier) {
    var normalizedIdentifierType = (identifierType || '').toLowerCase();
    var citationValue = workDetails &&
        workDetails.citation &&
        workDetails.citation['citation-value'];

    if (normalizedIdentifierType === 'doi' && identifier) {
        return formatCitationText(identifier)
            .catch(function(error) {
                console.warn("DOI-based citation formatting failed, falling back:", error);

                if (citationValue) {
                    return citationValue;
                }

                return formatBasicCitation(workSummary);
            });
    }

    if (citationValue) {
        return Promise.resolve(citationValue);
    }

    return Promise.resolve(formatBasicCitation(workSummary));
}

function formatCitationText(identifier) {
    return window.publications.state.cslStylePromise
        .then(() => Cite.async(identifier))
        .then(citation => {
            const formatted = citation.format('bibliography', {
                format: 'text',
                template: window.publications.config.selectedFormat,
                lang: 'en-US'
            });
            return formatted;
        });
}

/**
 * Basic citation formatting fallback.
 *
 * @param {Object} workSummary - The work summary object from ORCID API
 * @return {string} Basic formatted citation
 */
function formatBasicCitation(workSummary) {
    var citation = workSummary.title.title.value;

    // Add year if available
    if (workSummary['publication-date'] &&
        workSummary['publication-date']['year'] &&
        workSummary['publication-date']['year']['value']) {
        citation += " (" + workSummary['publication-date']['year']['value'] + ")";
    }

    // Add journal title if available
    if (workSummary['journal-title'] && workSummary['journal-title']['value']) {
        citation += ". " + workSummary['journal-title']['value'];
    }

    return citation;
}

function getOrcidBaseUrl(element) {
    if (typeof window.publications.state.orcidBaseUrl === 'undefined' || window.publications.state.orcidBaseUrl === null) {

        window.publications.state.orcidBaseUrl = $(element).attr('data-cvoc-service-url');
        if (!window.publications.state.orcidBaseUrl) {
            window.publications.state.orcidBaseUrl = "https://orcid.org/v3.0/";
        }
    }
}

function showOrcidTeaser() {
    if (document.getElementById('orcid-teaser')) {
        return;
    }

    const teaser = document.createElement('div');
    teaser.id = 'orcid-teaser';
    teaser.style.cssText = "margin-top: 10px; padding: 0; font-size: 0.9em; color: #6c757d; font-weight: normal; text-align: left;";
    teaser.textContent = window.publications.state.i18n.addOrcidForAuthorsHint;

    // Find the label for the 'Related Publication' field and append the teaser there.
    const publicationLabel = $('#metadata_publication');
    if (publicationLabel) {
        publicationLabel.append(teaser);
    }
}