## Geonames Example

This example manages a text input field where you would have a name of a geographic location.

Config and setup similar to the general setup for the external CVOC, only this time you need an API key for the GeoNames service.
You can get a GeoNames API key for free; just go to [https://www.geonames.org/login](https://www.geonames.org/login) and create an account, then enable the API.


This example requires several files:

- examples/config/geonames.json : the configuration file that needs to be uploaded in the :CVocConf setting

- scripts/geonames.js : the Javascript file that provides Geonames support
- scripts/cvocutil.js : a Javascript file with common methods used by both scripts

(These scripts also use jquery and select2 which are already included in Dataverse).

The static example (staticGeonamesExample.html) does need the API key to work, 
but you can use it to test the interface and get a sense of how the script works before deploying it in your Dataverse instance. 
To use the static example, just open the HTML file in a browser. You can type in a location name and see the GeoNames results in the dropdown menu.