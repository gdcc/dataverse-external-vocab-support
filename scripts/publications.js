var doiSelector = "span[data-cvoc-protocol='publication']";
var doiInputSelector = "input[data-cvoc-protocol='publication']";
var orcidBaseUrl;
var templatePromises = {};

$(document).ready(function() {
    $.getScript("https://cdn.jsdelivr.net/npm/citation-js").done(function() {
        expandPids();
        updatePidInputs();
    });
});

function formatCitationText(doi) {
    return fetch('https://raw.githubusercontent.com/citation-style-language/styles/master/chicago-author-date.csl')
        .then(r => r.text())
        .then(styleXml => {
            Cite.plugins.config.get('@csl').templates.add('chicago-author-date', styleXml);
            return Cite.async(doi); // just pass the DOI string directly
        })
        .then(citation => {
            const formatted = citation.format('bibliography', {
                format: 'text',
                template: 'chicago-author-date',
                lang: 'en-US'
            });
            return formatted;
        });
}

function expandPids() {
    $(doiSelector).each(function() {
        var doiElement = this;
        if (!$(doiElement).hasClass('expanded')) {
            $(doiElement).addClass('expanded');
            var doi = doiElement.textContent;

            getOrcidBaseUrl(doiElement);
            // Use CrossRef API to get metadata for the DOI
            var doiOnly = doi.replace(/^doi:/, '');
            formatCitationText(doi).then(citationText => {
                // Get the data-cvoc-index from the DOI element
                var cvocIndex = $(doiElement).attr('data-cvoc-index');

                // Find the relation type element with the same data-cvoc-index
                var relationTypeElement = $('[data-cvoc-metadata-name="publicationRelationType"][data-cvoc-index="' + cvocIndex + '"]');
                var relationType = relationTypeElement.length > 0 ? relationTypeElement.text().trim() : '';

                var citationContent = $('<div/>').css({
                    'margin-left': '2em',
                    'margin-right': '2em',
                    'background-color': '#e3f2fd',
                    'padding': '0.75em',
                    'border-radius': '0.5em',
                    'display': 'block'
                }).text(citationText)
                    .append($('<a/>').attr('href', "https://doi.org/" + doiOnly).attr('target', '_blank').text(" [DOI]"));

                var displayElement = $('<div/>');

                if (relationType) {
                    // Hide the plain text relation type
                    relationTypeElement.parent().contents().filter(function() {
                        return this.nodeType === 3; // Text node
                    }).wrap('<span style="display:none;"></span>');

                    // Add relation type as bold text above
                    displayElement.append($('<div/>').css({
                        'font-style': 'italic',
                        'margin-bottom': '0.5em'
                    }).text(relationType));

                    // Add citation with left margin
                    displayElement.append($('<div/>').css('margin-left', '2em').append(citationContent));
                } else {
                    displayElement.append(citationContent);
                }

                $(doiElement).hide();
                displayElement.insertBefore($(doiElement));
            });
        }
    });
}

// --------------------------------------------------------------------------
// Internationalization (i18n) Support
// --------------------------------------------------------------------------
var i18n = {};

/**
 * Asynchronously loads the internationalization properties for the given locale.
 * Defaults to 'en' if the locale is not found.
 * @param {string} lang - The language code (e.g., 'en', 'fr').
 * @param {string} scriptPath - The path to the current script.
 * @returns {Promise<Object>} A promise that resolves with the i18n object.
 */
function loadI18n(lang, scriptPath) {
    var langFile = scriptPath.substring(0, scriptPath.lastIndexOf('/')) + '/i18n/publications_' + lang + '.json';

    return fetch(langFile)
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            // Fallback to English if the language file is not found
            if (lang !== 'en') {
                console.warn("Language file not found for: " + lang + ". Falling back to 'en'.");
                return loadI18n('en', scriptPath);
            }
            throw new Error('Default language file "en.json" not found.');
        })
        .then(data => {
            i18n = data;
            return i18n;
        })
        .catch(error => {
            console.error('Failed to load i18n file:', error);
            // Use a minimal set of English defaults as a last resort
            i18n = {
                searchAndSelectPublication: "Search and select a publication:",
                cancel: "Cancel",
                loadingPublicationsOne: "Loading publications from ORCID profile...",
                loadingPublicationsMany: "Loading publications from {0} ORCID profiles...",
                selectPublication: "Select a publication",
                findUsingOrcid: "Find using ORCID",
                findUsingOrcid_ariaLabel: "Simplify adding publications by importing them the authors' ORCID profiles",
                findAndImportPublicationFromOrcid: "Find and import publication from ORCID",
                addOrcidForAuthorsHint: "Hint: If you add ORCIDs for authors, you can select Related Publications from their profiles!"
            };
            return i18n;
        });
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

function updatePidInputs() {
    // Get the current language from the HTML element
    var lang = $('html').attr('lang') || 'en';
    var scriptSrc = $('script[src*="publications.js"]').attr('src');

    // Load translations before proceeding
    loadI18n(lang, scriptSrc).then(function() {
        $(doiInputSelector).each(function() {
            var doiInput = this;
            if (!doiInput.hasAttribute('data-pub-lookup')) {
                let num = Math.floor(Math.random() * 100000000000);
                $(doiInput).attr('data-pub-lookup', num);

                getOrcidBaseUrl(doiInput);

                // Find the citation field to place the button above it
                let parentField = $(doiInput).attr('data-cvoc-parent');
                let hasParentField = $("[data-cvoc-parentfield='" + parentField + "']").length > 0;

                if (hasParentField) {
                    var parent = $(doiInput).closest("[data-cvoc-parentfield='" + parentField + "']");
                    let managedFields = JSON.parse($(doiInput).attr('data-cvoc-managedfields'));

                    // Find the citation field
                    if (managedFields['citation']) {
                        let citationField = $(parent).find("textarea[data-cvoc-managed-field='" + managedFields['citation'] + "']");

                        if (citationField.length > 0) {
                            // Only add the button if there are authors with ORCID identifiers
                            var authorOrcids = findAuthorOrcids();
                            if (authorOrcids.length > 0) {
                                // Create button and modal above the citation field
                                var modalId = "orcidModal_" + num;
                                var selectId = "doiAddSelect_" + num;

                                // ORCID SVG icon for the button
                                var orcidIconSvg = '<svg width="16" height="16" viewBox="0 0 256 256" style="vertical-align: text-bottom; margin-right: 5px;"><path fill="#A6CE39" d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z"/><path fill="#FFF" d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7C191.7 111.2 183.8 88 148.8 88h-24.5v84.4zM80.4 66.4c-8.5 0-15.4-6.9-15.4-15.4 0-8.5 6.9-15.4 15.4-15.4 8.5 0 15.4 6.9 15.4 15.4 0 8.5-6.9 15.4-15.4 15.4z"/></svg>';

                                // Create button HTML (to be inserted before citation field)
                                var buttonHtml =
                                    '<div style="margin-bottom: 10px;">' +
                                    '  <button id="findOnOrcid_' + num + '" class="btn btn-default" type="button" aria-label="' + i18n.findUsingOrcid_ariaLabel + '" title="' + i18n.findUsingOrcid_ariaLabel + '">' + i18n.findUsingOrcid + ' ' + orcidIconSvg  + '</button>' +
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
                                $("#findOnOrcid_" + num).on('click', function(e) {
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

                                    // Get current DOI value to pre-select
                                    var currentDoi = $(doiInput).val();

                                    // Fetch works from all ORCIDs
                                    fetchOrcidWorks(authorOrcids, selectId, currentDoi);

                                    return false;
                                });

                                // Handle selection
                                $('#' + selectId).on('select2:select', function(e) {
                                    var data = e.params.data;

                                    // Get current DOI value
                                    var currentDoi = $(doiInput).val().trim();

                                    // If selecting the same DOI that's already there and it's not blank, close modal without changes
                                    if (currentDoi && data.id === currentDoi) {
                                        $("#" + modalId).modal('hide');
                                        return;
                                    }

                                    // Otherwise, update the DOI field (whether it was blank or different)
                                    $(doiInput).val(data.id);

                                    // Handle managed fields
                                    for (var key in managedFields) {
                                        if (key == 'idType') {
                                            // Set the identifier type to DOI
                                            let selectContainer = $(parent).find("[data-cvoc-managed-field='" + managedFields[key] + "']");
                                            let selectField = $(parent).find("[data-cvoc-managed-field='" + managedFields[key] + "']").find("select");
                                            let doiOption = $(selectField).find('option:contains("doi")');
                                            let doiVal = doiOption.val();
                                            $(selectField).val(doiVal).attr('value', doiVal);
                                            // Update the selected attribute on the option
                                            selectField.find('option').removeAttr('selected');
                                            doiOption.attr('selected', 'selected');

                                            // Update the visible label that displays the selection
                                            let label = selectContainer.find('label.ui-selectonemenu-label');
                                            if (label.length > 0) {
                                                label.text('doi');
                                                label.removeClass('ui-state-default');
                                            }
                                        } else if (key == 'url') {
                                            // Set the URL to the DOI resolver URL
                                            let urlField = $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']");
                                            $(urlField).val('https://doi.org/' + data.id).attr('value', 'https://doi.org/' + data.id);
                                        } else if (key == 'citation') {
                                            // Fetch the detailed work information to get BibTeX citation
                                            let citationField = $(parent).find("textarea[data-cvoc-managed-field='" + managedFields[key] + "']");

                                            // Show loading indicator
                                            $(citationField).val('Loading citation...').attr('value', 'Loading citation...');

                                            // Fetch work details including BibTeX
                                            fetchWorkDetails(data.orcidId, data.putCode)
                                                .then(function(workDetails) {
                                                    var citation;

                                                    // Use BibTeX citation if available
                                                    if (workDetails && workDetails.citation &&
                                                        workDetails.citation['citation-type'] === 'bibtex' &&
                                                        workDetails.citation['citation-value']) {
                                                        citation = formatCitation(data.workSummary, workDetails.citation['citation-value']);
                                                    } else {
                                                        // Fall back to formatted citation from work summary
                                                        citation = formatCitation(data.workSummary);
                                                    }

                                                    $(citationField).val(citation).attr('value', citation);
                                                })
                                                .catch(function(error) {
                                                    console.error("Error fetching work details: ", error);
                                                    // Fall back to basic formatting on error
                                                    var citation = formatCitation(data.workSummary);
                                                    $(citationField).val(citation).attr('value', citation);
                                                });
                                        }
                                    }

                                    // Close the modal after selection
                                    $("#" + modalId).modal('hide');
                                });

                                // Handle clear
                                $('#' + selectId).on('select2:clear', function(e) {
                                    $(doiInput).val('').attr('value', '');

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
    });
}

/**
 * Fetches works from one or more ORCID profiles and populates a select element.
 *
 * @param {string|Array<string>} orcidIds - Single ORCID ID or array of ORCID IDs
 * @param {string} selectId - The ID of the select element to populate
 * @param {string} preselectedDoi - Optional DOI to pre-select in the dropdown
 */
function fetchOrcidWorks(orcidIds, selectId, preselectedDoi) {
    // Normalize input to always be an array
    var orcidArray = Array.isArray(orcidIds) ? orcidIds : [orcidIds];

    if (orcidArray.length === 0) {
        $("#" + selectId).empty().append(new Option("No ORCID identifiers provided", "")).prop("disabled", true);
        return;
    }

    // Track all AJAX requests
    var requests = [];
    var allWorks = [];

    // Create a request for each ORCID
    orcidArray.forEach(function(orcidId) {
        var request = $.ajax({
            type: "GET",
            url: orcidBaseUrl + orcidId + "/works",
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
        var doiMap = new Map(); // To track unique DOIs and avoid duplicates
        var successCount = 0;
        var errorCount = 0;

        // Process results from all ORCIDs
        results.forEach(function(result) {
            if (result.success) {
                successCount++;

                result.works.forEach(function(workGroup) {
                    workGroup['work-summary'].forEach(function(workSummary) {
                        if (workSummary['external-ids'] &&
                            workSummary['external-ids']['external-id']) {

                            var externalIds = workSummary['external-ids']['external-id'];
                            var doi = externalIds.find(id => id['external-id-type'] === 'doi');

                            if (doi) {
                                var doiValue = doi['external-id-value'];

                                // Only add if we haven't seen this DOI before
                                if (!doiMap.has(doiValue)) {
                                    // Get publication year if available
                                    var year = "";
                                    var yearValue = 0;
                                    if (workSummary['publication-date'] &&
                                        workSummary['publication-date']['year'] &&
                                        workSummary['publication-date']['year']['value']) {
                                        yearValue = parseInt(workSummary['publication-date']['year']['value']);
                                        year = " (" + yearValue + ")";
                                    }

                                    var option = {
                                        id: doiValue,
                                        text: workSummary.title.title.value + year,
                                        year: yearValue,
                                        orcidId: result.orcidId,
                                        workSummary: workSummary,
                                        putCode: workSummary['put-code']
                                    };

                                    options.push(option);
                                    doiMap.set(doiValue, option);
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
            if (preselectedDoi) {
                var normalizedPreselected = preselectedDoi.trim().toLowerCase();
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
            var message = "No DOIs found";
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

    var $publication = $(
        '<div class="publication-item">' +
        '<div class="publication-title">' + publication.text + '</div>' +
        '<div class="publication-doi text-muted small">DOI: ' + publication.id + '</div>' +
        orcidInfo +
        '</div>'
    );

    return $publication;
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
    var orcidInputs = $('input[data-cvoc-protocol="orcid"][data-cvoc-parent="author"]');

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
 * Fetches detailed work information from ORCID API, including BibTeX citation.
 *
 * @param {string} orcidId - The ORCID identifier
 * @param {string} putCode - The put-code for the specific work
 * @return {Promise} Promise that resolves with the work details
 */
function fetchWorkDetails(orcidId, putCode) {
    return $.ajax({
        type: "GET",
        url: orcidBaseUrl + orcidId + "/work/" + putCode,
        dataType: 'json',
        headers: {
            'Accept': 'application/json'
        }
    });
}

/**
 * Formats a citation from an ORCID work summary.
 * If BibTeX citation is available, it will be used; otherwise falls back to basic formatting.
 *
 * @param {Object} workSummary - The work summary object from ORCID API
 * @param {string} bibtex - Optional BibTeX citation string
 * @return {string} Formatted citation string
 */
function formatCitation(workSummary, bibtex) {
    // If BibTeX citation is available, use it
    if (bibtex) {
        return convertBibtexToCitation(bibtex, workSummary);
    }
    return formatBasicCitation(workSummary);
}

/**
 * Converts BibTeX citation to formatted citation using Citation.js.
 *
 * @param {string} bibtex - BibTeX citation string
 * @param {Object} workSummary - The work summary object (used as fallback)
 * @return {string} Formatted citation
 */
function convertBibtexToCitation(bibtex, workSummary) {
    try {
        // Check if Citation.js is available
        if (typeof Cite === 'undefined') {
            console.warn("Citation.js not loaded, falling back to basic formatting");
            return formatBasicCitation(workSummary);
        }

        // Parse BibTeX and format as IEEE style
        var cite = new Cite(bibtex);

        // Format as IEEE (you can also use 'apa', 'vancouver', 'harvard1', etc.)
        var formatted = cite.format('bibliography', {
            format: 'text',
            template: 'ieee',
            lang: 'en-US'
        });

        return formatted;

    } catch (error) {
        console.error("Error converting BibTeX with Citation.js:", error);
        // Fall back to basic formatting using workSummary
        return formatBasicCitation(workSummary);
    }
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
    if (typeof orcidBaseUrl === 'undefined' || orcidBaseUrl === null) {

        orcidBaseUrl = $(element).attr('data-cvoc-service-url');
        if (!orcidBaseUrl) {
            orcidBaseUrl = "https://orcid.org/v3.0/";
        }
    }
}

function showOrcidTeaser() {
    const teaser = document.createElement('div');
    teaser.style.cssText = "margin-top: 10px; padding: 0; font-size: 0.9em; color: #6c757d; font-weight: normal; text-align: left;";
    teaser.textContent = i18n.addOrcidForAuthorsHint;

    // Find the label for the 'Related Publication' field and append the teaser there.
    const publicationLabel = $('#metadata_publication');
    if (publicationLabel) {
        publicationLabel.append(teaser);
    }
}