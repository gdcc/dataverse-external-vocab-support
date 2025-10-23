# LocalContexts Integration

## Overview

[Local Contexts](https://localcontexts.org/) is a global initiative that supports Indigenous communities in the management and sharing of their cultural heritage and data.
The [Local Contexts Hub](https://localcontextshub.org/) is a platform that enables the creation and application of Traditional Knowledge (TK) and Biocultural (BC) Labels and Notices. These labels and notices help to communicate the cultural context and appropriate use of Indigenous data and cultural heritage materials.

Dataverse supports integration with the Local Contexts Hub so that Labels and Notices associated with a dataset can be displayed on the dataset page:

![Dataset Page showing Local Contexts integration with Dataverse Software](LCDemo.png)

## Configuration

There are several steps to Local Contexts integration as described in the [Dataverse LocalContexts Integration Guide](https://guides.dataverse.org/en/latest/installation/localcontexts.html), including the requirement to have a Local Contexts Institutional or Integration Partner account. 
Instructions for the steps involving files in this repository are:

To install the Local Contexts Metadatablock, retrieve the [cvocLocalContexts.tsv](./cvocLocalContexts.tsv) and follow the instructions in the [Dataverse Guides](https://guides.dataverse.org/en/latest/admin/metadatacustomization.html#loading-tsv-files-into-a-dataverse-installation) to install it. Be sure to update the Solr schema as directed.
The metadatablock contains one field allowing Dataverse to store the URL of an associated Local Contexts Hub project. (As with any metadatablock, the Local Contexts block can be restricted to only being available in a specific collection (and it's subcollections) by adding a dataverseAlias in the second line of the tsv file.)

To configure the associated external vocabulary script, follow the general instructions for configuring external vocabular scripts provided in the main [README.md](../../README.md) of this repository.
Use the [lc-cvoc-conf.json](./lc-cvoc-conf.json) file for production environments or [lc-sandbox-cvoc.json](./lc-sandbox-cvoc.json) for testing environments. Edit the "cvoc-url" entry to reference your local Dataverse installation rather than "https://demo.dataverse.org" in the example files.
