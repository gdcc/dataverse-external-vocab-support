var doiSelector = "span[data-cvoc-protocol='publication']";
var doiInputSelector = "input[data-cvoc-protocol='publication']";
var orcidBaseUrl = "https://pub.orcid.org/v3.0/";

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
            });

            $('#' + selectId).on('select2:clear', function(e) {
                $(doiInput).val('');
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
                                        orcidId: result.orcidId
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