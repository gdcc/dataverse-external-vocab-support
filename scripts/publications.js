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
                
                // For now, use the first ORCID found
                var orcidId = authorOrcids[0];
                
                // Show loading indicator
                $("#" + selectId).empty().append(new Option("Loading publications from ORCID " + orcidId + "...", "")).prop("disabled", true).show();
                fetchOrcidWorks(orcidId, selectId);
                
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

function fetchOrcidWorks(orcidId, selectId) {
    $.ajax({
        type: "GET",
        url: orcidBaseUrl + orcidId + "/works",
        dataType: 'json',
        headers: {
            'Accept': 'application/json'
        },
        success: function(data) {
            var works = data.group;
            var options = [];

            works.forEach(function(workGroup) {
                workGroup['work-summary'].forEach(function(workSummary) {
                    if (workSummary['external-ids'] &&
                        workSummary['external-ids']['external-id']) {

                        var externalIds = workSummary['external-ids']['external-id'];
                        var doi = externalIds.find(id => id['external-id-type'] === 'doi');

                        if (doi) {
                            // Get publication year if available
                            var year = "";
                            if (workSummary['publication-date'] && 
                                workSummary['publication-date']['year'] && 
                                workSummary['publication-date']['year']['value']) {
                                year = " (" + workSummary['publication-date']['year']['value'] + ")";
                            }
                            
                            options.push({
                                id: doi['external-id-value'],
                                text: workSummary.title.title.value + year,
                                year: workSummary['publication-date'] ? 
                                      workSummary['publication-date']['year'] ? 
                                      workSummary['publication-date']['year']['value'] : 0 : 0
                            });
                        }
                    }
                });
            });
            
            // Sort by year (newest first)
            options.sort(function(a, b) {
                return b.year - a.year;
            });

            // Enable select2 with search capability
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
            if (options.length > 0) {
                $("#" + selectId).select2('open');
            } else {
                $("#" + selectId).append(new Option("No DOIs found for this ORCID", "")).prop("disabled", true);
            }
        },
        error: function(jqXHR, textStatus, errorThrown) {
            $("#" + selectId).empty().append(new Option("Error loading publications", "")).prop("disabled", true);
            console.error("Error fetching ORCID works: " + textStatus, errorThrown);
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
    
    var $publication = $(
        '<div class="publication-item">' +
        '<div class="publication-title">' + publication.text + '</div>' +
        '<div class="publication-doi text-muted small">DOI: ' + publication.id + '</div>' +
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