The affiliation example illustrates a lookup in ROR.org for the author affiliation field. As with the authors example, it is a simple lookup and fill-in solution. Do not expect changes in the ROR database to be propagated in the Dataset metadata.

Two files comprise this example:

- examples/config/demo/affiliation.json : the configuration file that needs to be uploaded in the :CVocConf setting

- scripts/affiliation.js : the Javascript file that modifies standard Dataverse behaviour

How to install:

- load the affiliation.json file in the :CVocConf setting using the [Dataverse API](https://guides.dataverse.org/en/latest/installation/config.html?highlight=cvocconf). e.g. using curl: `curl -X PUT --upload-file affiliation.json http://localhost:8080/api/admin/settings/:CVocConf`.

- refresh your browser page. That's it. You should see a search icon next to the affiliation input box of the Dataset Metadata editor which pops up a search dialog. Type some text in the search box (e.g. `UCLA`) and hit the `ENTER` key. Click on an organization name to see the ROR page and select the `import` button to copy the name in the Dataset metadata form.
