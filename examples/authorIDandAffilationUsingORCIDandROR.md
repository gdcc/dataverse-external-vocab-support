## Dataverse Author Field Example

This example manages the author field (the name, idType, Identifier, and affiliation child fields), providing (ORCID)[https://orcid/org] and (ROR)[https://ror.org] lookup while also allowing free text entries (for entities that don't have these identifiers) and manual entry of alternate identifiers for authors.

This example requires the changes that were added to Dataverse in (PR #10712)[https://github.com/IQSS/dataverse/pull/10712] as part of v6.4.

This example requires several files:

- examples/config/authorsOrcidAndRor.json : the configuration file that needs to be uploaded in the :CVocConf setting

- scripts/people.js : the Javascript file that provides ORCID support,
- scripts/ror.js : the Javascript file that provides ROR support,
- scripts/cvocutil.js : a Javascript file with common methods used by both scripts,

(These scripts also use jquery and select2 which are already included in Dataverse).

## Dataverse Compatibility note:

The ROR configuration/script now use ROR's v2 API and require Dataverse 6.9+ for full functionality.
For installations on earlier versions, the ROR organization name will not be added to the DataCite XML metadata.
Installations on <= Dataverse v6.8 *should not* upgrade their CVocConf configuration (keeping the retrieval-url pointed to ROR's v1 API, avoiding fatal errors from Dataverse <=6.8 trying to parse a v2 response).

## ROR Compatibility note:
As of Dec. 2025, ROR will no longer support it's v1 API. To retain ROR functionality, Dataverse sites should update to use the current ror.js script (which uses ROR's v2 API).
Dataverse instances on v6.9+ should also update to use the current :CVocConf configuration.
Dataverse instances using <=v6.8 also need to update the ror.js script but *should not* update their configuration (keeping the retrieval-url pointed to ROR's v1 API, avoiding fatal errors from Dataverse <=6.8 trying to parse a v2 response). 

### How to install:

Minimal: 

- load the authorsOrcidAndRor.json file in the :CVocConf setting using the [Dataverse API](https://guides.dataverse.org/en/latest/installation/config.html#cvocconf). e.g. using curl: `curl -X PUT --upload-file authorsOrcidAndRor.json http://localhost:8080/api/admin/settings/:CVocConf`.

- Alternately, add the two JSON Objects in the top level JSON Array in authorsOrcidAndRor.json to your existing :CVocConf setting file (for installations that are deploying other CVoc scripts already)

- refresh your browser page. That's it. You should see displays like those shown in this repo's README file.

Testing:

- The people.js script can be configured to use the ORCID sandbox by changing the references in authorsOrcidAndRor.json to replace https://orcid.org/ with https://sandbox.orcid.org/ in the cvoc-url, retrieval-url and vocabs entries.

Production:

- Also copy the three script files to a local website and adjust the URLs in authorsOrcidAndRor.json that invoke them to use your local copies. This assures that changes in this repository will not automatically be used on your site.

- Adapt your CSS styling to improve how well the interfaces created by the script match your custom style.

### Interesting Features
- Searches can be done by person/organization name, but can also use other metadata, e.g. a person's email address or an originization in their employment or education history in their ORCID profile, or the acronym of an organization (entry must be at least 3 letters)
- Once an ORCID or ROR has been used in a given browser, that entry will appear at the top of the list as soon as it is one of the results returned from the service. This makes it easier to find a commonly used entry when there are similar ones.
- The people.js script understands that Dataverse has separate idType and Identifier fields for authors. When a free text entry is added as a name (i.e. there is no associated ORCID), the script will restore the idType and Identifier subfields so that an Identifier of some other type that Dataverse supports can be entered.
- Both ORCID and ROR icons are displayed with entries. They link to the person's/organization's page at ORCID/ROR.
