/* http://www.apache.org/licenses/LICENSE-2.0
 * Controlled vocabulary for keywords metadata with Agroportal ontologies
 * version 0.1
 */

jQuery(document).ready(function ($) {
    const displaySelector = "span[data-cvoc-protocol='ontoportal']";
    const inputSelector = "input[data-cvoc-protocol='ontoportal']";
    const showChildsInputs = false; // true to debug

    expand();
    updateInputs();

    function expand() {
        // Check each selected element
        $(displaySelector).each(function() {
            let displayElement = this;
            // If it hasn't already been processed
            if (!$(displayElement).hasClass("expanded")) {
                let parent = $(displayElement).parent();
                // Mark it as processed
                $(displayElement).addClass("expanded");
                // The service URL to contact using this protocol
                let cvocUrl = $(displayElement).data("cvoc-service-url");
                // The cvoc managed fields
                let managedFields = $(displayElement).data('cvoc-managedfields');
                // The value in the element. Currently, this must be either the URI of a term or plain text - with the latter not being formatted at all by this script
                let id = displayElement.textContent;
                // Assume anything starting with http is a valid term - could use stricter tests
                if (id.startsWith("http")) {
                    let ontology = parent.find(`[data-cvoc-metadata-name="${managedFields.vocabularyName}"]`).text();
                    let termName = parent.find(`[data-cvoc-metadata-name="${managedFields.termName}"]`).text();
                    let url = cvocUrl.replace("data.", "") + "ontologies/"+ontology+"/classes/"+encodeURIComponent(id);
                    if (parent.is("a")) {
                        // Display only the term if it is already into a link
                        $(displayElement).text(termName);
                    } else {
                        // Display the term with a link to agroportal
                        let a = document.createElement("a");
                        a.setAttribute("href", url);
                        a.setAttribute("title", url);
                        a.setAttribute("target", "_black");
                        a.setAttribute("rel", "noopener");
                        a.appendChild(document.createTextNode(termName));
                        // Clear the term URI
                        $(displayElement).empty();
                        // Display the link
                        displayElement.append(a);
                    }
                } else {
                    // Don't change the display if it wasn't a controlled term
                }
            }
        });
    }

    function updateInputs() {
        // For each input element
        $(inputSelector).each(function() {
            var input = this;
            //If we haven't modified this input yet
            if (!input.hasAttribute("data-ontoportal")) {
                // Create a random identifier (large enough to minimize the possibility of conflicts for a few fields
                //Use let to have 'closure' - so that when num is used below it always refers to the same value set here (and not the last value num is set to if/when there are multiple fields being managed)
                let num = Math.floor(Math.random() * 100000000000);
                //Retrieve useful values from the attributes
                let cvocUrl = $(input).attr('data-cvoc-service-url');
                let cvocUiUrl = "https://agroportal.lirmm.fr/"; //$(input).attr('data-cvoc-ui-url');
                let cvocHeaders = JSON.parse($(input).attr('data-cvoc-headers'));
                cvocHeaders['Accept'] = 'application/json';
                let lang = input.hasAttribute("lang") ? $(input).attr('lang') : "";
                let langParam = input.hasAttribute("lang") ? "&lang=" + $(input).attr('lang') : "";
                let vocabs = JSON.parse($(input).attr('data-cvoc-vocabs'));
                let managedFields = JSON.parse($(input).attr('data-cvoc-managedfields'));
                let parentField = $(input).attr('data-cvoc-parent');
                let termParentUri = $(input).attr('data-cvoc-filter');
                let allowFreeText = $(input).attr('data-cvoc-allowfreetext');
                let placeholder = input.hasAttribute("data-cvoc-placeholder") ? $(input).attr('data-cvoc-placeholder') : "Select a term";
                let selectId = "skosmosAddSelect_" + num;
                //Pick the first entry as the default to start with when there is more than one vocab
                //let vocab = Object.keys(vocabs)[0];
    
                //Mark this field as processed
                $(input).attr('data-skosmos', num);
                //Decide what needs to be hidden. In the single field case, we hide the input itself. For compound fields, we hide everything leading to this input from the specified parent field
                let anchorSib = input;
                //If there is a parent field
                if ($("[data-cvoc-parentfield='" + parentField + "']").length > 0) {
                    //Find it's child that contains the input for the term uri
                    anchorSib = $(input).parentsUntil("[data-cvoc-parentfield='" + parentField + "']").last();
                }
                //Then hide all children of this element's parent.
                //For a single field, this just hides the input itself (and any siblings if there are any).
                //For a compound field, this hides other fields that may store term name/ vocab name/uri ,etc. ToDo: only hide children that are marked as managedFields?
                $(anchorSib).parent().children().toggle(showChildsInputs);
    
                //Vocab Selector
                //Currently the code creates a selection form even if there is one vocabulary, and then hides it in that case. (ToDo: only create it if needed)
                //We create a unique id to be able to find this particular input again
                /*var vocabId = "skosmosVocabSelect_" + num;
                //Create a div covering 3/12s of the width
                $(anchorSib).before($('<div/>').addClass('cvoc-vocab col-sm-3'));
                //Add a label
                $(anchorSib).parent().find('.cvoc-vocab').append($('<label/>').text('Vocabulary'));
                //Create the select element
                $(anchorSib).parent().find('.cvoc-vocab').append(
                    '<select id=' + vocabId + ' class="form-control add-resource select2" tabindex="-1" aria-hidden="true">');
                //Add all of the vocabularies as options
                for (var key in vocabs) {
                    $("#" + vocabId).append($('<option>').attr('value', key).html($('<a>').attr('href', vocabs[key].vocabularyUri).attr('target', '_blank').attr('rel', 'noopener').text(key)));
                }
                //Setup select2 - this allows users to find a vocab by typing a few letters in it to filter the list
                $("#" + vocabId).select2({
                    theme: "classic",
                    tags: false,
                    delay: 500,
                    templateResult: function(item) {
                        // No need to template the searching text
                        if (item.loading) {
                            return item.text;
                        }
                        var term = '';
                        if (typeof(query) !== 'undefined') {
                            term = query.term;
                        }
                        // markMatch bolds the search term if/where it
                        // appears in the result
                        var $result = markMatch(item.text, term);
                        return $result;
                    },
                    placeholder: "Select a vocabulary",
                    //Shows the full list when nothing has been typed
                    minimumInputLength: 0,
                });
                //When a vocab is selected
                $('#' + vocabId).on('select2:select', function(e) {
                    var data = e.params.data;
                    vocab = data.id;
                    //Set the current vocab attribute on our term uri select,
                    // clear it's current value (which could be from a different vocab)
                    $('#' + selectId).attr('data-cvoc-cur-vocab', vocab);
                    $("#" + selectId).text('');
                    // and trigger a change so that it then clears the original hidden input field
                    $('#' + selectId).val(null).trigger('change');
                });
                //We only need this if there is more than one vocab and we don't already have a value - hide it otherwise
                if (Object.keys(vocabs).length == 1 || $(input).val().startsWith("http")) {
                    $(anchorSib).parent().find('.cvoc-vocab').hide();
                }
    
                // Add a select2 element for the term itself - to allow search and provide a list of choices
                //For multiple vocabs, we put this after the vocab selector
                if ($(anchorSib).parent().find('.cvoc-vocab').length != 0) {
                    $(anchorSib).parent().find('.cvoc-vocab').after($('<div/>').addClass('cvoc-term col-sm-9').append($('<label/>').text('Term')).append(
                        '<select id=' + selectId + ' class="form-control add-resource select2" tabindex="-1" aria-hidden="true">'));
                    $('#' + selectId).attr('data-cvoc-cur-vocab', vocab);
                    if (Object.keys(vocabs).length == 1 || $(input).val().startsWith("http")) {
                        $(anchorSib).parent().find('.cvoc-term > label').hide();
                        $('.cvoc-term').removeClass('col-sm-9');
                    }
                } else {
                    //Otherwise we put it after the hidden input itself
                    $(anchorSib).after(
                        '<select id=' + selectId + ' class="form-control add-resource select2" tabindex="-1" aria-hidden="true">');
                }*/
    
    
                $(anchorSib).after(
                    '<select id=' + selectId + ' class="form-control add-resource select2" tabindex="-1" aria-hidden="true">');
    
                //St up this select2
                $("#" + selectId).select2({
                    theme: "classic",
                    //tags true allows a free text entry (not a term uri, just plain text): ToDo - make this configurable
                    tags: allowFreeText,
                    delay: 500,
                    templateResult: function(item) {
                        // No need to template the searching text
                        if (item.loading) {
                            return item.text;
                        }
                        var term = '';
                        if (typeof(query) !== 'undefined') {
                            term = query.term;
                        }
                        // markMatch bolds the search term if/where it appears in the result
                        var $result = markMatch(item.text, term);
                        return $result;
                    },
                    templateSelection: function(item) {
                        // For a selection, add HTML to make the term uri a link
                        if (item.text != item.id) {
                            //Plain text (i.e. with tags:true) would have item.text == item.id
                            var pos = item.text.search(/http[s]?:\/\//);
                            if (pos >= 0) {
                                var termuri = item.text.substr(pos);
                                return $('<span></span>').append(item.text.replace(termuri, "<a href='" + termuri + "'  target='_blank' rel='noopener'>" + termuri + "</a>"));
                            }
                        }
                        return item.text;
                    },
                    language: {
                        searching: function(params) {
                            // Change this to be appropriate for your application
                            return 'Search by preferred or alternate label...';
                        }
                    },
                    placeholder: placeholder,
                    //Some vocabs are very slow and/or fail with a 500 error when searching for only 2 letters
                    minimumInputLength: 3,
                    allowClear: true,
                    ajax: {
                        //Call the specified skosmos service to get matching terms
                        //Add the current vocab, any subvocabulary(termParentUri) filter, and desired language
                        url: function() {
                            let vocabsArr = [];
                            for (var key in vocabs) {
                                vocabsArr.push(key);
                            }
                            //return cvocUrl + 'rest/v1/search?unique=true&vocab=' + $('#' + selectId).attr('data-cvoc-cur-vocab') + '&parent=' + termParentUri + langParam;
                            return cvocUrl + '/search?include_properties=true&pagesize=10&include_views=true&display_context=false&ontologies=' + vocabsArr.join(',');
                        },
                        dataType: "json",
                        headers: cvocHeaders,
                        data: function(params) {
                            // Used in templateResult
                            term = params.term;
                            //Add the query - skosmos needs a trailing * to match words starting with the supplied letters
                            //return "&query=" + params.term + "*";
                            return "&q=" + params.term;
                        },
                        processResults: function(data, page) {
                            console.log("data", data);
                            return {
                                results: data.collection
                                    .map(
                                        function(x) {
                                            return {
                                                //For each returned item, show the term, it's alternative label (which may be what matches the query) and the termUri
                                                //text: x.prefLabel + ((x.hasOwnProperty('altLabel') && x.altLabel.length > 0) ? " (" + x.altLabel + "), " : ", ") + x.uri,
                                                text: x.prefLabel + ", " + x.links.self.replace(cvocUrl, cvocUiUrl),
                                                name: x.prefLabel,
                                                id: x["@id"],
                                                voc: x.links.ontology,
                                                // Since clicking in the selection re-opens the
                                                // choice list, one has to use a right click/open in
                                                // new tab/window to view the ORCID page
                                                // Using title to provide that hint as a popup
                                                title: 'Open in new tab to view Term page'
                                            }
                                        })
                            };
                        }
                    }
                });
                // If the input has a value already, format it the same way as if it
                // were a new selection. Since we only have the term URI, we query the service to find the label in the right language
                var id = $(input).val();
                var ontology = $(anchorSib).parent().children().find("input[data-cvoc-managed-field='" + managedFields['vocabularyName'] + "']").attr('value');
                if (id.startsWith("http") && ontology) {
                    $.ajax({
                        type: "GET",
                        url: cvocUrl + "ontologies/"+ontology+"/classes/"+encodeURIComponent(id),
                        dataType: 'json',
                        headers: cvocHeaders,
                        success: function(term, status) {
                            termName = term.prefLabel;
                            var text = termName + ", " + term.links.self.replace(cvocUrl, cvocUiUrl);
                            var newOption = new Option(text, id, true, true);
                            newOption.title = 'Open in new tab to view Term page';
                            $('#' + selectId).append(newOption).trigger('change');
                            // ToDo: can't get altLabel from this api call
                            // Also can't determine the vocab from this call
                        },
                        failure: function(jqXHR, textStatus, errorThrown) {
                                console.error("The following error occurred: " + textStatus, errorThrown);
                            //Something is wrong, but we should show that a value is currently set
                            var newOption = new Option(id, id, true, true);
                            $('#' + selectId).append(newOption).trigger('change');
                        }
                    });
                } else {
                    // If the initial value is not a managed term (legacy, or if tags are
                    // enabled), just display it as is
                    var newOption = new Option(id, id, true, true);
                    $('#' + selectId).append(newOption).trigger('change');
                }
                // Could start with the selection menu open
                // $("#" + selectId).select2('open');
                // When a selection is made, set the value of the hidden input field
                $('#' + selectId).on('select2:select', function(e) {
                    var data = e.params.data;
                    // For terms, the id and text are different, but we just store the
                    // data.id in either case (controlled uri or plain text)
                    // if(data.id != data.text) {
                    $("input[data-skosmos='" + num + "']").val(data.id.replace(cvocUrl, cvocUiUrl));
                    //If we have more than one vocab, hide the vocab selector since we have a termURI selected
                    /*if (Object.keys(vocabs).length > 1) {
                        $(anchorSib).parent().find('.cvoc-vocab').hide();
                        $(anchorSib).parent().find('.cvoc-term > label').hide();
                        //and let the term field take up the whole width
                        $('.cvoc-term').removeClass('col-sm-9');
                    }*/
                    //In the multi-field case, we should also fill in the other hidden managed fields
                    if ($("[data-cvoc-parentfield='" + parentField + "']").length > 0) {
                        var parent = $("input[data-skosmos='" + num + "']").closest("[data-cvoc-parentfield='" + parentField + "']");
                        for (var key in managedFields) {
                            if (key == 'vocabularyName') {
                                $.ajax({
                                    type: "GET",
                                    url: data.voc,
                                    dataType: 'json',
                                    headers: cvocHeaders,
                                    success: function(onthology, status) {
                                        $(parent).find("input[data-cvoc-managed-field='" + managedFields['vocabularyName'] + "']").attr('value', onthology.acronym);
                                    },
                                    failure: function(jqXHR, textStatus, errorThrown) {
                                        $(parent).find("input[data-cvoc-managed-field='" + managedFields['vocabularyName'] + "']").attr('value', data.voc.substring(data.voc.lastIndexOf('/') + 1));
                                    }
                                });
                            } else if (key == 'vocabularyUri') {
                                $(parent).find("input[data-cvoc-managed-field='" + managedFields['vocabularyUri'] + "']").attr('value', data.voc.replace(cvocUrl, cvocUiUrl));
                            } else if (key == 'termName') {
                                $(parent).find("input[data-cvoc-managed-field='" + managedFields['termName'] + "']").attr('value', data.name);
                            }
                        }
                    }
                });
                // When a selection is cleared, clear the hidden input
                $('#' + selectId).on('select2:clear', function(e) {
                    $("input[data-skosmos='" + num + "']").attr('value', '');
                    $('#' + selectId).text('');
                    //And show the vocab selector again if we have more than one vocab
                    /*if (Object.keys(vocabs).length > 1) {
                        $(anchorSib).parent().find('.cvoc-vocab').show();
                        $(anchorSib).parent().find('.cvoc-term > label').show();
                        //And schrink the term field to 75% width
                        $('.cvoc-term').addClass('col-sm-9');
                    }*/
                    //And clear any hidden managed fields as well
                    if ($("[data-cvoc-parentfield='" + parentField + "']").length > 0) {
                        var parent = $("input[data-skosmos='" + num + "']").closest("[data-cvoc-parentfield='" + parentField + "']");
                        for (var key in managedFields) {
                            if (key == 'vocabularyName') {
                                $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']").attr('value', '');
                            } else if (key == 'vocabularyUri') {
                                $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']").attr('value', '');
                            } else if (key == 'termName') {
                                $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']").attr('value', '');
                            }
                        }
                    }
    
                });
            }
        });
    }
    
    // Put the text in a result that matches the term in a span with class
    // select2-rendered__match that can be styled (e.g. bold)
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
});
