## Demo

https://github.com/user-attachments/assets/4a4ba8c6-1ecb-473d-92d4-70051016fecb

## OntoPortal for Dataset keywords

This example manages the Keyword child fields (Term, Term URI, Controlled Vocabulary Name, and Controlled Vocabulary URL), providing (OntoPortal based software)[https://github.com/ontoportal] lookup while also allowing free text entries (for entities that don't have these identifiers) and manual entry of alternate identifiers for keywords.

This example requires the changes being added to Dataverse in [PR #10331](https://github.com/IQSS/dataverse/pull/10331) [PR #10371](https://github.com/IQSS/dataverse/pull/10371) [PR #10404](https://github.com/IQSS/dataverse/pull/10404) [PR #10503](https://github.com/IQSS/dataverse/pull/10503) [PR #10505](https://github.com/IQSS/dataverse/pull/10505) [PR #10603](https://github.com/IQSS/dataverse/pull/10603) packaged in v6.3.

This example requires two files:

- examples/config/cvoc-ontoportal-conf.json : the configuration file that needs to be uploaded in the :CVocConf setting
- scripts/ontoportal.js : the Javascript file that provides OntoPortal support

(These scripts also use jquery and select2 which are already included in Dataverse).

## Caution

This examples is entirely developed around [AgroPortal](https://github.com/ontoportal/ontoportal-project), a fork of Ontoportal which contains more advanced features around languages API parameters than other OntoPortal installations as I write these lines. 
This means depending on the installation of OntoPortal, you may need to fix some javascript that suit your available functionalities.
Be fully aware that integrating this example will not be easy as adapting or debugging the provided files may require to understand the full stack of the code (From OntoPortal API, passing by Javascript code to all related features hidden in Dataverse software code).

## Subtleties explanation

In examples/config/cvoc-ontoportal-conf.json :

- `"headers": {"Authorization": "apikey token=<your_apikey>"},` is used to send api key in javascript frontend request and java backend request since OntoPortal required an api key for API usage. This is not architecturally safe but it's a start. If you want to improved the security, you can develop a proxy that will embed the api key and allow only your domain using CORS rules.
- `"js-url": "https://raw.githubusercontent.com/gdcc/dataverse-external-vocab-support/main/scripts/ontoportal.js",` is a way to invoke the javascript file in the dataset page but it is better to have it hosted in your own machines.
- `"retrieval-uri": "https://data.agroportal.lirmm.fr/ontologies/{encodeUrl:keywordVocabulary}/classes/{encodeUrl:keywordTermURL}?lang=en,fr",` used by java backend code to store in database and SOLR keywords values in specified languages. `encodeUrl:` is used to encode the URL of Keyword Term and any space in Vocabulary Name case.
- `"allow-free-text": true,` allows users to enter keywords not found in the OntoPortal repository.
- `"vocabs":` in OntoPortal world, ontology equals to vocabulary of SKOMOS. For now we decided to operate with five specific ontologies. `"uriSpace": "http"` http value is a trick that allows entering Terms URL that might be out of specified vocabularties uri spaces (java backend code validate Term URL by checking if it `startsWith` "http").
- `"managed-fields":` are required in frontend management and to use field naming value feature in `"retrieval-uri":`.
- `"retrieval-filtering"` we decided to store `/synonym` and `/prefLabel` values in database and map them in `keywordValue` SOLR field to improved SOLR research (allowing to search related dataset with two languages and via synonyms or prefLabel) using `"indexIn":` feature.

In scripts/ontoportal.js :

Term URL may contains invalid URL as we have historical data, free text allowed and OntoPortal URLs or OntoPortal service sometimes unavailable. For those reason, we decided display the classical view of keywords values in Dataset Metadata tab view instead of constructed link pointing to the referenced keyword.
`ontoportal.js` is constructed around free text typing possibility; In addition, it allows users to toggle view between four basic inputs fields to one selectbox OntoPortal search.
The HTML DOM modification depends on the availability of the API service set with a 3500ms timeout maximum.
