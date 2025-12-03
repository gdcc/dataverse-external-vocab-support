## GrantNumberAgency Field Example

This example manages the grant number agency field,
 providing (ROR)[https://ror.org] lookup while also allowing free text entries (for entities that don't have these identifiers).

This example requires the changes that were added to Dataverse in (PR #10712)[https://github.com/IQSS/dataverse/pull/10712] as part of v6.4.

This example requires several files:

- examples/config/grantNumberAgencyRor.json : the configuration file that needs to be uploaded in the :CVocConf setting

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

- load the grantNumberAgencyRor.json file in the :CVocConf setting using the [Dataverse API](https://guides.dataverse.org/en/latest/installation/config.html#cvocconf). e.g. using curl: `curl -X PUT --upload-file authorsOrcidAndRor.json http://localhost:8080/api/admin/settings/:CVocConf`.

- Alternately, add the JSON Object in the top level JSON Array in grantNumberAgencyRor.json to your existing :CVocConf setting file (for installations that are deploying other CVoc scripts already)

- refresh your browser page. That's it. You should see displays like those shown in this repo's README file.

Production:

- Also copy the two script files to a local website and adjust the URLs in grantNumberAgencyRor.json that invoke them to use your local copies. This assures that changes in this repository will not automatically be used on your site.

- Adapt your CSS styling to improve how well the interfaces created by the script match your custom style.
