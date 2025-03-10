var cvoc_lc_projectSelector = "span[data-cvoc-protocol='localcontexts']"
var cvoc_lc_projectInputSelector = "input[data-cvoc-protocol='localcontexts']"

var cvoc_lc_seach_minimumInputLength = 4
var cvoc_lc_search_delay = 500

$(document).ready(() => {
  // console.log("doc ready")
  cvoc_lc_viewProject()
  cvoc_lc_editProject()
})

async function cvoc_lc_viewProject() {
  //console.log("cvoc_lc_viewProject")
  var fields = $(cvoc_lc_projectSelector)

  //Dataverse-specific, temporary - see below
  var aboveFoldServiceUrl

  // This script is intended to work with only one single-valued metadata field, but the result can appear in more than one place (e.g. facet, advanced search), so this needs to be a loop
  // Further work may be needed to, for example, not show notice/label icons in these other areas

  const urlParams = new URLSearchParams(window.location.search);
  const persistentId = urlParams.get('persistentId');
  
  for (let i = 0; i < fields.length; i++) {
    const projectField = $(fields[i]);
    if (!projectField.hasClass("expanded")) {
      projectField.addClass("expanded")
      // Get the persistentId from the URL query parameter

      // Only proceed if persistentId is non-empty
      if (persistentId) {
        const fullUrl = projectField.text()
        const serviceUrl = projectField.attr("data-cvoc-service-url") + "api/localcontexts/datasets/:persistentId"
        const project = await cvoc_lc_LoadOrFetch(fullUrl, serviceUrl, persistentId)
        let lcContainerElement = cvoc_lc_buildLCProjectPopup(project)
        if (!$.isEmptyObject(lcContainerElement)) {
          projectField.html(lcContainerElement)
        } else {
          projectField.html(`<span style="margin:0px 5px 0px 5px">Project Not Found:</span><a href="${fullUrl}" target="_blank" rel="noopener">${fullUrl}</a>`)
        }
        //Dataverse-specific, temporary - see below
        aboveFoldServiceUrl = projectField.attr("data-cvoc-service-url")  + "api/localcontexts/datasets/:persistentId"
      }
    }
  }
  // Temporary - Dataverse doesn't currently support managing a field 'above the fold' on the dataset page
  // To make this script work for the LCProjectUrl field in the LocalContextsCVoc metadatablock when the
  // :CustomDatasetSummaryFields setting includes it, the following section looks for the above-fold field
  // using a Dataverse-specific mechanism. This mechanism also assumes that only one field is using this
  // script/that all use the same data-cvoc-service-url. The aboveFoldServiceUrl variable is set to that value
  // (since the field found here does not include data-cvoc-* attributes at all)
  //
  // If/when Dataverse is enhanced to annotate this above-fold field appropriately, this section won't be needed.
  //
  if (persistentId) {
    const aboveFold = $('#LCProjectUrl')
    if ((aboveFold.length === 1) && aboveFoldServiceUrl) {
      const td = aboveFold.children('td')
      if (!td.hasClass('expanded')) {
        var url = td.children('a').text()
        td.addClass('expanded')
        const project = await cvoc_lc_LoadOrFetch(url, aboveFoldServiceUrl, persistentId)
        let lcContainerElement = cvoc_lc_buildLCProjectPopup(project, 60)
        if (!$.isEmptyObject(lcContainerElement)) {
          td.html(lcContainerElement)
        } else {
          td.html(`<span style="margin:0px 5px 0px 5px">Project Not Found:</span><a href="${url}" target="_blank" rel="noopener">${url}</a>`)
        }
      }
    }
  }
}

async function cvoc_lc_editProject() {
  var projectInputs = $(cvoc_lc_projectInputSelector);
  const persistentId = new URLSearchParams(window.location.search).get('persistentId');
  // This script is intended to work with one single valued metadata field on the page,
  // but an input can appear in other places than metadata edit (e.g. advanced search)
  // In the current UI, I don't think both of these fields are ever displayed together,
  // but to be safe in that case, this uses a loop

  // This is a for loop instead of projectInputs.each() because async functions are called (not allowed with .each)
  for (let i = 0; i < projectInputs.length; i++) {
    const projectInput = $(projectInputs[i]);
    if (!projectInput.attr('data-lc')) {
      const serviceUrl = `${projectInput.attr("data-cvoc-service-url")}api/localcontexts/datasets/:persistentId`;
      const num = Math.floor(Math.random() * 100000000000);
      projectInput.attr('data-lc', num);
      projectInput.hide();

      const displayId = "LCDisplay_" + num;
      projectInput.after(`<div id="${displayId}"></div>`);

      const displayElement = $(`#${displayId}`);

      if (projectInput.val()) {
        // If projectInput has a value, display it and add an unlink button
        const project = await cvoc_lc_LoadOrFetch(projectInput.val(), serviceUrl);
        displayElement.html(cvoc_lc_buildLCProjectPopup(project, 60));
        displayElement.append(`
        <button class="btn btn-default" onclick="cvoc_lc_unlinkProject('${num}')">Unlink</button>
      `);
      } else {
        // If projectInput doesn't have a value, search using the persistentId
        const response = await fetch(`${serviceUrl}?persistentId=${persistentId}`);
        const responseJson = await response.json();
        const data = responseJson.data

        if (data.count === 1) {
          const fullUrl = data.results[0].project_page
          const project = await cvoc_lc_LoadOrFetch(fullUrl, serviceUrl, persistentId)
          // If one project is found, display it with an 'Add Link' button
          displayElement.html(cvoc_lc_buildLCProjectPopup(project, 60));
          displayElement.append(`
          <button class="btn btn-default" onclick="cvoc_lc_linkProject('${num}', '${project.project_page}')">Add Link</button>
        `);
        } else if (data.count === 0) {
          // If no project is found, display the message
          displayElement.html(`
          <p>No LocalContext project found. To create a link with a Dataverse dataset, you must create a project on the 
          <a href="${JSON.parse(projectInput.attr('data-cvoc-vocabs')).localcontexts.uriSpace}" target="_blank">Local Contexts Hub</a> and add the data's PID as publication_DOI.</p>
        `);
        }
      }
    }
  }
}

function cvoc_lc_unlinkProject(num) {
  const currentProject = $(`input[data-lc='${num}']`).val()
  $(`input[data-lc='${num}']`).val('').attr('value', '')
  const displayElement = $(`#LCDisplay_${num}`)
  // Remove the unlink button
  displayElement.find('button').remove()

  // Add the 'Add Link' button
  displayElement.append(`
    <button class="btn btn-default" onclick="cvoc_lc_linkProject('${num}', '${currentProject}')">Add Link</button>
  `)
}

async function cvoc_lc_linkProject(num, projectUrl) {
  const displayElement = $(`#LCDisplay_${num}`)
  const projectInput = $(`input[data-lc='${num}']`);
  projectInput.val(projectUrl).attr('value', projectUrl);
  // Remove the unlink button
  displayElement.find('button').remove()

  // Add the 'Add Link' button
  displayElement.append(  `
      <button class="btn btn-default" onclick="cvoc_lc_unlinkProject('${num}')">Unlink</button>
    `)
}

function cvoc_lc_buildLCProjectPopup(project, width = 120) {
  if ($.isEmptyObject(project)) {
    //Could report the error - e.g. No project with this URL found at serviceUrl - rather than just not changing the display

    return ''
  }
  const maxDivWidth = width + 40
  const createItemImage = (notice_label) => {
    return `<div style="flex;flex-direction: column;text-align: center; max-width: ${maxDivWidth}px">
                    <div style="margin: 12px;">
                        <img loading="lazy" width="${width}px" src="${notice_label.img_url}" alt="">
                        <p style="margin-top:8px; font-size: 14px">${notice_label.name}</p>
                    </div>
                </div>`
  }

  const notices = project.notice || []
  const labels = (project.tk_labels || []).concat(project.bc_labels || [])
  const lcWrapper = `<div style="max-width: 700px; margin-top: 10px;
                border: 0.5px solid darkgray;border-radius: 2rem; background: white">
        <div  style="padding: 12px;padding-bottom: 0; width: 100%; display: flex; flex-wrap: wrap; justify-content: flex-start">
        ${notices.map(createItemImage).join("")}
        ${labels.map(createItemImage).join("")}
        </div>
        <div style="padding: 12px; padding-top: 0; display: flex; flex-wrap: wrap; justify-content: flex-start; width: 100&">
            <div style="display: inherit; margin: 0 8px">
                <a href="https://localcontexts.org" target="_blank" style="display: inline-flex;">
                    <img style="width:30px;" src="https://localcontexts.org/wp-content/uploads/2023/04/White-Background.png" alt="Local Contexts Icon">
                </a>
            </div>
            <div style="align-items: center;display: flex;margin-right: 8px;font-size: 14px;">
                <a id="project-link" style="font-weight: bold; color: #007585; cursor: pointer; font-size: 14px; text-decoration: underline;" href="${project.project_page}" target="_blank" rel="noopener noreferrer">${project.title}</a>
            </div>
        </div>
        </div>`

  const e = document.createElement("div")
  e.innerHTML = lcWrapper
  return e
}

async function cvoc_lc_LoadOrFetch(fullUrl, serviceUrl, persistentId) {
  let lc_uuid = fullUrl;
  const retrievalUrl = `${serviceUrl}/`
  // Strip any instance of "projects/" and any characters before it
    lc_uuid = lc_uuid.replace(/^.*projects\//, '');
  
  const inStorage = sessionStorage.getItem(lc_uuid)
  if (inStorage) {
    return Promise.resolve(JSON.parse(inStorage))
  }
  const response = await fetch(`${retrievalUrl}${lc_uuid}/?persistentId=${persistentId}`)
  if (!response.ok) {
    return {}
  }
  const project = await response.json()
  const data = project.data
  sessionStorage.setItem(lc_uuid, JSON.stringify(data))
  return data
}
