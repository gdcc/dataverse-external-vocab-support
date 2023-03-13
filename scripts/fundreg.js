console.log("fundreg.js..");
var fundregSelector = "span[data-cvoc-protocol='fundreg']";
var fundregInputSelector = "input[data-cvoc-protocol='fundreg']";
var fundregRetrievalUrl = "https://api.crossref.org/funders";
var fundregPrefix = "fundreg";
//Max chars that displays well for a child field
var fundregMaxLength = 31;

$(document).ready(function() {
    var head = document.getElementsByTagName('head')[0];
    var js = document.createElement("script");
    js.type = "text/javascript";
    js.src = "/cvoc/js/cvocutils.js";
    js.async=false;
    head.appendChild(js);
    js.addEventListener('load', () => {
        expandFunders();
        updateFunderInputs();
    })
});

function expandFunders() {
    console.log("expandFunders");
    // Check each selected element
    $(fundregSelector).each(function() {
        var funderElement = this;
        // If it hasn't already been processed
        if (!$(funderElement).hasClass('expanded')) {
            // Mark it as processed
            $(funderElement).addClass('expanded');
            var id = funderElement.textContent;
            if (!id.startsWith("http://dx.doi.org/10.13039/")) {
                $(funderElement).html(getFunderDisplayHtml(id, ['No Crossref Entry'], false));
            } else {
                //Remove the URL prefix - "http://dx.doi.org/10.13039/".length = 27
                id = id.substring(27);
                //Check for cached entry
                let value = getValue(fundregPrefix, id);
                if(value.name !=null) {
                    $(funderElement).html(getFunderDisplayHtml(value.name, value.altNames, false));
                } else {

                    // Try it as an CrossRef Funders entry (could validate that it has the right form or can just let the GET fail)
                    $.ajax({
                        type: "GET",
                        url: fundregRetrievalUrl + "/" + id,
                        dataType: 'json',
                        //Adding this, and using https is supposed to let us call a faster pool of machines
                        //(They will contact us if they see problems - see https://api.crossref.org/swagger-ui/index.html.)
                        data: 'mailto=dataverse-gdcc@googlegroups.com',
                        headers: {
                            'Accept': 'application/json',
                        },
                        success: function(funder, status) {
                            console.log(funder);
                            // If found, construct the HTML for display
                            var name = funder.message.name;
                            var altNames= funder.message['alt-names'];

                            $(funderElement).html(getFunderDisplayHtml(name, altNames, false));
                            //Store values in localStorage to avoid repeating calls to CrossRef
                            storeValue(fundregPrefix, id, name + "#" + altNames);
                        },
                        failure: function(jqXHR, textStatus, errorThrown) {
                            // Generic logging - don't need to do anything if 404 (leave
                            // display as is)
                            if (jqXHR.status != 404) {
                                console.error("The following error occurred: " + textStatus, errorThrown);
                            }
                        }
                    });
                }
            }
        }
    });
}

function getFunderDisplayHtml(name, altNames, truncate=true) {
    if (typeof(altNames) == 'undefined') {
        altNames = [];
    }
    if (truncate && (name.length >= fundregMaxLength)) {
        // show the first characters of a long name
        altNames.unshift(name);
        name=name.substring(0,fundregMaxLength) + "…";
    }
    return $('<span></span>').append(name).attr("title", altNames);
}

function updateFunderInputs() {
    // For each input element within funderInputSelector elements
    $(fundregInputSelector).each(function() {
        var funderInput = this;
        if (!funderInput.hasAttribute('data-funder')) {
            // Random identifier
            let num = Math.floor(Math.random() * 100000000000);
            // Hide the actual input and give it a data-funder number so we can
            // find it
            $(funderInput).hide();
            $(funderInput).attr('data-funder', num);
            // Todo: if not displayed, wait until it is to then create the
            // select 2 with a non-zero width
            // Add a select2 element to allow search and provide a list of
            // choices
            var selectId = "funderAddSelect_" + num;
            $(funderInput).after(
                '<select id=' + selectId + ' class="form-control add-resource select2" tabindex="-1" aria-hidden="true">');
            $("#" + selectId).select2({
                theme: "classic",
                tags: $(funderInput).attr('data-cvoc-allowfreetext'),
                delay: 500,
                templateResult: function(item) {
                    // No need to template the searching text
                    if (item.loading) {
                        return item.text;
                    }
                    // markMatch bolds the search term if/where it appears in
                    // the result
                    var $result = markMatch2(item.text, term);
                    return $result;
                },
                templateSelection: function(item) {
                    // For a selection, format as in display mode
                    //Find/remove the id number
                    var name = item.text;
                    var pos = item.text.search(/, \d{9}/);
                    if (pos >= 0) {
                        name = name.substr(0, pos);
                        var idnum = item.text.substr(pos+2);
                        return getFunderDisplayHtml(name, item.altNames);
                    }
                    return getFunderDisplayHtml(name, ['No Crossref Entry']);
                },
                language: {
                    searching: function(params) {
                        // Change this to be appropriate for your application
                        return 'Search by name or acronym…';
                    }
                },
                placeholder: funderInput.hasAttribute("data-cvoc-placeholder") ? $(funderInput).attr('data-cvoc-placeholder') : "Select a funding agency",
                minimumInputLength: 3,
                allowClear: true,
                ajax: {
                    // Use an ajax call to CrossRef to retrieve matching results
                    url: fundregRetrievalUrl,
                    data: function(params) {
                        term = params.term;
                        if (!term) {
                            term = "";
                            console.log("no term!");
                        }
                        var query = {
                            query: term,
                            rows: 1000,
                            //See above - this put the request on a faster pool of machines
                            mailto: 'dataverse-gdcc@googlegroups.com',
                        }
                        return query;
                    },
                    // request json
                    headers: {
                        'Accept': 'application/json'
                    },
                    processResults: function(data, page) {
                        //console.log("Data dump BEGIN");
                        //console.log(data);
                        //console.log("Data dump END");
                        return {
                            results: data['message']['items']
                                // Sort the list
                                // Prioritize those with this as a token
                                .sort((a, b) => (b.tokens.includes(data.message.query['search-terms'].toLowerCase())) ? 1 : -1)
                                // Prioritize those with this alt-name
                                .sort((a, b) => (b['alt-names'].includes(data.message.query['search-terms'])) ? 1 : -1)
                                // Prioritize previously used entries
                                .sort((a, b) => (getValue(fundregPrefix, b['id'])) ? 1 : -1)
                                .map(
                                    function(x) {
                                        return {
                                            text: x.name +", " + x.id,
                                            id: x['uri'],
                                            altNames: x['alt-names']
                                        }
                                    })
                        };
                    }
                }
            });
            // If the input has a value already, format it the same way as if it
            // were a new selection
            var id = $(funderInput).val();
            if (id.startsWith("http://dx.doi.org/10.13039/")) {
                id = id.substring(27);
                //Check for cached entry
                let value = getValue(fundregPrefix, id);
                if(value.name !=null) {
                    //Display the name and id number in the selection menu
                    var text = value.name + ", " + id;
                    var newOption = new Option(text, id, true, true);
                    newOption.altNames = value.altNames;
                    $('#' + selectId).append(newOption).trigger('change');
                } else {
                    $.ajax({
                        type: "GET",
                        url: fundregRetrievalUrl + "/" + id,
                        //See above - puts the request on a faster pool of machines
                        data: 'mailto=dataverse-gdcc@googlegroups.com',
                        dataType: 'json',
                        headers: {
                            'Accept': 'application/json'
                        },
                        success: function(funder, status) {
                            var name = funder.message.name;
                            console.log("name: " + name);
                            //Display the name and id number in the selection menu
                            var text = name + ", " + id;
                            var newOption = new Option(text, id, true, true);
                            newOption.altNames = funder.message['alt-names'];
                            $('#' + selectId).append(newOption).trigger('change');
                        },
                        failure: function(jqXHR, textStatus, errorThrown) {
                            if (jqXHR.status != 404) {
                                console.error("The following error occurred: " + textStatus, errorThrown);
                            }
                            var text = id;
                            var newOption = new Option(text, id, true, true);
                            newOption.altNames = ["Name can't be retrieved"];
                            $('#' + selectId).append(newOption).trigger('change');
                        }
                    });
                }
            } else {
                // If the initial value is not in CrossRef, just display it as is
                var newOption = new Option(id, id, true, true);
                $('#' + selectId).append(newOption).trigger('change');
            }
            // Could start with the selection menu open
            // $("#" + selectId).select2('open');
            // When a selection is made, set the value of the hidden input field
            $('#' + selectId).on('select2:select', function(e) {
                var data = e.params.data;
                // For entries from CrossRef, the id and text are different
                //For plain text entries (legacy or if tags are allowed), they are the same
                if (data.id != data.text) {
                    // we want just the funder url
                    $("input[data-funder='" + num + "']").val(data.id);
                } else {
                    // Tags are allowed, so just enter the text as is
                    $("input[data-funder='" + num + "']").val(data.id);
                }
            });
            // When a selection is cleared, clear the hidden input
            $('#' + selectId).on('select2:clear', function(e) {
                $("input[data-funder='" + num + "']").attr('value', '');
            });
        }
    });
}