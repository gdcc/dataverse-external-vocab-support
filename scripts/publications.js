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
                '<button id="findOnOrcid_' + num + '" class="btn btn-default">Find on ORCID</button>' +
                '<select id="' + selectId + '" class="form-control add-resource select2" style="display:none;"></select>'
            );

            $("#findOnOrcid_" + num).on('click', function(e) {
               e.preventDefault();
               e.stopPropagation();
                var orcidId = prompt("Enter ORCID ID:");
                if (orcidId) {
                    fetchOrcidWorks(orcidId, selectId);
                }
            });

            $("#" + selectId).select2({
                theme: "classic",
                placeholder: "Select a DOI",
                allowClear: true
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
                            options.push({
                                id: doi['external-id-value'],
                                text: workSummary.title.title.value
                            });
                        }
                    }
                });
            });

            $("#" + selectId).empty().select2({
                data: options,
                theme: "classic",
                placeholder: "Select a DOI",
                allowClear: true
            });
            $("#" + selectId).show();
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error("Error fetching ORCID works: " + textStatus, errorThrown);
        }
    });
}

function bakExpandPeople() {
    //Check each selected element
    $(personSelector).each(function() {
        var personElement = this;
        //If it hasn't already been processed
        if (!$(personElement).hasClass('expanded')) {
            //Mark it as processed
            $(personElement).addClass('expanded');
            var orcidBaseUrl = $(personElement).attr('data-cvoc-service-url');
            if(!orcidBaseUrl) {
                orcidBaseUrl="https://orcid.org/";
            }
            var id = personElement.textContent;
            if (id.startsWith(orcidBaseUrl)) {
                id = id.substring(orcidBaseUrl.length);
            }
            if (id.match(/^\d{4}-\d{4}-\d{4}-(\d{4}|\d{3}X)$/) !== null) {
                //Try it as an ORCID (could validate that it has the right form and even that it validates as an ORCID, or can just let the GET fail
                var orcidRertrievalUrl = orcidBaseUrl.replace("https://","https://pub.") + "v3.0/" + id + "/person";
                $.ajax({
                    type: "GET",
                    url: orcidRertrievalUrl,
                    dataType: 'json',
                    headers: {
                        'Accept': 'application/json'
                    },
                    success: function(person, status) {
                        //If found, construct the HTML for display

                        var name = ((person.name['family-name']) ? person.name['family-name'].value + ", " : "") + person.name['given-names'].value;
                        var displayElement = $('<span/>').text(name).append($('<a/>').attr('href', orcidBaseUrl + id).attr('target', '_blank').attr('rel', 'noopener').html('<img alt="ORCID logo" src="https://info.orcid.org/wp-content/uploads/2019/11/orcid_16x16.png" width="16" height="16" />'));
                        $(personElement).hide();
                        let sibs = $(personElement).siblings("[data-cvoc-index='" + $(personElement).attr('data-cvoc-index') + "']");
                        if (sibs.length == 0) {
                            displayElement.prependTo($(personElement).parent());
                        } else {
                            displayElement.insertBefore(sibs.eq(0));
                        }
                        //Store the most recent ORCIDs - could cache results, but currently using this just to prioritized recently used ORCIDs in search results
                        storeValue(orcidPrefix, id, name);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        //Treat as plain text
                        $(personElement).show();
                        let index = $(personElement).attr('data-cvoc-index');
                        if (index !== undefined) {
                            $(personElement).siblings("[data-cvoc-index='" + index + "']").show().removeClass('hidden');
                        }
                        //Generic logging if not 404
                        if (jqXHR.status != 404) {
                            console.error("The following error occurred: " + textStatus, errorThrown);
                        }
                    }
                });
            } else {
                //Plain text entry
                $(personElement).show();
                let index = $(personElement).attr('data-cvoc-index');
                if (index !== undefined) {
                    $(personElement).siblings("[data-cvoc-index='" + index + "']").show().removeClass('hidden');
                }
            }
        }
    });
}

function bakUpdatePeopleInputs() {
    //For each input element within personInputSelector elements
    $(personInputSelector).each(function() {
        var personInput = this;
        if (!personInput.hasAttribute('data-person')) {
            //Random identifier
            let num = Math.floor(Math.random() * 100000000000);
            $(personInput).attr('data-person', num);
            var orcidBaseUrl = $(personInput).attr('data-cvoc-service-url');
            if(!orcidBaseUrl) {
                orcidBaseUrl="https://orcid.org/";
            }
            let parentField = $(personInput).attr('data-cvoc-parent');
            var parent = $(personInput).closest("[data-cvoc-parentfield='" + parentField + "']");

            let hasParentField = $("[data-cvoc-parentfield='" + parentField + "']").length > 0;
            let managedFields = {};
            if (hasParentField) {
                managedFields = JSON.parse($(personInput).attr('data-cvoc-managedfields'));
                if (Object.keys(managedFields).length > 0) {
                    //Hide managed fields
                    $(parent).find("input[data-cvoc-managed-field='" + managedFields.personName + "']").hide();
                    $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent().hide();
                }
                //Hide the actual input and give it a data-person number so we can find it
                $(personInput).parent().hide();
            } else {
                $(personInput).hide();
            }

            $(personInput).attr('data-person', num);
            //Todo: if not displayed, wait until it is to then create the select 2 with a non-zero width

            //Add a select2 element to allow search and provide a list of choices
            var selectId = "personAddSelect_" + num;
            $(personInput).parent().parent().children('div').eq(0).append(
                '<select id=' + selectId + ' class="form-control add-resource select2" tabindex="0">');
            var orcidSearchUrl = orcidBaseUrl.replace("https://","https://pub.") + "v3.0/expanded-search";
            $("#" + selectId).select2({
                theme: "classic",
                tags: $(personInput).attr('data-cvoc-allowfreetext'),
                delay: 500,
                templateResult: function(item) {
                    // No need to template the searching text
                    if (item.loading) {
                        return item.text;
                    }

                    //markMatch bolds the search term if/where it appears in the result
                    var $result = markMatch(item.text, term);
                    return $result;
                },
                templateSelection: function(item) {
                    //For a selection, add HTML to make the ORCID a link
                    var pos = item.text.search(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/);
                    if (pos >= 0) {
                        var orcid = item.text.substr(pos, 19);
                        return $('<span></span>').append(item.text.replace(orcid, "<a href='" + orcidBaseUrl + orcid + "' target='_blank'>" + orcid + "</a>"));
                    }
                    return item.text;
                },
                language: {
                    searching: function(params) {
                        // Change this to be appropriate for your application
                        return 'Search by name, email, or ORCID…';
                    }
                },
                placeholder: personInput.hasAttribute("data-cvoc-placeholder") ? $(personInput).attr('data-cvoc-placeholder') : "Select or enter...",
                minimumInputLength: 3,
                allowClear: true,
                ajax: {
                    //Use an ajax call to ORCID to retrieve matching results
                    url: orcidSearchUrl,
                    data: function(params) {
                        term = params.term;
                        if (!term) {
                            term = "";
                        }
                        term = term.replace(/([+\-&|!(){}[\]^"~*?:\\\/])/g, "\\$1");
                        var query = {
                            q: term,
                            //Currently we just get the top 10 hits. We could get, for example, the top 50, sort as below to put recently used orcids at the top, and then limit to 10
                            rows: 10
                        }
                        return query;
                    },
                    //request json (vs XML default)
                    headers: {
                        'Accept': 'application/json'
                    },
                    processResults: function(data, page) {
                        let newItems = data['expanded-result'];
                        if (newItems == null) {
                            return { results: [] };
                        }
                        return {
                            results: data['expanded-result']
                                //Sort to bring recently used ORCIDS to the top of the list
                                .sort((a, b) => Number(getValue(orcidPrefix, b['orcid-id']).name != null) - Number(getValue(orcidPrefix, a['orcid-id']).name != null))
                                .map(
                                    function(x) {
                                        return {
                                            text: ((x['family-names']) ? x['family-names'] + ", " : "") + x['given-names'] +
                                                "; " +
                                                x['orcid-id'] +
                                                ((x.email.length > 0) ? "; " + x.email[0] : ""),
                                            id: x['orcid-id'],
                                            //Since clicking in the selection re-opens the choice list, one has to use a right click/open in new tab/window to view the ORCID page
                                            //Using title to provide that hint as a popup
                                            title: 'Open in new tab to view ORCID page'
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
            var id = $(personInput).val();
            if (id.startsWith(orcidBaseUrl)) {
                id = id.substring(orcidBaseUrl.length);
                $.ajax({
                    type: "GET",
                    url: orcidBaseUrl.replace("https://","https://pub.") + "v3.0/" + id + "/person",
                    dataType: 'json',
                    headers: {
                        'Accept': 'application/json'
                    },
                    success: function(person, status) {
                        var name = ((person.name['family-name']) ? person.name['family-name'].value + ", " : "") + person.name['given-names'].value;
                        var text = name + "; " + id;
                        if (person.emails.email.length > 0) {
                            text = text + "; " + person.emails.email[0].email;
                        }
                        var newOption = new Option(text, id, true, true);
                        newOption.title = 'Open in new tab to view ORCID page';
                        $('#' + selectId).append(newOption).trigger('change');
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        if (jqXHR.status != 404) {
                            console.error("The following error occurred: " + textStatus, errorThrown);
                        }
                    }
                });
            } else {
                //If the initial value is not an ORCID (legacy, or if tags are enabled), just display it as is
                if (Object.keys(managedFields).length > 0) {
                    //Handle managed fields
                    if (id.length > 0) {
                        $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent().show();
                        $(personInput).parent().show();
                    }
                    id = $(parent).find("input[data-cvoc-managed-field='" + managedFields.personName + "']").val();
                }

                var newOption = new Option(id, id, true, true);
                $('#' + selectId).append(newOption).trigger('change');
            }
            //Cound start with the selection menu open
            //    $("#" + selectId).select2('open');
            //When a selection is made, set the value of the hidden input field
            $('#' + selectId).on('select2:select', function(e) {
                var data = e.params.data;
                //For ORCIDs, the id and text are different
                if (data.id != data.text) {
                    $("input[data-person='" + num + "']").val(orcidBaseUrl + data.id);
                } else {
                    //Tags are allowed, so just enter the text as is
                    $("input[data-person='" + num + "']").val(data.id);
                }

                //In the multi-field case, we should also fill in the other hidden managed fields
                if (hasParentField) {
                    var parent = $("input[data-person='" + num + "']").closest("[data-cvoc-parentfield='" + parentField + "']");
                    let isOrcid = data.text.includes(';');
                    for (var key in managedFields) {
                        if (key == 'personName') {
                            var pName = data.text.split(";", 1)[0];
                            //When the field is hidden jQuery .val() doesn't set the value attribute, but does trigger sending the value back to the repository, whereas .attr() does the opposite
                            // .val() is needed, .attr() helps with debugging (you can see the new value in the browser console)
                            $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']").val(pName).attr('value', pName);
                        } else if (key == 'idType') {
                            let selectField = $(parent).find("[data-cvoc-managed-field='" + managedFields[key] + "']").find("select");
                            let orcidVal = $(selectField).find('option:contains("ORCID")').val();
                            $(selectField).val(isOrcid ? orcidVal : '');

                        }
                    }
                    if (Object.keys(managedFields).length > 0) {
                        if (isOrcid) {
                            //Hide managed fields
                            $(parent).find("input[data-person='" + num + "']").parent().hide();
                            $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent().hide();
                        } else {
                            //Show managed fields
                            let idField = $(parent).find("input[data-person='" + num + "']");
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
                $("input[data-person='" + num + "']").val('').attr('value', '');
                //In the multi-field case, we should also clear the other hidden managed fields
                if (hasParentField) {
                    var parent = $("input[data-person='" + num + "']").closest("[data-cvoc-parentfield='" + parentField + "']");
                    for (var key in managedFields) {
                        if (key == 'personName') {
                            $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']").val('').attr('value', '');
                        } else if (key == 'idType') {
                            $(parent).find("[data-cvoc-managed-field='" + managedFields[key] + "']").find("select").val('').attr('value', '');
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

//Put the text in a result that matches the term in a span with class select2-rendered__match that can be styled (e.g. bold)
function markMatch(text, term) {
    // Find where the match is
    var match = text.toUpperCase().indexOf(term.toUpperCase());
    var $result = $('<span></span>');
    // If there is no match, move on
    if (match < 0) {
        return $result.text(text);
    }

    // Put in whatever text is before the match
    $result.text(text.substring(0, match));

    // Mark the match
    var $match = $('<span class="select2-rendered__match"></span>');
    $match.text(text.substring(match, match + term.length));

    // Append the matching text
    $result.append($match);

    // Put in whatever is after the match
    $result.append(text.substring(match + term.length));

    return $result;
}