/************************************************************************************************************
 * This JavaScript is responsible for the controlled vocabulary features in the browser.                    *
 * The search button opens a dialog in which the controlled vocabulary server can be queried.               *
 * On each result line, a button allows to copy-and-paste the information automatically in the form fields. *
 * ******************************************************************************************************** *
 * Author: Kris Dekeyser @ KU Leuven (2022). MIT License                                                    *
 ************************************************************************************************************/

/* DOM Element Identfiers
 * **********************
 * author-modal: the modal for the dialog box
 * author-modal-title: the dialog box title
 * author-search-box: field in the dialog where search term can be entered
 * author-search-results: location where the query results will be displayed
 * DOM Classes
 * ***********
* search_added: class added when a search button has already been added
 */

// Selector for all the author compound fields
var authorSelector = "div[role='group'][aria-labelledby='metadata_author'] div.edit-compound-field";

/* The browser will run this code the first time the editor is opened and each time a multiple field instance is 
 * added or removed. This code is reposible for creating the HTML for the dialog box, adding a search button to 
 * the author name fields and creating the triggers for initializing the dialog box and the search action itself.
 */
$(document).ready(function() {
  let authorModal = document.getElementById('author-modal');
  if (!authorModal) {
    // Create modal dialog
    document.body.innerHTML +=
      '<div id="author-modal" class="modal fade in" tabindex="-1" aria-labelledby="author-modal-title" role="dialog">' + 
        '<div class="modal-dialog" role="document">' + 
          '<div class="modal-content">' + 
            '<div class="modal-header">' + 
              '<button class="close" type="button" data-dismiss="modal" aria-label="close"><span aria-label="Close">X</span></button>' + 
              '<h5 id="author-modal-title" class="modal-title">Search for Author</h5>' + 
            '</div>' + 
            '<div class="modal-body">' + 
              '<input id="author-search-box" class="form-control" accesskey="s" type="text">' + 
              '</div>' +
              '<table id="author-search-results" class="table"><tbody/></table>' + 
            '</div>' + 
          '</div>' + 
        '</div>' + 
      '</div>';

    // Before modal is opened, pull in the current value of the authorName input field into the search box and launch a query for that value
    $('#author-modal').on('show.bs.modal', function(e) {
      // Get the stored ID of the input field
      let inputID = e.relatedTarget.getAttribute('data-covoc-element-id');
      // Let the searchBox know where to write the data
      authorSearchBox.setAttribute('data-covoc-element-id', inputID);
    });

    // To minimize the load on the lookup service, we opted for an explicit enter to launch a query
    document.getElementById('author-search-box').addEventListener('keyup', function(e) {
      // Only if Enter key is pressed
      if (e.key === 'Enter') {
        // Get string from searchBox ...
        let str = this.value;
        // ... and launch query ...
        authorsQuery(this.value);
        // .. and prevent key to be added to the searchBox
        e.preventDefault();
      }
    });
  }

  // Put a search button after each author name field
  // Iterate over compund elements
  document.querySelectorAll(authorSelector).forEach(element => {
    // 'search_added' class marks elements that have already been processed
    if (!element.classList.contains('search_added')) {
      element.classList.add('search_added');
      // First child is element that encapsulates label and input of author name
      let authorNameField = element.children[0];
      // Input field within
      let authorNameInput = authorNameField.querySelector('input');
      // We create a bootstrap input group ...
      let wrapper = document.createElement('div');
      wrapper.className = 'input-group';
      // ... with search button ...
      wrapper.innerHTML = 
        '<button class="btn btn-default btn-sm bootstrap-button-tooltip compound-field-btn" type="button" title="Search for author" ' +
          'data-toggle="modal" data-target="#author-"modal" data-covoc-element-id="' + authorNameInput.id + '">' +
          '<span class="glyphicon glyphicon-search no-text"></span>'
        '</button>';
      // ... and the input field ...
      wrapper.prependChild(authorNameField.querySelector('input'));
      // ... and add that to the encapsulating element.
      authorNameField.appendChild(wrapper);
    }
  })
});

var page_size = 10; // Number of results that will be displayed on a single page

// Lauches a query to the external vocabulary server and fills in the results in the table element of the dialog searchBox

/* arguments:
 *  - str (String): text to search for
 */

function authorsQuery(str) {
  if (!start) {
    start = 0;
  }
  // Vocabulary search REST call
  fetch("/covoc/authors?q=" + str + '&from=' + start + '&per_page=' + page_size)
  .then(response => response.json())
  .then(data => {
    let table = document.querySelector('#author-search-results tbody');
    // Clear table content
    table.innerHTML = ''
    // Iterate over results
    data.docs.forEach((doc) => {
      // Get ID of target input element
      let id = document.getElementById('author-search-box').getAttribute('data-covoc-element-id');
      // Add a table row for the doc
      table.innerHTML += 
      '<tr title="' + doc.eMail + '">' +
        '<td>' + doc.fullName + '</td>' +
        '<td>' + 
          ((doc.orcid) ? '<a href="https://orcid.org/' + doc.orcid + '" target="_blank">' + doc.orcid + '</a>' : '') + 
        '</td>' + 
        '<td>' + 
          '<span ' + 
            'class="btn btn-default btn-xs glyphicon glyphicon-import pull-right" title="import" ' + 
            'onclick="importAuthorData(\'' + id + '\', \'' + doc.fullName + '\', \'' + doc.affiliation + '\', \'' + (doc.orcid || '') + '\');">' + 
          '</span>' + 
        '</td>' + 
      '</tr>';
    });
  });
}

// Import the query result data into the metadata form
// arguments:
// - id (String): identifier of the authorName input field
// - fullName, affiliation and orcid (String): author data
function importAuthorData(id, fullName, affiliation, orcid) {
  // Get the author name input field
  let authorName = document.getElementById(id);
  // Up to the compound element
  let authorElement = authorName.closest('.search_added');
  // 2nd child contains the input field for author affiliation
  let authorAffiliation = authorElement.children[1].querySelector('input');
  // 3rd child is the identifier scheme wrapper and contains multiple elements:
  // - a label element that shows the current selected value
  let authorIdentifierSchemeText = authorElement.children[2].querySelector('.ui-selectonemenu-label');
  // - a select element that contains the drop-down
  let authorIdentifierSchemeSelect = authorElement.children[2].querySelector('select');
  // 4th child contains the input element for the identifier
  let authorIdentifier = authorElement.children[3].querySelector('input');
  // Fill-in name, affiliation and orcid identifier
  authorName.value = fullName;
  authorAffiliation.value = affiliation;
  if (orcid) {
    authorIdentifier.value = orcid;
    // Setting the dropdown box is trickier:
    // First get the option from the select list whose text content matches the value you want to set
    let option = Array.from(authorIdentifierSchemeSelect.querySelectorAll('option')).find(el => el.text === 'ORCID');
    // Then get the value from that option and set the select element's value with it
    authorIdentifierSchemeSelect.value = option.getAttribute('value');
    // But you should also set the label field or your selection will not display
    authorIdentifierSchemeText.textContent = 'ORCID';
  } else {
    // clear the orcid input box and dropdown box
    authorIdentifier.value = '';
    // Default text is in the first option
    authorIdentifierSchemeText.textContent = authorIdentifierSchemeSelect.children[0].text;
    authorIdentifierSchemeSelect.value = '';
  }
  // Close the dialog box when the import is done
  $('#author-modal').modal('hide');
}
