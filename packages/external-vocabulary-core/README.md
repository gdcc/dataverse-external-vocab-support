# Dataverse External Vocabulary Core

This package has no UI or framework dependency. It provides official-registry
search for ORCID and ROR plus shared result normalization and managed-field
mapping. Browser adapters use the global `DataverseExternalVocabularyCore`; SPA
adapters import the same core through its ESM proxy during their application build.

The package is intentionally small so a Dataverse installation can serve it as
a normal script before the JSF adapter, while the Modern UI can bundle it.
