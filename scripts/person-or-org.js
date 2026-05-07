var personOrgSelector = "span[data-cvoc-protocol='orcid-or-ror'], span[data-cvoc-protocol='orcid'], span[data-cvoc-protocol='ror']";
var personOrgInputSelector = "input[data-cvoc-protocol='orcid-or-ror'], input[data-cvoc-protocol='orcid'], input[data-cvoc-protocol='ror']";
var orcidPrefix = "orcid:";
var rorPrefix = "ror:";
var rorBaseUrl = "https://ror.org/";
//Max chars that displays well for a child field
var rorMaxLength = 31;

window.personOrg = {
    state: {
        i18n: {
            person: "Person",
            organization: "Organization",
            mismatchWarning: "Name in Dataverse (\"{0}\") does not match the {1} record (\"{2}\").",
            update: "Update",
            unauthenticated: " (unauthenticated) ",
            unauthenticatedTooltip: "This dataset is not listed in this person's ORCID record",
            orcidProfileTooltip: "Click to see this ORCID profile",
            rorProfileTooltip: "Click to see this ROR profile",
            orcidLogoAlt: "ORCID logo",
            rorLogoAlt: "ROR logo",
            openOrcidPage: "Open in new tab to view ORCID page",
            openRorPage: "Open in new tab to view ROR page",
            placeholder: "Select or enter...",
            searching: "Search by name, email, or ORCID…",
            searchingRor: "Search by organization name…",
            noRorEntry: "No ROR Entry"
        },
        loadedLang: null,
        i18nPromise: null
    }
};

$(document).ready(function () {
    var lang = $('html').attr('lang') || 'en';
    var scriptSrc = Array.from(document.scripts)
        .map(s => s.src)
        .find(src => src && src.includes("person-or-org.js"));

    loadI18n(lang, scriptSrc).then(function () {
        expandPersonOrOrgDisplays();
        updatePersonOrOrgInputs();
    });
});

/**
 * Asynchronously loads the internationalization properties for the current locale.
 * Defaults to 'en' if the locale is not found.
 * @param {string} lang - The language code (e.g., 'en', 'fr').
 * @param {string} scriptPath - The path to the current script.
 * @returns {Promise<Object>} A promise that resolves with the i18n object.
 */
function loadI18n(lang, scriptPath) {
    var state = window.personOrg.state;

    if (state.loadedLang === lang && state.i18n) {
        return Promise.resolve(state.i18n);
    }

    if (state.i18nPromise) {
        return state.i18nPromise;
    }

    function getDefaultI18n() {
        return window.personOrg.state.i18n;
    }

    function fetchI18n(targetLang) {
        var langFile = scriptPath.substring(0, scriptPath.lastIndexOf('/')) + '/i18n/person-or-org_' + targetLang + '.json';

        return fetch(langFile)
            .then(function (response) {
                if (response.ok) {
                    return response.json();
                }

                if (targetLang !== 'en') {
                    console.warn("Language file not found for: " + targetLang + ". Falling back to 'en'.");
                    return fetchI18n('en');
                }

                throw new Error('Default language file "person-or-org_en.json" not found.');
            })
            .catch(function (error) {
                console.error('Failed to load i18n file:', error);

                if (targetLang !== 'en') {
                    return fetchI18n('en');
                }

                return getDefaultI18n();
            });
    }

    state.i18nPromise = fetchI18n(lang || 'en')
        .then(function (data) {
            state.i18n = data;
            state.loadedLang = lang || 'en';
            return data;
        })
        .finally(function () {
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
    return str.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined' ? args[number] : match;
    });
}

/**
 * Expand existing identifiers (ORCID or ROR) into a human-readable format.
 */
function expandPersonOrOrgDisplays() {
    $(personOrgSelector).each(function () {
        var element = this;
        if ($(element).hasClass('expanded')) {
            return;
        }
        $(element).addClass('expanded');

        var id = element.textContent.trim();
        // Needed to pick up use of sandbox.orcid.org
        var orcidBaseUrl = $(element).attr('data-cvoc-service-url') || "https://orcid.org/";
        // ROR doesn't have a sandbox
        var currentRorBaseUrl = rorBaseUrl;

        if (id.startsWith(orcidBaseUrl)) {
            id = id.substring(orcidBaseUrl.length);
        } else if (id.startsWith(currentRorBaseUrl)) {
            id = id.substring(currentRorBaseUrl.length);
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
 * Adjusts the heights of the first two child divs in a managed-field parent to be equal.
 * This is used to ensure the CVOC selector area aligns with adjacent fields.
 */
function matchManagedFieldHeights(personOrgInput) {
    var parentField = $(personOrgInput).attr('data-cvoc-parent');
    if (!parentField) {
        return;
    }

    // Small delay to ensure DOM is updated before measuring
    setTimeout(function () {
        var $parentDiv = $(personOrgInput).closest("[data-cvoc-parentfield='" + parentField + "']");
        var $directDivs = $parentDiv.children('div');
        if ($directDivs.length >= 2) {
            // Reset to natural height to measure
            $directDivs.eq(0).css('height', 'auto');
            $directDivs.eq(1).css('height', 'auto');

            var firstHeight = $directDivs.eq(0).outerHeight();
            var secondHeight = $directDivs.eq(1).outerHeight();
            var maxHeight = Math.max(firstHeight, secondHeight) + 1;

            $directDivs.eq(0).css('height', maxHeight + 'px');
            $directDivs.eq(1).css('height', maxHeight + 'px');
        }
    }, 0);
}

/**
 * Shows or hides the managed identifier type and identifier fields.
 */
function updateManagedFieldVisibility(personOrgInput, managedFields, isIdentifier) {
    if (!managedFields || Object.keys(managedFields).length === 0) {
        return;
    }
    var parentField = $(personOrgInput).attr('data-cvoc-parent');
    var parent = $(personOrgInput).closest("[data-cvoc-parentfield='" + parentField + "']");
    var $idFieldParent = $(parent).find("input[data-person-org='" + $(personOrgInput).attr('data-person-org') + "']").parent();
    var $idTypeParent = $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent();

    if (isIdentifier) {
        $idFieldParent.hide();
        $idTypeParent.hide();
    } else {
        $idFieldParent.show();
        $idTypeParent.show();
    }
    matchManagedFieldHeights(personOrgInput);
}

/**
 * Set up input fields to allow selecting either a person (ORCID) or an organization (ROR).
 */
function updatePersonOrOrgInputs() {
    $(personOrgInputSelector).each(function () {
        var personOrgInput = this;
        if (personOrgInput.hasAttribute('data-person-org')) {
            return;
        }

        let num = Math.floor(Math.random() * 100000000000);
        $(personOrgInput).attr('data-person-org', num);

        var orcidBaseUrl = $(personOrgInput).attr('data-cvoc-service-url') || "https://orcid.org/";
        var orcidSearchUrl = (orcidBaseUrl.includes("sandbox.orcid.org") ? "https://pub.sandbox.orcid.org/" : "https://pub.orcid.org/") + "v3.0/expanded-search";
        var rorSearchUrl = "https://api.ror.org/organizations";
        var protocol = $(personOrgInput).data('cvoc-protocol');

        var $inputWrapper = $(personOrgInput).parent();
        var parentField = $(personOrgInput).attr('data-cvoc-parent');
        var parent = $(personOrgInput).closest("[data-cvoc-parentfield='" + parentField + "']");
        let hasParentField = $("[data-cvoc-parentfield='" + parentField + "']").length > 0;
        let managedFields = {};

        if (hasParentField) {
            managedFields = JSON.parse($(personOrgInput).attr('data-cvoc-managedfields') || "{}");
            if (Object.keys(managedFields).length > 0) {
                // Hide managed fields
                $(parent).find("input[data-cvoc-managed-field='" + managedFields.personName + "']").hide();
                $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent().hide();
                // Hide the actual input wrapper only when managed fields are present
                $inputWrapper.hide();
            } else {
                // No managed fields: hide only the original input
                $(personOrgInput).hide();
            }
        } else {
            // No parent/managed-field layout: hide only the original input
            $(personOrgInput).hide();
        }

        var container = $inputWrapper.parent().children('div').eq(0);
        var selectId = "personOrgAddSelect_" + num;

        var existingValue = ($(personOrgInput).val() || '').trim();
        if (!existingValue && protocol.startsWith('orcid') && Object.keys(managedFields).length > 0) {
            existingValue = ($(parent).find("input[data-cvoc-managed-field='" + managedFields.personName + "']").val() || '').trim();
        }
        var idOnly = existingValue;
        if (idOnly.startsWith(orcidBaseUrl)) {
            idOnly = idOnly.substring(orcidBaseUrl.length);
        } else if (idOnly.startsWith(rorBaseUrl)) {
            idOnly = idOnly.substring(rorBaseUrl.length);
        } else if (idOnly.startsWith("orcid:")) {
            idOnly = idOnly.substring(6);
        } else if (idOnly.startsWith("ror:")) {
            idOnly = idOnly.substring(4);
        }
        var isOrcidValue = idOnly.match(/^\d{4}-\d{4}-\d{4}-(\d{4}|\d{3}X)$/);
        var isRorValue = idOnly.match(/^0[a-z0-9]{6}[0-9]{2}$/);

        var i18n = window.personOrg.state.i18n;

        if (protocol === 'orcid-or-ror') {
            var initialType = isRorValue ? 'organization' : 'person';
            // Create a vertical control stack that can stretch to the same height
            // as the neighboring child field in managed-field layouts.
            var radioName = "person-org-choice-" + num;
            var personRadioId = "person-choice-" + num;
            var orgRadioId = "org-choice-" + num;

            var radioHtml = `
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap;">
                  <div class="radio-inline" style="margin-left: 0; margin-right: 0;">
                    <label for="${personRadioId}" style="font-weight: 100; margin-bottom: 0;">
                      <input type="radio" id="${personRadioId}" name="${radioName}" value="person" ${initialType === 'person' ? 'checked' : ''}> ${i18n.person}
                    </label>
                  </div>
                  <div class="radio-inline" style="margin-left: 0; margin-right: 0;">
                    <label for="${orgRadioId}" style="font-weight: 100; margin-bottom: 0;">
                      <input type="radio" id="${orgRadioId}" name="${radioName}" value="organization" ${initialType === 'organization' ? 'checked' : ''}> ${i18n.organization}
                    </label>
                  </div>
               </div>`;

            container.append(radioHtml);
            container.append('<select id=' + selectId + ' class="form-control add-resource select2" tabindex="0">');
        } else if (protocol === 'ror' || protocol === 'orcid') {
            if (Object.keys(managedFields).length > 0) {
                container.append('<select id=' + selectId + ' class="form-control add-resource select2" tabindex="0">');
            } else {
                $(personOrgInput).after('<select id=' + selectId + ' class="form-control add-resource select2" tabindex="0">');
            }
        }

        if (Object.keys(managedFields).length > 0) {
            matchManagedFieldHeights(personOrgInput);
        }

        var $select2 = $("#" + selectId);

        if (protocol === 'orcid-or-ror') {
            setupSelect2(initialType, $select2, personOrgInput, managedFields, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);
            $('input[name="' + radioName + '"]').on('change', function () {
                setupSelect2($(this).val(), $select2, personOrgInput, managedFields, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);
            });
        } else if (protocol === 'orcid') {
            setupSelect2('person', $select2, personOrgInput, managedFields, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);
        } else if (protocol === 'ror') {
            setupSelect2('organization', $select2, personOrgInput, managedFields, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);
        }


        // Pre-populate the select if the hidden input already has a value.
        // This mirrors the behavior in the original ORCID and ROR scripts.

        function showMismatchWarning(selectElement, dvValue, serviceValue, $nameField, type) {
            $(selectElement).parent().find(".mismatch-warning").remove();
            var i18n = window.personOrg.state.i18n;
            var typeLabel = (type === 'organization' ? 'ROR' : 'ORCID');
            var warningText = formatString(i18n.mismatchWarning, dvValue, typeLabel, serviceValue);

            var warningHtml = `
                <div class="mismatch-warning" style="margin-top: 5px; color: #8a6d3b; background-color: #fcf8e3; border: 1px solid #faebcc; padding: 5px; border-radius: 4px; font-size: 0.9em;">
                    <span class="glyphicon glyphicon-warning-sign"></span>
                    ${warningText}
                    <button type="button" class="btn btn-xs btn-warning update-name-btn" style="margin-left: 10px;">${i18n.update}</button>
                </div>`;

            var $warning = $(warningHtml);
            var $container = $(selectElement).next('.select2-container');
            if ($container.length === 0) {
                $container = $(selectElement);
            }
            $container.after($warning);
            matchManagedFieldHeights(personOrgInput);

            $warning.find(".update-name-btn").on('click', function () {
                $nameField.val(serviceValue).attr('value', serviceValue).trigger('change');
                $warning.fadeOut(function () {
                    $(this).remove();
                    matchManagedFieldHeights(personOrgInput);
                });
            });
        }

        function populateExistingPerson(id, selectElement, baseUrl) {
            var personRetrievalUrl = (baseUrl.includes("sandbox.orcid.org") ? "https://pub.sandbox.orcid.org/" : "https://pub.orcid.org/") + "v3.0/" + id + "/person";
            $.ajax({
                type: "GET",
                url: personRetrievalUrl,
                dataType: 'json',
                headers: {
                    'Accept': 'application/json'
                },
                success: function (person) {
                    var familyName = (person.name && person.name['family-name']) ? person.name['family-name'].value : "";
                    var givenNames = (person.name && person.name['given-names']) ? person.name['given-names'].value : "";
                    var name = (familyName ? familyName + ", " : "") + (givenNames || id);
                    var text = name + "; " + id;
                    if (person.emails && person.emails.email && person.emails.email.length > 0) {
                        text = text + "; " + person.emails.email[0].email;
                    }
                    var newOption = new Option(text, id, true, true);
                    newOption.title = i18n.openOrcidPage;
                    selectElement.append(newOption).trigger('change');

                    if (managedFields.personName) {
                        var $nameField = $(parent).find("input[data-cvoc-managed-field='" + managedFields.personName + "']");
                        var currentValue = $nameField.val();
                        if (currentValue && currentValue !== name) {
                            showMismatchWarning(selectElement, currentValue, name, $nameField, 'person');
                        }
                    }
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    if (jqXHR.status != 404) {
                        console.error("The following error occurred: " + textStatus, errorThrown);
                    }
                }
            });
        }

        function populateExistingOrganization(id, selectElement, baseUrl) {
            var rorRetrievalUrl = (rorBaseUrl.startsWith("https://sandbox.ror.org") ? "https://api.sandbox.ror.org/organizations/" : "https://api.ror.org/organizations/") + id;

            $.ajax({
                type: "GET",
                url: rorRetrievalUrl,
                dataType: 'json',
                headers: {
                    'Accept': 'application/json'
                },
                success: function (ror) {
                    const displayName = ror.names.find(n =>
                        n.types && (n.types.includes("ror_display") || n.types.includes("label"))
                    )?.value || ror.id;

                    const acronyms = ror.names
                        .filter(n => n.types && n.types.includes("acronym"))
                        .map(n => n.value);

                    var text = displayName + ", " + ror.id.replace(baseUrl, '') + ', ' + acronyms.join(',');
                    var newOption = new Option(text, id, true, true);
                    selectElement.append(newOption).trigger('change');

                    if (managedFields.personName) {
                        var $nameField = $(parent).find("input[data-cvoc-managed-field='" + managedFields.personName + "']");
                        var currentValue = $nameField.val();
                        if (currentValue && currentValue !== displayName) {
                            showMismatchWarning(selectElement, currentValue, displayName, $nameField, 'organization');
                        }
                    }
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    if (jqXHR.status != 404) {
                        console.error("The following error occurred: " + textStatus, errorThrown);
                    }
                }
            });
        }

        if (existingValue) {
            if (protocol === 'orcid-or-ror') {
                if (isOrcidValue) {
                    $('input[name="' + radioName + '"][value="person"]').prop('checked', true);
                    setupSelect2('person', $select2, personOrgInput, managedFields, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);
                    var orcidId = existingValue.replace(orcidBaseUrl, '').replace('orcid:', '');
                    populateExistingPerson(orcidId, $select2, orcidBaseUrl);
                } else if (isRorValue) {
                    $('input[name="' + radioName + '"][value="organization"]').prop('checked', true);
                    setupSelect2('organization', $select2, personOrgInput, managedFields, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);
                    var rorId = existingValue.replace(rorBaseUrl, '').replace('ror:', '');
                    populateExistingOrganization(rorId, $select2, rorBaseUrl);
                } else {
                    // Plain text
                    $('input[name="' + radioName + '"][value="person"]').prop('checked', false);
                    $('input[name="' + radioName + '"][value="organization"]').prop('checked', false);
                    if (Object.keys(managedFields).length > 0) {
                        //Handle managed fields
                        if (existingValue.length > 0) {
                            $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent().show();
                            $(personOrgInput).parent().show();
                        }
                    }

                    var newOption = new Option(existingValue, existingValue, true, true);
                    $select2.append(newOption).trigger('change');
                }
            } else if (protocol === 'orcid') {
                if (isOrcidValue) {
                    var orcidIdOnly = existingValue.replace(orcidBaseUrl, '').replace('orcid:', '');
                    populateExistingPerson(orcidIdOnly, $select2, orcidBaseUrl);
                } else {
                    if (Object.keys(managedFields).length > 0) {
                        //Handle managed fields
                        if (existingValue.length > 0) {
                            $(parent).find("[data-cvoc-managed-field='" + managedFields.idType + "']").parent().show();
                            $(personOrgInput).parent().show();
                        }
                    }
                    var newOption = new Option(existingValue, existingValue, true, true);
                    $select2.append(newOption).trigger('change');
                }
            } else if (protocol === 'ror') {
                if (isRorValue) {
                    var rorIdOnly = existingValue.replace(rorBaseUrl, '').replace('ror:', '');
                    populateExistingOrganization(rorIdOnly, $select2, rorBaseUrl);
                } else {
                    var newOption = new Option(existingValue, existingValue, true, true);
                    $select2.append(newOption).trigger('change');
                }
            }
        }
    });
}

function setupSelect2(type, $select2, personOrgInput, managedFields, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl) {
    $select2.off('.personOrg');
    if ($select2.data('select2')) {
        $select2.select2('destroy');
        $select2.empty();
    }
    $select2.parent().find(".mismatch-warning").remove();
    matchManagedFieldHeights(personOrgInput);

    var config = (type === 'person')
        ? getPersonSelect2Config(personOrgInput, orcidSearchUrl, orcidBaseUrl)
        : getOrgSelect2Config(personOrgInput, rorSearchUrl);

    $select2.select2(config).on('select2:opening.personOrg', function (e) {
        var $this = $(this);
        $this.data('selection-made', false);
        // Capture current selection for revert on Esc
        var data = $this.select2('data');
        if (data && data.length > 0) {
            $this.data('revert-val', {id: data[0].id, text: data[0].text, type: type});
        }
    }).on('select2:select.personOrg', function (e) {
        $(this).data('selection-made', true);
        $(this).data('revert-val', null);
        $(this).parent().find(".mismatch-warning").remove();
        matchManagedFieldHeights(personOrgInput);
        var data = e.params.data;
        var hasPlainText = data.text === data.id;
        var isOrcid = (type === 'person');
        var isRor = (type === 'organization');

        var url = "";
        if (!hasPlainText) {
            url = isOrcid ? orcidBaseUrl + data.id : rorBaseUrl + data.id;
        } else if (Object.keys(managedFields).length === 0) {
            url = data.id;
        }
        $(personOrgInput).val(url).trigger('change');

        if (!hasPlainText) {
            if (isOrcid) {
                $("input[data-person-org='" + $(personOrgInput).attr('data-person-org') + "']").val(orcidBaseUrl + data.id).attr('value', orcidBaseUrl + data.id);
                storeValue(orcidPrefix, data.id, data.text.split(";")[0]);
            } else if (isRor) {
                $("input[data-person-org='" + $(personOrgInput).attr('data-person-org') + "']").val(rorBaseUrl + data.id).attr('value', rorBaseUrl + data.id);
                storeValue(rorPrefix, data.id, data.text.split(' | ')[0]);
            }
        } else {
            $("input[data-person-org='" + $(personOrgInput).attr('data-person-org') + "']").val(url).attr('value', url);
        }

        if (Object.keys(managedFields).length > 0) {
            var parentField = $(personOrgInput).attr('data-cvoc-parent');
            var parent = $(personOrgInput).closest("[data-cvoc-parentfield='" + parentField + "']");


            var managedFieldKeys = Object.keys(managedFields);

            for (var i = 0; i < managedFieldKeys.length; i++) {
                var key = managedFieldKeys[i];
                var selector = "[data-cvoc-managed-field='" + managedFields[key] + "']";

                if (key === 'personName') {
                    var displayName = '';
                    if (isOrcid) {
                        displayName = data.text.split(";", 1)[0];
                    } else {
                        displayName = data.text.split(" | ", 1)[0];
                    }
                    $(parent).find("input" + selector).val(displayName).attr('value', displayName);
                } else if (key === 'idType') {
                    var $selectField = $(parent).find(selector).find("select");
                    var desiredValue = '';

                    if (isOrcid && !hasPlainText) {
                        var orcidVal = $selectField.find('option:contains("ORCID")').val();
                        desiredValue = orcidVal || '';
                    } else if (isRor && !hasPlainText) {
                        var rorVal = $selectField.find('option:contains("ROR")').val();
                        desiredValue = rorVal || '';
                    }
                    $selectField.val(desiredValue).attr('value', desiredValue).trigger('change');
                } else {
                    $(parent).find(selector).val('').trigger('change').attr('value', '');
                }
            }

            updateManagedFieldVisibility(personOrgInput, managedFields, !hasPlainText);
        }
    }).on('select2:unselect.personOrg select2:clear.personOrg', function (e) {
        var $this = $(this);
        // Capture for revert before clearing if not already captured
        if (!$this.data('revert-val')) {
            var data = $this.select2('data');
            if (data && data.length > 0) {
                $this.data('revert-val', {id: data[0].id, text: data[0].text, type: type});
            }
        }
        $this.parent().find(".mismatch-warning").remove();
        $(personOrgInput).val("").trigger('change');

        // Ensure a radio button is selected if in orcid-or-ror mode
        var $radios = $this.parent().find('input[type="radio"]');
        if ($radios.length > 0 && $radios.filter(':checked').length === 0) {
            $radios.filter('[value="person"]').prop('checked', true);
        }

        if (Object.keys(managedFields).length > 0) {
            var parentField = $(personOrgInput).attr('data-cvoc-parent');
            var parent = $(personOrgInput).closest("[data-cvoc-parentfield='" + parentField + "']");

            // Clear managed fields
            var managedFieldKeys = Object.keys(managedFields);
            for (var i = 0; i < managedFieldKeys.length; i++) {
                var key = managedFieldKeys[i];
                var selector = "[data-cvoc-managed-field='" + managedFields[key] + "']";
                if (key === 'personName') {
                    $(parent).find("input" + selector).val('').attr('value', '');
                } else if (key === 'idType') {
                    $(parent).find(selector).find("select").val('').attr('value', '').trigger('change');
                } else {
                    $(parent).find(selector).val('').attr('value', '');
                }
            }

            // Hide ID fields while cleared/searching
            updateManagedFieldVisibility(personOrgInput, managedFields, true);
        } else {
            matchManagedFieldHeights(personOrgInput);
        }
    });

    $select2.on('select2:open.personOrg', function (e) {
        var $this = $(this);
        if (Object.keys(managedFields).length > 0) {
            updateManagedFieldVisibility(personOrgInput, managedFields, true);
        }

        // Ensure a radio button is selected if in orcid-or-ror mode
        var $radios = $this.parent().find('input[type="radio"]');
        if ($radios.length > 0 && $radios.filter(':checked').length === 0) {
            $radios.filter('[value="person"]').prop('checked', true);
        }

        var $searchField = $(".select2-search__field");
        $searchField.on('keydown.revert', function (e) {
            if (e.which === 27) { // Escape
                $this.data('esc-pressed', true);
            }
        });

        $searchField.focus();
        $searchField.attr("id", $select2.attr('id') + "_input");
        var inputEl = document.getElementById($select2.attr('id') + "_input");
        if (inputEl) {
            inputEl.select();
        }
    }).on('select2:close.personOrg', function (e) {
        var $this = $(this);
        var escPressed = $this.data('esc-pressed');
        var selectionMade = $this.data('selection-made');
        var revert = $this.data('revert-val');
        $this.data('esc-pressed', false);
        $(".select2-search__field").off('keydown.revert');

        if (escPressed && !selectionMade && revert && !$this.val()) {
            if (revert.type && revert.type !== type) {
                // Switch radio back and re-setup Select2 for the original type
                $this.parent().find('input[type="radio"][value="' + revert.type + '"]').prop('checked', true);
                setupSelect2(revert.type, $this, personOrgInput, managedFields, orcidSearchUrl, rorSearchUrl, orcidBaseUrl, rorBaseUrl);
            }

            // Restore original value if we escaped while empty
            var newOption = new Option(revert.text, revert.id, true, true);
            $this.append(newOption).trigger('change');

            // Trigger select2:select to restore hidden fields and visibility
            $this.trigger({
                type: 'select2:select',
                params: {
                    data: {
                        id: revert.id,
                        text: revert.text
                    }
                }
            });

            // If it was a plain string, uncheck the radio buttons
            if (revert.id === revert.text) {
                var $radios = $this.parent().find('input[type="radio"]');
                $radios.prop('checked', false);
            }
        }
        $this.data('revert-val', null);

        if (Object.keys(managedFields).length > 0) {
            var val = ($(this).val() || '').trim();
            // Check if current value is an identifier (ORCID or ROR)
            var isIdentifier = val && (
                val.match(/^\d{4}-\d{4}-\d{4}-(\d{4}|\d{3}X)$/) || // ORCID
                val.match(/^0[a-z0-9]{6}[0-9]{2}$/) ||              // ROR
                val.includes('orcid.org') || val.includes('ror.org') ||
                val.startsWith('orcid:') || val.startsWith('ror:')
            );

            // If it's a plain string or restored string, show the ID fields.
            // If it's empty or an identifier, keep them hidden (empty case follows default layout).
            var isPlainText = val && !isIdentifier;
            updateManagedFieldVisibility(personOrgInput, managedFields, !isPlainText);
        }
    });
}

// --- Helper functions for ORCID/Person ---

function expandPerson(element, id, orcidBaseUrl) {
    var i18n = window.personOrg.state.i18n;
    var orcidRetrievalUrl = (orcidBaseUrl.includes("sandbox.orcid.org") ? "https://pub.sandbox.orcid.org/" : "https://pub.orcid.org/") + "v3.0/" + id + "/person";
    $.ajax({
        type: "GET",
        url: orcidRetrievalUrl,
        dataType: 'json',
        headers: {'Accept': 'application/json'},
        success: function (person) {
            //If found, construct the HTML for display
            var familyName = (person.name && person.name['family-name']) ? person.name['family-name'].value : "";
            var givenNames = (person.name && person.name['given-names']) ? person.name['given-names'].value : "";
            var name = (familyName ? familyName + ", " : "") + (givenNames || id);

            checkOrcidWorkMatch(id, orcidBaseUrl).then(function (authenticated) {
                const scriptUrl = Array.from(document.scripts)
                    .map(s => s.src)
                    .find(src => src && src.includes("person-or-org.js"));
                //Use authenticated or unauthenticated ORCID icon/syntax
                const orcidIconUrl = scriptUrl
                    ? scriptUrl.replace("/js/person-or-org.js", (authenticated ? "/img/ORCID-iD_icon_16x16-preview.webp" : "/img/ORCID-iD_icon_unauth_16x16-preview.webp"))
                    : "";
                var displayElement = $('<span/>').text(name).append($('<a/>').attr('href', orcidBaseUrl + id).attr('target', '_blank').attr('rel', 'noopener').html(
                    '<img alt="' + i18n.orcidLogoAlt + '" src="' + orcidIconUrl + '" width="16" height="16" />').attr('title', i18n.orcidProfileTooltip));
                if (!authenticated) {
                    displayElement.append($('<span/>').text(i18n.unauthenticated).attr('title', i18n.unauthenticatedTooltip));
                }
                $(element).hide();
                let sibs = $(element).siblings("[data-cvoc-index='" + $(element).attr('data-cvoc-index') + "']");
                let target = element;
                if (sibs.length > 0 && $(sibs.eq(0)).index() < $(element).index()) {
                    target = sibs.eq(0);
                }
                displayElement.insertBefore(target);
            });
        },
        error: function () {
            showAsPlainText(element);
        }
    });
}

/**
 * Checks if the current dataset is in the works of the author's ORCID profile.
 *
 * @param {string} orcidId - The ORCID identifier
 * @param {string} orcidBaseUrl - The ORCID base URL
 * @return {Promise<boolean>} Promise that resolves to true if a match is found, false otherwise
 */
function checkOrcidWorkMatch(orcidId, orcidBaseUrl) {
    var datasetPid = $('meta[name="DC.identifier"]').attr('content');
    if (!datasetPid) {
        return Promise.resolve(false);
    }
    // Normalize datasetPid for comparison (remove doi: prefix if present)
    var normalizedDatasetPid = datasetPid.replace(/^doi:/i, '').toLowerCase();

    var orcidWorksUrl = (orcidBaseUrl.includes("sandbox.orcid.org") ? "https://pub.sandbox.orcid.org/" : "https://pub.orcid.org/") + "v3.0/" + orcidId + "/works";

    return $.ajax({
        type: "GET",
        url: orcidWorksUrl,
        dataType: 'json',
        headers: {
            'Accept': 'application/json'
        }
    }).then(
        function (data) {
            var works = data.group || [];
            var matchFound = works.some(function (group) {
                return (group['work-summary'] || []).some(function (summary) {
                    var externalIds = (summary['external-ids'] && summary['external-ids']['external-id']) || [];
                    return externalIds.some(function (extId) {
                        var val = (extId['external-id-value'] || '').toLowerCase();
                        return val === normalizedDatasetPid;
                    });
                });
            });
            return matchFound;
        },
        function () {
            return false;
        }
    );
}

function expandOrganization(element, id, rorBaseUrl) {
    var rorRetrievalUrl = (rorBaseUrl.startsWith("https://sandbox.ror.org") ? "https://api.sandbox.ror.org/organizations/" : "https://api.ror.org/organizations/") + id;
    $.ajax({
        type: "GET",
        url: rorRetrievalUrl,
        dataType: 'json',
        headers: {'Accept': 'application/json'},
        success: function (org) {
            // If found, construct the HTML for display
            // Find the display name (type: "ror_display" or "label")
            const displayName = org.names.find(n =>
                n.types && (n.types.includes("ror_display") || n.types.includes("label"))
            )?.value || org.id;

            // Find all acronyms
            const acronyms = org.names
                .filter(n => n.types && n.types.includes("acronym"))
                .map(n => n.value);

            var city = org.locations[0].geonames_details.name;
            var country = org.locations[0].geonames_details.country_name;
            var displayInfo = getRorDisplayContext(element);
            $(element).html(getRorDisplayHtml(
                displayName,
                rorBaseUrl + id,
                acronyms,
                city,
                country,
                displayInfo.truncate,
                displayInfo.useParens
            ));
            if (displayInfo.useParens) {
                $(element).attr('style', 'margin-left: 0.25em;');
            }
        },
        error: function () {
            showAsPlainText(element);
        }
    });
}

function showAsPlainText(element) {
    var text = element.textContent.trim();
    var displayInfo = getRorDisplayContext(element);
    var orcidBaseUrl = $(element).attr('data-cvoc-service-url') || "https://orcid.org/";

    if (text.startsWith(orcidBaseUrl)) {
        text = text.substring(orcidBaseUrl.length);
    } else if (text.startsWith(rorBaseUrl)) {
        text = text.substring(rorBaseUrl.length);
    }

    if (displayInfo.truncate && text.length >= rorMaxLength) {
        text = text.substring(0, rorMaxLength) + "…";
    }

    if (displayInfo.useParens) {
        text = '(' + text + ')';
        $(element).attr('style', 'margin-left: 0.25em;');
    }

    $(element).text(text);
}

function getRorDisplayContext(element) {
    let useParens = true;
    let truncate = false;
    let prev = $(element)[0].previousSibling;

    if (prev != null && prev.tagName != 'BR') {
        let val = prev.nodeValue;
        if (val !== null) {
            let index = val.indexOf('(');
            if (index != -1) {
                $(element)[0].previousSibling.data = val.substring(0, index);
            }
        }
    } else {
        useParens = false;
        truncate = true;
    }

    return {useParens, truncate};
}

function getRorDisplayHtml(name, url, altNames, city, country, truncate = true, addParens = false) {
    var i18n = window.personOrg.state.i18n || {
        rorLogoAlt: "ROR logo",
        rorProfileTooltip: "Click to see this ROR profile",
        noRorEntry: "No ROR Entry"
    };
    if (typeof (altNames) == 'undefined') {
        altNames = [];
    }
    if (truncate && (name.length >= rorMaxLength)) {
        altNames.unshift(name);
        name = name.substring(0, rorMaxLength) + "…";
    }
    if (url != null) {
        name = name + '<a href="' + url + '" target="_blank" rel="nofollow" >' + '<img alt="' + i18n.rorLogoAlt + '" src="https://raw.githubusercontent.com/ror-community/ror-logos/main/ror-icon-rgb.svg" height="20" class="ror" title="' + i18n.rorProfileTooltip + '"/></a>';
    }
    if (addParens) {
        name = '<span>(' + name + ')</span>';
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
    var i18n = window.personOrg.state.i18n;
    return {
        theme: "classic",
        tags: $(inputElement).data("cvoc-allowfreetext"),
        delay: 500,
        templateResult: function (item) {
            // No need to template the searching text
            if (item.loading) {
                return item.text;
            }

            // markMatch2 bolds the search term if/where it appears in the result
            return markMatch2(item.text, term);
        },
        templateSelection: function (item) {
            // For a selection, add HTML to make the ORCID a link
            var pos = item.text.search(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/);
            if (pos >= 0) {
                var orcid = item.text.substr(pos, 19);
                return $('<span></span>').append(
                    item.text.replace(orcid, "<a href='" + baseUrl + orcid + "' target='_blank'>" + orcid + "</a>")
                );
            }
            return item.text;
        },
        language: {
            searching: function (params) {
                return i18n.searching;
            }
        },
        placeholder: $(inputElement).attr("data-cvoc-placeholder") || i18n.placeholder,
        minimumInputLength: 3,
        allowClear: true,
        ajax: {
            // Use an ajax call to ORCID to retrieve matching results
            url: searchUrl,
            data: function (params) {
                term = params.term;
                if (!term) {
                    term = "";
                }
                term = term.replace(/([+\-&|!(){}[\]^"~*?:\\\/])/g, "\\$1");
                return {
                    q: term,
                    // Currently we just get the top 10 hits.
                    rows: 10
                };
            },
            headers: {
                'Accept': 'application/json'
            },
            processResults: function (data, page) {
                let newItems = data['expanded-result'];
                if (newItems == null) {
                    return {results: []};
                }
                return {
                    results: data['expanded-result']
                        // Sort to bring recently used ORCIDs to the top of the list
                        .sort((a, b) => Number(getValue(orcidPrefix, b['orcid-id']).name != null) - Number(getValue(orcidPrefix, a['orcid-id']).name != null))
                        .map(function (x) {
                            return {
                                text: ((x['family-names']) ? x['family-names'] + ", " : "") + x['given-names'] +
                                    "; " +
                                    x['orcid-id'] +
                                    ((x.email.length > 0) ? "; " + x.email[0] : ""),
                                id: x['orcid-id'],
                                // Since clicking in the selection re-opens the choice list,
                                // one has to use a right click/open in new tab/window to view the ORCID page
                                title: i18n.openOrcidPage
                            };
                        })
                };
            }
        }
    };
}

function getOrgSelect2Config(inputElement, searchUrl) {
    var i18n = window.personOrg.state.i18n;
    return {
        theme: "classic",
        tags: $(inputElement).data("cvoc-allowfreetext"),
        delay: 500,
        language: {
            searching: function (params) {
                return i18n.searchingRor;
            }
        },
        placeholder: $(inputElement).attr('data-cvoc-placeholder') || i18n.placeholder,
        minimumInputLength: 3,
        allowClear: true,
        ajax: {
            url: searchUrl,
            dataType: 'json',
            data: function (params) {
                term = params.term;
                if (!term) {
                    term = "";
                } else {
                    term = term.replace(/([+\-&|!(){}[\]^"~*?:\\\/])/g, "\\$1") + "*";
                }
                return {
                    query: term
                };
            },
            headers: {
                'Accept': 'application/json'
            },
            processResults: function (data, params) {
                return {
                    results: (data['items'] || [])
                        .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'))
                        .map(org => {
                            const displayName = org.names.find(n =>
                                n.types && (n.types.includes("ror_display") || n.types.includes("label"))
                            )?.value || org.id;

                            const acronyms = org.names
                                .filter(n => n.types && n.types.includes("acronym"))
                                .map(n => n.value);

                            return {
                                ...org,
                                name: displayName,
                                acronyms: acronyms
                            };
                        })
                        .sort((a, b) => Number(b.acronyms.some(acr => acr === params.term)) -
                            Number(a.acronyms.some(acr => acr === params.term)))
                        .sort((a, b) => Number(getValue(rorPrefix, b['id'].replace(rorBaseUrl, '')).name != null) -
                            Number(getValue(rorPrefix, a['id'].replace(rorBaseUrl, '')).name != null))
                        .map(function (x) {
                            return {
                                text: x.name + ", " + x.id.replace(rorBaseUrl, '') + ', ' + x.acronyms.join(','),
                                id: x.id.replace(rorBaseUrl, '')
                            };
                        })
                };
            },
            cache: true
        },
        templateResult: function (item) {
            if (item.loading) {
                return item.text;
            }
            return markMatch2(item.text, term);
        },
        templateSelection: function (item) {
            var name = item.text;
            var pos = item.text.search(/, [a-z0-9]{9}/);
            if (pos >= 0) {
                name = name.slice(0, pos);
                var idnum = item.text.slice(pos + 2);
                var altNames = [];
                pos = idnum.indexOf(', ');
                if (pos > 0) {
                    altNames = idnum.slice(pos + 2).split(',');
                    idnum = idnum.slice(0, pos);
                }
                return getRorDisplayHtml(name, rorBaseUrl + idnum, altNames);
            }
            return getRorDisplayHtml(name, null, [i18n.noRorEntry]);
        }
    };
}
