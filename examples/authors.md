The authors example uses the external vocabularies mechanism to implement a simple lookup and copy-and-paste functionality for the authors fields (name, affiliation, indentification scheme and number). It is different from the other examples as it does not store URLs to the external vocabulary, but instead copies the data directly into the dataverse metadata fields. The link with the vocabulary URI is therefore not persisted.

There are several reasons why we implemented it like this:

- we did not want to expose the personel data unprotected to the public internet. By copying the data instead of the URL, we can open the vocabulary only to the IP ranges that need access to dataset metadata editing, which for our institution is esentially on-premis or via VPN. The vocabulary server is no longer needed when the dataset metadata is published and accessed publicly.

- the data in the vocabulary will rarely change, it will only be expanded. The risk of author information getting outdated is very low. And even if so, it is likely that it would be better to leave the old metadata alone.

- we implemented it as a prototype for other metadata fields where the vocabulary data will most certainly change and we do not want these changes to percollate into the metadata of existing datasets. One such field is our faculty or department field. Departments splitting and merging do occur fairly regularly and we want the metadata to reflect the organisational entity as it was when the dataset was created. While this can be achieved in external vocabularies with deprecated entries, the extra complexity of maintaining the external vocabulary for a fairly simple list is not worth it. We will just change the list as we go and leave the existing data alone.

To illustrate the example for our authors lookup there are 2 files provided:

- examples/config/authors.json : the configuration file that needs to be uploaded in the :CVocConf setting

- scripts/authors.js : the Javascript file that modifies standard Dataverse behaviour

The standard authors compound fields are used, so there is no need to modify the default citation metadata block.

Note that this is a trimmed-down version of de code that we use in production. Our production version can be found in our [github repository](https://github.com/libis/rdm-covoc_server). There you will also find the implementation of a small REST server that performs the search in the background.

The JSON configuration file has most fields empty, but as they are all required, they need to be present in the configuration file. The `field-name` and `term-uri-field` have both been set to `authorName`. Only the field `field-name` should be set for this to work, but as I found out the hard way, the external vocabulary code insits that the `term-uri-field` also points to a valid metadata field. Theoretically, this means that the external vocabulary code that looks up values externally could be triggered if an URI is filled in in the `authorName` field, but it is fairly safe to asume that that will not be the case during normal use.

The `js-url` field in the configuration file points to the location where the JavaScript file is located. Since we already use an Apache frontend server to enable the Shibboleth logins, we decided to reverse-proxy the JavaScript file there as well. The other fields are emtpy and have no influence on our code.

The JavaScrip file contains three parts:

- first of all code that is triggered each time the page is loaded and each time an author compound field set is added or deleted. That piece of code is responsible for creating the HTML code for a modal dialog box with search box and table with results. It also puts a search button next to each authorName input field that will display the dialog box.

- the `authorsQuery` function performs a call to a server that will search the given string in the database and return the data for the matches found. The code asumes this to be a simeple REST server that returns JSON data. The server itself in our case uses a Solr index to query and retrieve the data. Again, for security reasons we did not want to expose the Solr server directly beyond the server itself, so a simple REST server in front of it sanitizes the queries and protects the Solr index from being abused.

- the `importAuthorData` function is triggered when a user selects one of the search results and is responsible for copying the JSON data into the input fields on the dataset metadata form. Most of it is pretty straightforward code looking for the input fields in the form and setting the values, except for the part where the `identifierScheme` has to be filled in. The dropdown box consists of multiple elements that have to be changed in sync and it took a while to figure that out. This is also the weakest point in the code, as translations could modify any displayed text and thus could break the code that relies on the text `ORCID` to be present in the dropdown box. In this case that is something we have full contol of, but be warned when porting this code to other fields.