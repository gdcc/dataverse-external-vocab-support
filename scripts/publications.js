var doiSelector = "span[data-cvoc-protocol='publication']";
var doiInputSelector = "input[data-cvoc-protocol='publication']";
var orcidBaseUrl;

$(document).ready(function() {
    expandPids();
    updatePidInputs();
});

function expandPids() {
    $(doiSelector).each(function() {
        var doiElement = this;
        if (!$(doiElement).hasClass('expanded')) {
            $(doiElement).addClass('expanded');
            var doi = doiElement.textContent;
            
            getOrcidBaseUrl(doiElement);
            // Use CrossRef API to get metadata for the DOI
            $.ajax({
                type: "GET",
                url: "https://api.crossref.org/works/" + encodeURIComponent(doi),
                dataType: 'json',
                success: function(data) {
                    var work = data.message;
                    var title = work.title ? work.title[0] : "Unknown Title";
                    var authors = work.author ? work.author.map(a => a.family + ", " + a.given).join('; ') : "Unknown Authors";
                    
                    var displayElement = $('<span/>').text(title + " by " + authors)
                        .append($('<a/>').attr('href', "https://doi.org/" + doi).attr('target', '_blank').text(" [DOI]"));
                    
                    $(doiElement).hide();
                    displayElement.insertBefore($(doiElement));
                },
                error: function() {
                    $(doiElement).show();
                }
            });
        }
    });
}

function updatePidInputs() {
    $(doiInputSelector).each(function() {
        var doiInput = this;
        if (!doiInput.hasAttribute('data-pub-lookup')) {
            let num = Math.floor(Math.random() * 100000000000);
            $(doiInput).attr('data-pub-lookup', num);
            
            var selectId = "doiAddSelect_" + num;
            $(doiInput).parent().append(
                '<button id="findOnOrcid_' + num + '" class="btn btn-default" type="button">Find on ORCID</button>' +
                '<select id="' + selectId + '" class="form-control add-resource select2" style="display:none;"></select>'
            );
            getOrcidBaseUrl(doiInput);

            $("#findOnOrcid_" + num).on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Find all author ORCIDs
                var authorOrcids = findAuthorOrcids();
                
                if (authorOrcids.length === 0) {
                    alert("No ORCID identifiers found for authors. Please add author ORCID identifiers first.");
                    return false;
                }
                
                // Show loading indicator
                var loadingMessage = authorOrcids.length === 1 
                    ? "Loading publications from ORCID profile..." 
                    : "Loading publications from " + authorOrcids.length + " ORCID profiles...";
                $("#" + selectId).empty().append(new Option(loadingMessage, "")).prop("disabled", true).show();
                
                // Fetch works from all ORCIDs
                fetchOrcidWorks(authorOrcids, selectId);
                
                return false;
            });

            // Initialize select2 with search capability
            $("#" + selectId).select2({
                theme: "classic",
                placeholder: "Select a DOI",
                allowClear: true,
                width: '100%'
            });

            $('#' + selectId).on('select2:select', function(e) {
                var data = e.params.data;
                $(doiInput).val(data.id);

                // Handle managed fields similar to people.js
                let parentField = $(doiInput).attr('data-cvoc-parent');
                let hasParentField = $("[data-cvoc-parentfield='" + parentField + "']").length > 0;

                if (hasParentField) {
                    var parent = $(doiInput).closest("[data-cvoc-parentfield='" + parentField + "']");
                    let managedFields = JSON.parse($(doiInput).attr('data-cvoc-managedfields'));
                    
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
                                label.removeClass('ui-state-default'); // Remove default styling if present
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
                }
            });

            $('#' + selectId).on('select2:clear', function(e) {
                $(doiInput).val('').attr('value', '');

                // Clear managed fields similar to people.js
                let parentField = $(doiInput).attr('data-cvoc-parent');
                let hasParentField = $("[data-cvoc-parentfield='" + parentField + "']").length > 0;

                if (hasParentField) {
                    var parent = $(doiInput).closest("[data-cvoc-parentfield='" + parentField + "']");
                    let managedFields = JSON.parse($(doiInput).attr('data-cvoc-managedfields'));
                    
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
                                label.addClass('ui-state-default'); // Add default styling back
                            }
                        } else if (key == 'url') {
                            $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']").val('').attr('value', '');
                        } else if (key == 'citation') {
                            $(parent).find("textarea[data-cvoc-managed-field='" + managedFields[key] + "']").val('').attr('value', '');
                        }
                    }
                }
            });
        }
    });
}

/**
 * Fetches works from one or more ORCID profiles and populates a select element.
 * 
 * @param {string|Array<string>} orcidIds - Single ORCID ID or array of ORCID IDs
 * @param {string} selectId - The ID of the select element to populate
 */
function fetchOrcidWorks(orcidIds, selectId) {
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
            $("#" + selectId).empty().prop("disabled", false).select2({
                data: options,
                theme: "classic",
                placeholder: "Type to search publications",
                allowClear: true,
                width: '100%',
                templateResult: formatPublication,
                matcher: customMatcher
            });
            
            // Open the dropdown automatically
            $("#" + selectId).select2('open');
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