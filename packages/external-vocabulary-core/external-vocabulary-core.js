(function (root, factory) {
    var api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.DataverseExternalVocabularyCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var ORCID_BASE_URL = 'https://orcid.org/';
    var ROR_BASE_URL = 'https://ror.org/';

    function getVocabularyNames(config) {
        return Object.keys((config && config.vocabs) || {});
    }

    function getDefaultVocabulary(config) {
        return getVocabularyNames(config)[0] || '';
    }

    function getVocabularyForUri(uri) {
        if (uri.indexOf(ORCID_BASE_URL) === 0) {
            return 'orcid';
        }
        if (uri.indexOf(ROR_BASE_URL) === 0) {
            return 'ror';
        }
        return undefined;
    }

    function getMappedFieldValue(term, key) {
        if (term.mappedFields && typeof term.mappedFields[key] === 'string') {
            return term.mappedFields[key];
        }

        switch (key) {
            case 'personName':
            case 'organizationName':
            case 'termName':
                return term.label;
            case 'idType':
            case 'vocabularyName':
                return term.vocabularyName;
            case 'vocabularyUri':
                return term.vocabularyUri;
            default:
                return undefined;
        }
    }

    function getManagedFieldValues(term, managedFields) {
        return Object.keys(managedFields || {}).reduce(function (values, key) {
            var value = getMappedFieldValue(term, key);
            if (value !== undefined) {
                values[key] = value;
            }
            return values;
        }, {});
    }

    function getClearedManagedFieldValues(managedFields) {
        return Object.keys(managedFields || {}).reduce(function (values, key) {
            values[key] = '';
            return values;
        }, {});
    }

    async function getJson(url, fetchImpl) {
        var response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
            throw new Error('External vocabulary request failed with status ' + response.status);
        }
        return response.json();
    }

    function toOrcidTerm(result) {
        var label = result['credit-name'] || [result['given-names'], result['family-names']]
            .filter(Boolean)
            .join(' ') || result['orcid-id'];

        return {
            uri: ORCID_BASE_URL + result['orcid-id'],
            label: label,
            vocabularyName: 'ORCID',
            vocabularyUri: ORCID_BASE_URL,
            source: 'orcid',
            mappedFields: {
                personName: label,
                termName: label,
                idType: 'ORCID',
                email: result.email && result.email[0],
                affiliation: result['institution-name'] && result['institution-name'][0]
            }
        };
    }

    function toRorTerm(organization) {
        var names = organization.names || [];
        var label = (names.find(function (name) {
            return name.types && name.types.indexOf('ror_display') !== -1;
        }) || names[0] || {}).value || organization.id;

        return {
            uri: organization.id,
            label: label,
            vocabularyName: 'ROR',
            vocabularyUri: ROR_BASE_URL,
            source: 'ror',
            mappedFields: {
                organizationName: label,
                personName: label,
                termName: label,
                idType: 'ROR',
                vocabularyName: 'ROR',
                vocabularyUri: ROR_BASE_URL,
                abbreviation: (organization.acronyms || [])[0]
            }
        };
    }

    async function searchOrcid(query, fetchImpl) {
        var data = await getJson(
            'https://pub.orcid.org/v3.0/expanded-search/?q=' + encodeURIComponent(query),
            fetchImpl
        );
        return (data['expanded-result'] || []).map(toOrcidTerm);
    }

    async function searchRor(query, fetchImpl) {
        var data = await getJson(
            'https://api.ror.org/v2/organizations?query=' + encodeURIComponent(query),
            fetchImpl
        );
        return (data.items || []).map(toRorTerm);
    }

    async function searchTerms(options) {
        var vocabulary = (options.vocabulary || getDefaultVocabulary(options.config)).toLowerCase();
        var fetchImpl = options.fetchImpl || root.fetch;

        if (typeof fetchImpl !== 'function') {
            throw new Error('A fetch implementation is required to search an external vocabulary.');
        }
        if (vocabulary === 'orcid') {
            return searchOrcid(options.query, fetchImpl);
        }
        if (vocabulary === 'ror') {
            return searchRor(options.query, fetchImpl);
        }
        return [];
    }

    return {
        getVocabularyNames: getVocabularyNames,
        getDefaultVocabulary: getDefaultVocabulary,
        getVocabularyForUri: getVocabularyForUri,
        getMappedFieldValue: getMappedFieldValue,
        getManagedFieldValues: getManagedFieldValues,
        getClearedManagedFieldValues: getClearedManagedFieldValues,
        searchTerms: searchTerms
    };
}));
