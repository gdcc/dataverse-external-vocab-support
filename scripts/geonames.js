
// Geonames integration for the Dataverse External CVOC 

// Some code for getting the username for the API
// NOTE: Replace with real value!
var geonamesUsername = "{{ geonames_api_username }}"; // kind of an API key for the Geonames service


// Note that these selectors should match the Dataverse CVOC configuration
var placeSelector = "span[data-cvoc-protocol='geonames']";
var placeInputSelector = "input[data-cvoc-protocol='geonames']";
var placePrefix = "place:";



$(document).ready(function() {
    expandPlaces(); // This is the display part
    updatePlaceInputs(); // This is the input part (autocomplete dropdown)
});

// This function formats the place name for display
// It uses the place object to construct a string
function getFormattedPlacename(place) {
    var name = place.name;

    let nameDetailsArray = [];

    if (place.toponymName && place.toponymName !== place.name) {
        nameDetailsArray.push(place.toponymName);
    }
    if (place.adminName1 && place.adminName1 !== place.name) {
        nameDetailsArray.push(place.adminName1);
    }
    if (place.countryName && place.countryName !== place.name) {
        nameDetailsArray.push(place.countryName);
    }

    if (nameDetailsArray.length > 0) {
        // If there are additional details, append them in parentheses
        name += " (" + nameDetailsArray.join(', ') + ")";
    }
    return name;
}

// For displaying the places; expanding the info for the geonames IDs
function expandPlaces() {
    // Check each selected element
    $(placeSelector).each(function() {
        var placeElement = this;
        // If it hasn't already been processed
        if (!$(placeElement).hasClass('expanded')) {
            // Mark it as processed
            $(placeElement).addClass('expanded');
            // extract the ID
            var id = placeElement.textContent;
            if (id.startsWith("https://sws.geonames.org/")) {
                id = id.substring(25);
            }
            // check if id is a number  
            if (id.match(/^\d+$/) !== null) {

                // If it is a valid ID, try to get the name
                // Try it as an ID
                $.ajax({
                    type: "GET",
                    url: "https://secure.geonames.org/getJSON?formatted=true&geonameId=" + id + "&username=" + geonamesUsername + "&style=full",
                    dataType: 'json',
                    headers: {
                        'Accept': 'application/json'
                    },
                    success: function(place, status) {
                        // If found, construct the HTML for display
                        // extract the name from the JSON response
                        var name = getFormattedPlacename(place);
                        // Note there is no logo for geonames service so we just use the geonames site icon
                        var displayElement = $('<span/>').text(name).append($('<a/>').attr('href', 'https://sws.geonames.org/' + id)
                                            .attr('target', '_blank').attr('rel', 'noopener')
                                            .html('<img alt="Geoname logo?" src="https://www.geonames.org/geonames.ico" width="16" height="16" style="margin-left:4px;margin-right:4px;" />'));
                        $(placeElement).hide();
                        let sibs = $(placeElement).siblings("[data-cvoc-index='" + $(placeElement).attr('data-cvoc-index') + "']");
                        if (sibs.length == 0) {
                            displayElement.prependTo($(placeElement).parent());
                        } else {
                            displayElement.insertBefore(sibs.eq(0));
                        }
                        // NOTE: Not sure why it is not just displayElement.insertBefore($(placeElement));

                        //Store the most recent IDs - could cache results, but currently using this just to prioritized recently used ORCIDs in search results
                        storeValue(placePrefix, id, name);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        //Treat as plain text
                        $(placeElement).show();
                        let index = $(placeElement).attr('data-cvoc-index');
                        if (index !== undefined) {
                            $(placeElement).siblings("[data-cvoc-index='" + index + "']").show().removeClass('hidden');
                        }
                        //Generic logging if not 404
                        if (jqXHR.status != 404) {
                            console.error("The following error occurred: " + textStatus, errorThrown);
                        }
                    }
                });
            } else {
                // Plain text entry
                $(placeElement).show();
                let index = $(placeElement).attr('data-cvoc-index');
                if (index !== undefined) {
                    $(placeElement).siblings("[data-cvoc-index='" + index + "']").show().removeClass('hidden');
                }
            }
        }
    });
}


function updatePlaceInputs() {
    //For each input element within placeInputSelector elements
    $(placeInputSelector).each(function() {
        var placeInput = this;
        if (!placeInput.hasAttribute('data-place')) {
            //Random identifier
            let num = Math.floor(Math.random() * 100000000000);
            $(placeInput).attr('data-place', num);

            let parentField = $(placeInput).attr('data-cvoc-parent');
            var parent = $(placeInput).closest("[data-cvoc-parentfield='" + parentField + "']");

            let hasParentField = $("[data-cvoc-parentfield='" + parentField + "']").length > 0;
            let managedFields = {};
            if (hasParentField) {
                managedFields = JSON.parse($(placeInput).attr('data-cvoc-managedfields'));
                if (Object.keys(managedFields).length > 0) {
                    //Hide managed fields
                    $(parent).find("input[data-cvoc-managed-field='" + managedFields.placeName + "']").hide();
                    $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent().hide();
                }
                //Hide the actual input and give it a data-place number so we can find it
                $(placeInput).parent().hide();
            } else {
                $(placeInput).hide();
            }

            $(placeInput).attr('data-place', num);
            //Todo: if not displayed, wait until it is to then create the select 2 with a non-zero width

            let allowFreeText = $(placeInput).data("cvoc-allowfreetext");

            //Add a select2 element to allow search and provide a list of choices
            var selectId = "placeAddSelect_" + num;
            $(placeInput).parent().parent().children('div').eq(0).append(
                '<select id=' + selectId + ' class="form-control add-resource select2" tabindex="0">');
            $("#" + selectId).select2({
                theme: "classic",
                tags: allowFreeText,
                delay: 500,
                templateResult: function(item) {
                    // No need to template the searching text
                    if (item.loading) {
                        return item.text;
                    }

                    // markMatch bolds the search term if/where it appears in the result
                    var $result = markMatch2(item.text, term);
                    return $result;
                },
                templateSelection: function(item) {
                    // For a selection, add HTML to make the ID a link
                    // get number from the item.text end
                    var numberMatch = item.text.match(/[0-9]+$/);
                    if (numberMatch) {
                        var id = numberMatch[0];
                        return $('<span></span>').append(item.text.replace(id, "<a href='https://sws.geonames.org/" + id + "' target='_blank'>" + id + "</a>"));
                    }
                    return item.text;
                },
                language: {
                    searching: function(params) {
                        // Change this to be appropriate for your application
                        return 'Search by name…';
                    }
                },
                placeholder: placeInput.hasAttribute("data-cvoc-placeholder") ? $(placeInput).attr('data-cvoc-placeholder') : "Select or enter...",
                minimumInputLength: 3,
                allowClear: true,
                ajax: {
                    //Use an ajax call to retrieve matching results
                    url: function(params) {
                        var term = params.term;
                        if (!term) {
                            term = "";
                        }
                        // Use the geonames search service; NOTE it is not HTTPS !
                        return "https://secure.geonames.org/searchJSON";
                    },
                    data: function(params) {
                        term = params.term;
                        if (!term) {
                            term = "";
                        }
                        var query = {
                            q: '*',
                            name_startsWith: term, 
                            username: geonamesUsername,
                            // Currently we just get the top 10 hits. We could get, for example, the top 50, sort as below to put recently used IDs at the top, and then limit to 10
                            maxRows: 10
                        }
                        return query;
                    },
                    //request json (vs XML default)
                    headers: {
                        'Accept': 'application/json'
                    },
                    processResults: function(data, page) {
                        let newItems = data['geonames'];
                        if (newItems == null) {
                            return { results: [] };
                        }
                        return {
                            results: data['geonames']
                                //Sort to bring recently used IDS to the top of the list
                                .sort((a, b) => Number(getValue(placePrefix, b['geonameId']).name != null) - Number(getValue(placePrefix, a['geonameId']).name != null))
                                .map(
                                    function(x) {
                                        return {
                                            text: getFormattedPlacename(x) + "; " + x['geonameId'],    
                                            id: x['geonameId'],
                                            //Since clicking in the selection re-opens the choice list, one has to use a right click/open in new tab/window to view the ORCID page
                                            //Using title to provide that hint as a popup
                                            title: 'Open in new tab to view geonames page'
                                        }
                                    })
                        };
                    }
                }
            });
            //Add a tab stop and key handling to allow the clear button to be selected via tab/enter
            const observer = new MutationObserver((mutationList, observer) => {
                var button = $('#' + selectId).parent().find('.select2-selection__clear');
                console.log("BL : " + button.length);
                button.attr("tabindex", "0");
                button.on('keydown', function(e) {
                    if (e.which == 13) {
                        $('#' + selectId).val(null).trigger('change');
                    }
                });
            });

            observer.observe($('#' + selectId).parent()[0], {
                childList: true,
                subtree: true
            });
            //If the input has a value already, format it the same way as if it were a new selection
            var id = $(placeInput).val();
            if (id.startsWith("https://sws.geonames.org/")) {
                id = id.substring(25);
                $.ajax({
                    type: "GET",
                    url: "https://secure.geonames.org/getJSON?formatted=true&geonameId=" + id + "&username=" + geonamesUsername + "&style=full",
                    dataType: 'json',
                    headers: {
                        'Accept': 'application/json'
                    },
                    success: function(place, status) {
                        // extract the name from the JSON response
                        var name = getFormattedPlacename(place);
                        
                        var text = name + "; " + id;
                        var newOption = new Option(text, id, true, true);
                        newOption.title = 'Open in new tab to view geonames page';
                        $('#' + selectId).append(newOption).trigger('change');
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        if (jqXHR.status != 404) {
                            console.error("The following error occurred: " + textStatus, errorThrown);
                        }
                    }
                });
            } else {
                //If the initial value is not an ID (legacy, or if tags are enabled), just display it as is
                if (Object.keys(managedFields).length > 0) {
                    //Handle managed fields
                    if (id.length > 0) {
                        $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent().show();
                        $(placeInput).parent().show();
                    }
                    id = $(parent).find("input[data-cvoc-managed-field='" + managedFields.placeName + "']").val();
                }

                var newOption = new Option(id, id, true, true);
                $('#' + selectId).append(newOption).trigger('change');
            }
            //Cound start with the selection menu open
            //    $("#" + selectId).select2('open');
            //When a selection is made, set the value of the hidden input field
            $('#' + selectId).on('select2:select', function(e) {
                var data = e.params.data;
                //For geoname IDs, the id and text are different
                if (data.id != data.text) {
                    $("input[data-place='" + num + "']").val("https://sws.geonames.org/" + data.id);
                } else {
                    //Tags are allowed, so just enter the text as is
                    $("input[data-place='" + num + "']").val(data.id);
                }

                //In the multi-field case, we should also fill in the other hidden managed fields
                if (hasParentField) {
                    var parent = $("input[data-place='" + num + "']").closest("[data-cvoc-parentfield='" + parentField + "']");
                    let isGeonamesId = data.text.includes(';');
                    for (var key in managedFields) {
                        if (key == 'placeName') {
                            $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']").attr('value', data.text.split(";", 1)[0]);
                        } else if (key == 'idType') {
                            let selectField = $(parent).find("[data-cvoc-managed-field='" + managedFields[key] + "']").find("select");
                            let geonamesIdVal = $(selectField).find('option:contains("GEONAMES")').val(); // Not sure how this works!
                            $(selectField).val(isGeonamesId ? geonamesIdVal : '');
                        }
                    }
                    if (Object.keys(managedFields).length > 0) {
                        if (isGeonamesId) {
                            //Hide managed fields
                            $(parent).find("input[data-place='" + num + "']").parent().hide();
                            $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent().hide();
                        } else {
                            //Show managed fields
                            let idField = $(parent).find("input[data-place='" + num + "']");
                            idField.val('');
                            idField.parent().show();
                            $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent().show();
                        }
                    }
                }
            });
            //When a selection is cleared, clear the hidden input
            $('#' + selectId).on('select2:clear', function(e) {
                $(this).empty().trigger("change");
                $("input[data-place='" + num + "']").attr('value', '');
                //In the multi-field case, we should also clear the other hidden managed fields
                if (hasParentField) {
                    var parent = $("input[data-place='" + num + "']").closest("[data-cvoc-parentfield='" + parentField + "']");
                    for (var key in managedFields) {
                        if (key == 'placeName') {
                            $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']").val('');
                        } else if (key == 'idType') {
                            $(parent).find("[data-cvoc-managed-field='" + managedFields[key] + "']").find("select").val('');
                        }
                    }
                }
            });
            //Force cursor to appear in text box when opening via key press
            $('#' + selectId).on('select2:open', function(e) {
                $(".select2-search__field").focus()
                $(".select2-search__field").attr("id", selectId + "_input")
                document.getElementById(selectId + "_input").select();
            });
        }
    });
}
