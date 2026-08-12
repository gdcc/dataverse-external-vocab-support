const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./external-vocabulary-core');

test('maps configured managed fields from a normalized ROR term', () => {
    const values = core.getManagedFieldValues({
        uri: 'https://ror.org/03vek6s52',
        label: 'Dataverse University',
        vocabularyName: 'ROR',
        vocabularyUri: 'https://ror.org/',
        mappedFields: { abbreviation: 'DVU' }
    }, {
        organizationName: 'authorAffiliation',
        idType: 'authorIdentifierScheme',
        abbreviation: 'authorAffiliationAbbreviation'
    });

    assert.deepEqual(values, {
        organizationName: 'Dataverse University',
        idType: 'ROR',
        abbreviation: 'DVU'
    });
});

test('selects and detects official vocabulary identifiers', () => {
    assert.equal(core.getDefaultVocabulary({ vocabs: { orcid: {}, ror: {} } }), 'orcid');
    assert.equal(core.getVocabularyForUri('https://orcid.org/0000-0001-2345-6789'), 'orcid');
    assert.equal(core.getVocabularyForUri('https://ror.org/03vek6s52'), 'ror');
});

test('normalizes ORCID provider results through the shared search API', async () => {
    const results = await core.searchTerms({
        query: 'Ada',
        vocabulary: 'orcid',
        fetchImpl: async () => ({
            ok: true,
            json: async () => ({
                'expanded-result': [{
                    'orcid-id': '0000-0001-2345-6789',
                    'given-names': 'Ada',
                    'family-names': 'Lovelace',
                    email: ['ada@example.com']
                }]
            })
        })
    });

    assert.deepEqual(results[0], {
        uri: 'https://orcid.org/0000-0001-2345-6789',
        label: 'Ada Lovelace',
        vocabularyName: 'ORCID',
        vocabularyUri: 'https://orcid.org/',
        source: 'orcid',
        mappedFields: {
            personName: 'Ada Lovelace',
            termName: 'Ada Lovelace',
            idType: 'ORCID',
            email: 'ada@example.com',
            affiliation: undefined
        }
    });
});
