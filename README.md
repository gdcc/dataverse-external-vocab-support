## Dataverse External Vocabulary Management

Dataverse supports the use of third-party vocabulary services through a generic external vocabulary support mechanism, service-specific scripts, and a custom json configuration setting that allows specification of how fields in Dataverse metadatablocks are to be associated with specific services and vocabularies.

This repository contains several usable scripts and example materials that demonstrate how to configure Dataverse to leverage them.

Example Setup:

To enable external voabulary support on the example metadata block provided you need to:
* Install the custom metadata block
* Update your solr schema to include the custom fields
* Set the :CVocConf setting - use the /examples/config/cvoc-conf.json as the value
* Enable the use of this new block in your test Dataverse collection (e.g. Use the Edit/General Information menu item, /Metadata Fields section to add the block/specific fields.)
* Add any desired terms from the example block to the Browse/Search Facets list (same Edit/General Information menu item)

Only the third step is specific to enabling external vocabulary support. The others are just the standard steps for installing a new metadata block in Dataverse.

If you create your own :CVocConf setting value (i.e. to manage other fields), you can use the /examples/config/CVocConf.schema.json file to validate your syntax.

### Packages

The directory `packages` include complete working sets of metadatablock.tsv / cvoc config and / js files.

- local_contexts
Is pulling and displaying project-data from https://localcontextshub.org/