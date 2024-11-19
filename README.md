# Dataverse External Vocabulary Management

Dataverse supports the use of third-party vocabulary and persistent identifier (PID) services through a generic external vocabulary support mechanism that allows service-specific scripts, and field-specific json configurations added via a Dataverse setting that allows specification of how fields in Dataverse metadatablocks are to be associated with specific services and vocabularies.

For example, instead of a plain text type in, one could select a term from multiple vocabularies:

Select a vocabulary

![Input2](https://github.com/user-attachments/assets/e984acc4-de04-49f7-8397-a7f2c4fc70f5)

and then a term

![Input3](https://github.com/user-attachments/assets/de48f382-4d74-4e75-aa29-a76853e88eba)

and have them displayed as a link to the remote site defining the term:

![Display2](https://github.com/user-attachments/assets/27aab9fe-c876-4ab6-8d74-eb6cc29274c4)

Or, with [additions planned for Dataverse 6.4](https://github.com/IQSS/dataverse/pull/10712), one could replace the four author related fields with selectors for [ORCID](https://orcid.org) (people) and [ROR](https://ror.org) (organizations)

![Input1](https://github.com/user-attachments/assets/b0f724e1-952b-4d48-8f89-8f046d797ce8)

which would display as entries with icons that link to the definition pages.

![Display1](https://github.com/user-attachments/assets/67fd166e-855b-4044-8dfd-d2ae0ccbfed5)

and can still support entering info for people/organizations who do not have ORCID or ROR entries.

Display can also be graphical, as in displaying [Local Contexts](https://localcontexts.org/) Notices and Labels

![image](https://github.com/user-attachments/assets/87aab5b1-6aca-49b1-8f7a-1e253932650d)

## Repository Contents

This repository contains scripts and example materials that demonstrate how to configure Dataverse to leverage them. They are a mixture of initial proofs-of-concept, demonstrations of alternative approaches, and some that are potentially mature enough for production use (although the latter often require later versions of Dataverse which have extensions/bug fixes for the underlying mechanism. Documentation in the /examples subdirectory provides additional details for specific scripts and configuration for specific fields.

It also contains a [JSON Schema that can be used to validate configuration files](https://github.com/gdcc/dataverse-external-vocab-support/blob/main/examples/config/demo/CVocConf.schema.json).

## Scripts in Production

The following scripts/config files are being used in production (or testing) at one or more Dataverse Sites

* **ORCID and ROR for Dataset authors** - see [https://github.com/gdcc/dataverse-external-vocab-support/examples/authorIDandAffilationUsingORCIDandROR.md](https://github.com/gdcc/dataverse-external-vocab-support/blob/main/examples/authorIDandAffilationUsingORCIDandROR.md)


* **Integration with [https://localcontexts.org](https://localcontexts.org)** (on [https://demo.dataverse.org](https://demo.dataverse.org) using the LocalContexts Sandbox) - see [https://github.com/gdcc/dataverse-external-vocab-support/tree/main/packages/local_contexts](https://github.com/gdcc/dataverse-external-vocab-support/tree/main/packages/local_contexts)

## Deployment

In general there are three steps to add interaction with a vocabulary or PID service to Dataverse:

* Identify the metadata field to be enhanced. This can be a field in an existing block, or one in a custom block that you install (there are some custom blocks in this repo for various scripts). As with any custom block, you must [install it in Dataverse](https://guides.dataverse.org/en/latest/admin/metadatacustomization.html#metadata-block-setup), enable the use of this new block in your Dataverse collection (e.g. Use the Edit/General Information menu item, /Metadata Fields section to add the block/specific fields.) and add any desired terms from the example block to the Browse/Search Facets list (same Edit/General Information menu item)
* Create a configuration file and [submit it as the :CVocConf setting value](https://guides.dataverse.org/en/latest/installation/config.html#cvocconf) for your Dataverse. It is probably easiest to modify the example scripts here. Nominally you would only need to change the metadata field the script will enhance and the URL for the location of the script. You should validate your file against the provided [JSON Schema](https://guides.dataverse.org/en/latest/installation/config.html#cvocconf) to avoid errors that can break the Dataverse page display.
* Deploy the script(s) to a local location that matches the URL you chose in the config file. It is possible to access the scripts from the github.io URLs used in the example config files here, but this is not recommended as we are not yet versioning the scripts and assuring that the version in the repository will not change.

To deploy scripts to multiple fields, you need to add one section (JSON Object) per field/script combo to the array in your config file.

## How It All Works

The basic idea of the Dataverse External Vocabulary mechanism is to simplify adding and displaying controlled terms and PIDs as metadata. As far as Dataverse is concerned, all that is happening is that a term or PID URI is being entered into a text field and Dataverse then stores and displays the term/PID URI. The interesting part is that a JavaScript is taking over Dataverse's text input and text display to instead provide support such as a type-ahead lookup from a vocabulary/PID service and, on the diplay side, displaying the human-readable name of associated with the term/PID, and potentially additional metadata about the term/PID, rather than the raw URI.

The scripts know which fields to manage based on some invisible data-cvoc-* attributes Dataverse adds to the page's HTML. Dataverse has a flexible configuration mechanism to allow admins to specify which fields should be associated with which scripts, but, in other repositories, these associations could be static. For example, [this simple static example page](examples/staticOrcidAndRorExample.html) shows the ORCID and ROR scripts associated with two input and two display fields. You can look at the page source to see the additional attributes in the HTML that make this work.

There's more of course. When a repository already has separate subfields for names and identifiers, scripts can be written to fill in both. If the underlying vocabulary/PID service supports multiple vocabularies, or has an advanced search mechanism, the scipts can be written to let you select which vocabulary to use or provide an advanced search interface. If there's a field where you want to be able to handle free text as well as controlled terms/PIDs, scripts can support that as well. Dataverse also includes a mechanism to allow metadata about the terms/PIDs to be captured, making it possible to provide internationalization for search (i.e. allowing search in your language for a term), include organization acronyms in exported metadata formats, etc. Fortunately, most of this complexity is handled by script/config example developers and Dataverse admins just need to select which ones to install.

For further details, see [James D. Myers, & Vyacheslav Tykhonov. (2023). A Plug-in Approach to Controlled Vocabulary Support in Dataverse.](https://doi.org/10.5281/zenodo.8133723)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.8133723.svg)](https://doi.org/10.5281/zenodo.8133723)





### Packages

The directory `packages` include complete working sets of metadatablock.tsv / cvoc config and / js files.

- local_contexts
Is pulling and displaying project-data from https://localcontextshub.org/
