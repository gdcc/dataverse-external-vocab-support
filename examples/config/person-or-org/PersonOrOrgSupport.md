# Person or Org support for Dataverse

This dreictory contains configurations that allow support lookup of people (via ORCID), or organizations (via ROR), or both (with user selecting "Person" or "Organization" when adding an entry).
The configurations support multiple fields. The choice or ORCID, ROR, or both is made by setting the protocol (orcid, ror, orcid-or-ror) in the configuration JSON. Any of these choices should work for any of the fields for which a configuration is supplied.

## Dataverse Compatibility note:

Use of the person-or-org.js script and the configurations in this directory require Dataverse >= 6.11. 

## Scripts Compatibility note:

The person-or-org.js script is designed as a replacement for the person.js and ror.js scripts. Using either of them in other fields will be less efficient (multiple scripts loading and running) and could cause errors or unexpected behavior.

## Configuration JSON files:

### How to install:

Minimal:

- load the desired json file in the :CVocConf setting using the [Dataverse API](https://guides.dataverse.org/en/latest/installation/config.html#cvocconf). e.g. using curl: `curl -X PUT --upload-file authorsOrcidAndRor.json http://localhost:8080/api/admin/settings/:CVocConf`.

- Alternately, use the compose* scripts or manually add multiple JSON Objects in the top level JSON Array for your existing :CVocConf setting file (for installations that are deploying other CVoc scripts already)

- refresh your browser page. That's it. You should see displays like those shown in this repo's README file.

### Testing vs. Production

Testing:

- The person-or-org.js script can be configured to use the ORCID sandbox by changing the references in authorsOrcidAndRor.json to replace https://orcid.org/ with https://sandbox.orcid.org/ in the cvoc-url, retrieval-url and vocabs entries.

Production:

- Also copy the script files to a local website and adjust the URLs in authorsOrcidOrRorAndRorAffiliation.json that invoke them to use your local copies. This assures that changes in this repository will not automatically be used on your site.
- The required files are:

  - examples/config/person-or-org/authorsOrcidOrRorAndRorAffiliation.json : the configuration file that needs to be uploaded in the :CVocConf setting
  - scripts/people-or-org.js : the Javascript file that provides ORCID and ROR support,
  - scripts/cvocutil.js : a Javascript file with common methods used by both scripts,

  (These scripts also use jquery and select2 which are already included in Dataverse).

- Adapt your CSS styling to improve how well the interfaces created by the script match your custom style.

### Dataverse Author Field

This config manages the author field (the name, idType, Identifier, and affiliation child fields), providing [ORCID](https://orcid/org) and or [ROR](https://ror.org) lookup in the author name field and [ROR](https://ror.org) for the affiliation.

This config requires the changes that were added to Dataverse in [PR #12331[(https://github.com/IQSS/dataverse/pull/12331) as part of v6.11.


### Grant Number Agency Field

This config supports ORCID or ROR lookup in the grant number agency field ("Funding Agency" in the Dataverse UI).

### Depositor Field

This config supports ORCID lookup in the depositor field. If you wish to use ROR instead, or both ORCID and ROR, change the "protocol" in the JSON config file.

## Interesting Features
- Searches can be done by person/organization name, but can also use other metadata, e.g. a person's email address or an originization in their employment or education history in their ORCID profile, or the acronym of an organization (entry must be at least 3 letters)
- Once an ORCID or ROR has been used in a given browser, that entry will appear at the top of the list as soon as it is one of the results returned from the service. This makes it easier to find a commonly used entry when there are similar ones.
- The people.js script understands that Dataverse has separate idType and Identifier fields for authors. When a free text entry is added as a name (i.e. there is no associated ORCID), the script will restore the idType and Identifier subfields so that an Identifier of some other type that Dataverse supports can be entered.
- Both ORCID and ROR icons are displayed with entries. They link to the person's/organization's page at ORCID/ROR.
