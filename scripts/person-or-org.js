var personOrgSelector = "span[data-cvoc-protocol='orcid-or-ror'], span[data-cvoc-protocol='orcid'], span[data-cvoc-protocol='ror']";
var personOrgInputSelector = "input[data-cvoc-protocol='orcid-or-ror'], input[data-cvoc-protocol='orcid'], input[data-cvoc-protocol='ror']";
var orcidPrefix = "orcid:";
var rorPrefix = "ror:";
var rorBaseUrl = "https://ror.org/";

$(document).ready(function() {
    expandAffiliations();
    updateAffiliationInputs();
});

/**
 * Expand existing identifiers (ORCID or ROR) into a human-readable format.
 */
function expandAffiliations() {
    $(personOrgSelector).each(function() {
        var element = this;
        if ($(element).hasClass('expanded')) {
            return;
        }
        $(element).addClass('expanded');

        var id = element.textContent.trim();
        var orcidBaseUrl = $(element).attr('data-cvoc-service-url') || "https://orcid.org/";

        if (id.startsWith(orcidBaseUrl)) {
            id = id.substring(orcidBaseUrl.length);
        } else if (id.startsWith(rorBaseUrl)) {
            id = id.substring(rorBaseUrl.length);
        }

        if (id.match(/^\d{4}-\d{4}-\d{4}-(\d{4}|\d{3}X)$/)) {
            // It's an ORCID
            expandPerson(element, id, orcidBaseUrl);
        } else if (id.match(/^0[a-z0-9]{6}[0-9]{2}$/)) {
            // It's a ROR ID
            expandOrganization(element, id, rorBaseUrl);
        } else {
            // Plain text
            showAsPlainText(element);
        }
    });
}

/**
 * Set up input fields to allow selecting either a person (ORCID) or an organization (ROR).
 */
function updateAffiliationInputs() {
    $(personOrgInputSelector).each(function() {
        var personOrgInput = this;
        if (personOrgInput.hasAttribute('data-person-org')) {
            return;
        }

        let num = Math.floor(Math.random() * 100000000000);
        $(personOrgInput).attr('data-person-org', num);
        $(personOrgInput).parent().hide();

        var orcidBaseUrl = $(personOrgInput).attr('data-cvoc-service-url') || "https://orcid.org/";
        var orcidSearchUrl = (orcidBaseUrl.startsWith("https://sandbox.orcid.org") ? "https://pub.sandbox.orcid.org/" : "https://pub.orcid.org/") + "v3.0/expanded-search";
        var rorSearchUrl = "https://api.ror.org/organizations";
        var protocol = $(personOrgInput).data('cvoc-protocol');

        var container = $(personOrgInput).parent().parent().children('div').eq(0);
        var selectId = "personOrgAddSelect_" + num;
        container.append('<select id=' + selectId + ' class="form-control add-resource select2" tabindex="0">');
        var $select2 = $("#" + selectId);

        if (protocol === 'orcid-or-ror') {
            // Create radio buttons for selection
            var radioName = "person-org-choice-" + num;
            var personRadioId = "person-choice-" + num;
            var orgRadioId = "org-choice-" + num;
            var radioHtml = `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="${radioName}" id="${personRadioId}" value="person" checked>
                    <label class="form-check-label" for="${personRadioId}">Person</label>
                </div>
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="${radioName}" id="${orgRadioId}" value="organization">
                    <label class="form-check-label" for="${orgRadioId}">Organization</label>
                </div>`;
            container.append(radioHtml);

            // Initial setup for person
            setupSelect2('person', $select2, personOrgInput, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);

            // Add event listener for radio buttons
            $('input[name="' + radioName + '"]').on('change', function() {
                setupSelect2($(this).val(), $select2, personOrgInput, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);
            });
        } else if (protocol === 'orcid') {
            setupSelect2('person', $select2, personOrgInput, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);
        } else if (protocol === 'ror') {
            setupSelect2('organization', $select2, personOrgInput, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);
        }
    });
}

function setupSelect2(type, $select2, personOrgInput, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl) {
    if ($select2.data('select2')) {
        $select2.select2('destroy');
        $select2.empty();
    }

    var config = (type === 'person')
        ? getPersonSelect2Config(personOrgInput, orcidSearchUrl, orcidBaseUrl)
        : getOrgSelect2Config(personOrgInput, rorSearchUrl, rorBaseUrl);

    $select2.select2(config).on('select2:select', function(e) {
        var data = e.params.data;
        var url = (type === 'person')
            ? orcidBaseUrl + data.id
            : rorBaseUrl + data.id;
        $(personOrgInput).val(url).trigger('change');
        storeValue((type === 'person' ? orcidPrefix : rorPrefix), data.id, data.text.split(' | ')[0]);
    }).on('select2:unselect', function(e) {
        $(personOrgInput).val("").trigger('change');
    });
}


// --- Helper functions for ORCID/Person ---

function expandPerson(element, id, orcidBaseUrl) {
    var orcidRetrievalUrl = (orcidBaseUrl.startsWith("https://sandbox.orcid.org") ? "https://pub.sandbox.orcid.org/" : "https://pub.orcid.org/") + "v3.0/" + id + "/person";
    $.ajax({
        type: "GET",
        url: orcidRetrievalUrl,
        dataType: 'json',
        headers: { 'Accept': 'application/json' },
        success: function(person) {
            //If found, construct the HTML for display

            var name = ((person.name['family-name']) ? person.name['family-name'].value + ", " : "") + person.name['given-names'].value;
            var displayElement = $('<span/>').text(name).append($('<a/>').attr('href', orcidBaseUrl + id).attr('target', '_blank').attr('rel', 'noopener').html('<img alt="ORCID logo" src="https://info.orcid.org/wp-content/uploads/2019/11/orcid_16x16.png" width="16" height="16" />'));
            $(element).hide();
            let sibs = $(element).siblings("[data-cvoc-index='" + $(element).attr('data-cvoc-index') + "']");
            if (sibs.length == 0) {
                displayElement.prependTo($(element).parent());
            } else {
                displayElement.insertBefore(sibs.eq(0));
            }
        },
        error: function() {
            showAsPlainText(element);
        }
    });
}

function showAsPlainText(element) {
    var text = element.textContent.trim();
    if (text.startsWith("https://orcid.org/")) {
        text = text.substring(18);
    } else if (text.startsWith("https://ror.org/")) {
        text = text.substring(16);
    }
    $(element).text(text);
}

// --- Helper functions for ROR/Organization ---

function expandOrganization(element, id, rorBaseUrl) {
    var rorRetrievalUrl = (rorBaseUrl.startsWith("https://sandbox.ror.org") ? "https://api.sandbox.ror.org/organizations/" : "https://api.ror.org/organizations/") + id;
    $.ajax({
        type: "GET",
        url: rorRetrievalUrl,
        dataType: 'json',
        headers: { 'Accept': 'application/json' },
        success: function(org) {
            // If found, construct the HTML for display
            // Find the display name (type: "ror_display" or "label")
            const displayName = org.names.find(n =>
                n.types && (n.types.includes("ror_display") || n.types.includes("label"))
            )?.value || ror.id;

            // Find all acronyms
            const acronyms = org.names
                .filter(n => n.types && n.types.includes("acronym"))
                .map(n => n.value);

            var city = org.locations[0].geonames_details.name;
            var country = org.locations[0].geonames_details.country_name;
            $(element).html(getRorDisplayHtml(displayName, rorBaseUrl + id, acronyms, city, country, false, true));
        },
        error: function() {
            showAsPlainText(element);
        }
    });
}

function getRorDisplayHtml(name, url, altNames, city, country, truncate = true, addParens = false) {
    if (typeof (altNames) == 'undefined') {
        altNames = [];
    }
    if (truncate && (name.length >= rorMaxLength)) {
        // show the first characters of a long name
        // return item.text.substring(0,25) + "…";
        altNames.unshift(name);
        name = name.substring(0, rorMaxLength) + "…";
    }
    if (url != null) {
        name = name + '<a href="' + url + '" target="_blank" rel="nofollow" >' + '<img alt="ROR logo" src="https://raw.githubusercontent.com/ror-community/ror-logos/main/ror-icon-rgb.svg" height="20" class="ror"/></a>';
    }
    if (addParens) {
        name = '(' + name + ')';
    }
    var titleParts = [].concat(altNames);
    var locationParts = [];
    if (city) {
        locationParts.push(city);
    }
    if (country) {
        locationParts.push(country);
    }
    if (locationParts.length > 0) {
        titleParts.push('(' + locationParts.join(', ') + ')');
    }
    return $('<span></span>').append(name).attr("title", titleParts.join(', '));
}

// --- Select2 configuration helpers ---

function getPersonSelect2Config(inputElement, searchUrl, baseUrl) {
    return {
        placeholder: "Search for a person by name or ORCID",
        minimumInputLength: 3,
        ajax: {
            url: searchUrl,
            dataType: 'json',
            delay: 250,
            data: function(params) {
                return {
                    q: params.term,
                    start: 0,
                    rows: 20
                };
            },
            processResults: function(data, params) {
                var results = [];
                if (data['expanded-results']) {
                    data['expanded-results'].forEach(function(item) {
                        var name = item['person-name'] ? item['person-name'].value : '';
                        var orcid = item['orcid'];
                        if (name && orcid) {
                            results.push({
                                id: orcid,
                                text: name + " | " + orcid
                            });
                        }
                    });
                }
                return {
                    results: results
                };
            },
            cache: true
        },
        templateResult: function(data) {
            return data.text;
        },
        templateSelection: function(data) {
            return data.text.split(" | ")[0];
        }
    };
}

function getOrgSelect2Config(inputElement, searchUrl, baseUrl) {
    return {
        placeholder: "Search for an organization by name or ROR ID",
        minimumInputLength: 3,
        ajax: {
            url: searchUrl,
            dataType: 'json',
            delay: 250,
            data: function(params) {
                return {
                    query: params.term,
                    page_size: 20
                };
            },
            processResults: function(data, params) {
                var results = [];
                if (data['items']) {
                    data['items'].forEach(function(item) {
                        var name = item.name;
                        var ror = item.id.split('/').pop();
                        if (name && ror) {
                            results.push({
                                id: ror,
                                text: name + " | " + ror
                            });
                        }
                    });
                }
                return {
                    results: results
                };
            },
            cache: true
        },
        templateResult: function(data) {
            return data.text;
        },
        templateSelection: function(data) {
            return data.text.split(" | ")[0];
        }
    };
}
