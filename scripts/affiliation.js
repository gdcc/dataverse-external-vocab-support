/************************************************************************************************************
 * This JavaScript is responsible for the controlled vocabulary features in the browser.                    *
 * The search button opens a dialog in which the controlled vocabulary server can be queried.               *
 * On each result line, a button allows to copy-and-paste the information automatically in the form fields. *
 * ******************************************************************************************************** *
 * Author: Kris Dekeyser @ KU Leuven (2022). MIT License                                                    *
 ************************************************************************************************************/

/* DOM Element Identfiers
 * **********************
 * affiliation-modal: the modal for the dialog box
 * affiliation-modal-title: the dialog box title
 * affiliation-search-box: field in the dialog where search term can be entered
 * affiliation-search-results: location where the query results will be displayed
 * DOM Classes
 * ***********
 * search_added: class added when a search button has already been added
 */

var affiliationModalId ='affiliation-modal';
var affiliationSearchBoxId = 'affiliation-search-box';
var affiliationSearchResultsID = 'affiliation-search-results';
var elementIdAttribute = 'data-affiliation-element-id';

/* The browser will run this code the first time the editor is opened and each time a multiple field instance is 
 * added or removed. This code is reposible for creating the HTML for the dialog box, adding a search button to 
 * the affiliation name fields and creating the triggers for initializing the dialog box and the search action itself.
 */
(function() {
  // Create Dialog box, if necessary
  createAffiliationModal();

  // Put a search button after each affiliation name field
  putAffiliationSearchIcon();
})();

function createAffiliationModal() {
  let affiliationModal = document.getElementById(affiliationModalId);
  if (!affiliationModal) {
    // Create modal dialog
    document.body.innerHTML +=
      '<div id="' + affiliationModalId + '" class="modal fade in" tabindex="-1" aria-labelledby="' + affiliationModalId + '-title" role="dialog" style="margin-top: 5rem">' + 
        '<div class="modal-dialog" role="document">' + 
          '<div class="modal-content">' + 
            '<div class="modal-header">' + 
              '<button class="close" type="button" data-dismiss="modal" aria-label="close"><span aria-label="Close">X</span></button>' + 
              '<h5 id="' + affiliationModalId + '-title" class="modal-title">Search for organization in ROR</h5>' + 
            '</div>' + 
            '<div class="modal-body">' + 
              '<div style="display: flex;">' + 
                '<input id="' + affiliationSearchBoxId + '" class="form-control" accesskey="s" type="text" placeholder="Search for organization name ...">' + 
                '<span class="glyphicon glyphicon-question-sign tooltip-icon" data-toggle="tooltip" data-placement="auto right" data-original-title="Type text and hit the Enter key to search." style="margin-left: 5px;"></span>' +
              '</div>' +
              '<div style="overflow-y: auto; height: 20em;">' + 
                '<table id="' + affiliationSearchResultsID + '" class="table table-striped table-hover table-condensed"><tbody/></table>' + 
              '</div>' +
            '</div>' + 
          '</div>' + 
        '</div>' + 
      '</div>';

    // Before modal is opened, pull in the current value of the affiliation input field into the search box and launch a query for that value
    $('#' + affiliationModalId).on('show.bs.modal', function(e) {
      // Get the stored ID of the input field
      let inputID = e.relatedTarget.getAttribute(elementIdAttribute);
      let affiliationElement = document.getElementById(inputID);
      // Fill in the input field text in the searchBox ...
      let affiliationSearchBox = document.getElementById(affiliationSearchBoxId);
      affiliationSearchBox.value = affiliationElement.value;
      // ... and launch a query
      affiliationsQuery(affiliationElement.value);
      // Let the searchBox know where to write the data
      affiliationSearchBox.setAttribute(elementIdAttribute, inputID);
    });

    // After model is opened, set focus on search box
    $('#' + affiliationModalId).on('shown.bs.modal', function(e) {
      // autofocus does not work with BS modal
      let affiliationSearchBox = document.getElementById(affiliationSearchBoxId);
      affiliationSearchBox.focus();
      affiliationSearchBox.select();
    });

    // To minimize the load on the lookup service, we opted for an explicit enter to launch a query
    document.getElementById(affiliationSearchBoxId).addEventListener('keyup', function(e) {
      // Only if Enter key is pressed
      if (e.key === 'Enter') {
        // Get string from searchBox ...
        let str = this.value;
        // ... and launch query ...
        affiliationsQuery(this.value);
        // .. and prevent key to be added to the searchBox
        e.preventDefault();
      }
    });
  }
}

// Lauches a query to the external vocabulary server and fills in the results in the table element of the dialog searchBox

/* arguments:
 *  - str (String): text to search for
 */

function affiliationsQuery(str) {
  // Vocabulary search REST call
  fetch("https://api.ror.org/organizations?query=" + str)
  .then(response => response.json())
  .then(data => {
    let table = document.querySelector('#' + affiliationSearchResultsID + ' tbody');
    // Clear table content
    table.innerHTML = ''
    // Get ID of target input element
    let id = document.getElementById(affiliationSearchBoxId).getAttribute(elementIdAttribute);
    // Iterate over results
    data.items.forEach((doc) => {
      let label = doc.labels.length > 0 ? doc.labels[0].label : '';
      let address = ( doc.addresses.length > 0 ? doc.addresses[0].city : '' ) + ', ' + doc.country.country_name;
      // Add a table row for the doc
      table.innerHTML += 
      '<tr title="' + label + '">' +
        '<td><a href="' + doc.id + '" target="_blank">' + doc.name + '</a></td>' +
        '<td>' + address + '</td>' +
        '<td>' + 
          '<span ' + 
            'class="btn btn-default btn-xs glyphicon glyphicon-import pull-right" title="import" ' + 
            'onclick="importAffiliationData(\'' + id + '\', \'' + doc.name + '\');">' + 
          '</span>' + 
        '</td>' + 
      '</tr>';
    });
  });
}

// Selector for all the author compound fields
var authorSelector = "div[role='group'][aria-labelledby='metadata_author'] div.edit-compound-field";

// Adds a search button to all the affiliation input fields
function putAffiliationSearchIcon() {
  // Iterate over compound elements
  document.querySelectorAll(authorSelector).forEach(element => {
    // 'search_added' class marks elements that have already been processed
    if (!element.classList.contains('search_added')) {
      element.classList.add('search_added');
      // Second child is element that encapsulates label and input of affiliation
      let affiliationField = element.children[1];
      // Input field within
      let affiliationInput = affiliationField.querySelector('input');
      // We create an bootstrap input group ...
      let wrapper = document.createElement('div');
      wrapper.className = 'input-group';
      wrapper.style.display = 'flex';
      // ... containing the input field ...
      wrapper.appendChild(affiliationField.querySelector('input'));
      // ... and a new seach button ...
      let searchButton = document.createElement('button');
      element.setAttribute('aria-describedby', searchButton.id);
      searchButton.className = 'btn btn-default btn-sm bootstrap-button-tooltip compound-field-btn';
      searchButton.setAttribute('type', 'button');
      searchButton.setAttribute('title', 'Search in ROR');
      searchButton.setAttribute('data-toggle', 'modal');
      searchButton.setAttribute('data-target', '#' + affiliationModalId);
      searchButton.setAttribute(elementIdAttribute, affiliationInput.id);
      let searchIcon = document.createElement('span');
      searchIcon.className = 'glyphicon glyphicon-search no-text';
      searchButton.appendChild(searchIcon);
      wrapper.appendChild(searchButton);
      // ... and add that to the encapsulating element.
      affiliationField.appendChild(wrapper);
    }
  })
}

// Import the query result data into the metadata form
// arguments:
// - id (String): identifier of the affiliationName input field
// - affiliation: affiliation name
function importAffiliationData(id, affiliation) {
  // Get the affiliation input field
  let affiliationElement = document.getElementById(id);
  // Fill-in affiliation
  affiliationElement.value = affiliation;
  // Close the dialog box when the import is done
  $('#' + affiliationModalId).modal('hide');
}
