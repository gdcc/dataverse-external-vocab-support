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
  
  for (let i = 0; i < fields.length; i++) {
    const projectField = $(fields[i]);
    if (projectField.hasClass("expanded")) {
      return
    }
    projectField.addClass("expanded")
    const fullUrl = projectField.text()
    const serviceUrl = projectField.attr("data-cvoc-service-url")
    
    //Dataverse-specific, temporary - see below
    aboveFoldServiceUrl = serviceUrl
    
    const project = await cvoc_lc_LoadOrFetch(fullUrl, serviceUrl)
    let lcContainerElement = cvoc_lc_buildLCProjectPopup(project)
    if (!$.isEmptyObject(lcContainerElement)) {
      projectField.html(lcContainerElement)
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
  const aboveFold = $('#LCProjectUrl')
  if (aboveFold.length === 1) {
    const td = aboveFold.children('td')
    if (!td.hasClass('expanded')) {
      var url = td.children('a').text()
      console.log('Found: ' + url)
      td.addClass('expanded')
      const project = await cvoc_lc_LoadOrFetch(url, aboveFoldServiceUrl)
      //console.log(JSON.stringify(project));
      let lcContainerElement = cvoc_lc_buildLCProjectPopup(project)
      //console.log(lcContainerElement);
      if (!$.isEmptyObject(lcContainerElement)) {
        td.html(lcContainerElement)
      }
    }
  }
}

async function cvoc_lc_editProject() {
  var projectInputs = $(cvoc_lc_projectInputSelector)
  for (let i = 0; i < projectInputs.length; i++) {
    const projectInput = $(projectInputs[i])
    projectInput.hide()
    const serviceUrl = projectInput.attr('data-cvoc-service-url')
    let select_ = document.createElement("select")
    select_.id = "localcontextsProjectInputSelector"
    select_.classList = "form-control add-resource select2"
    select_.setAttribute("aria-hidden", true)
    select_.setAttribute("tabindex", -1)
    projectInput.after(select_)
    let placeholder = ""
    if (projectInput[0].value !== "") {
      const project = await cvoc_lc_LoadOrFetch(projectInput[0].value)
      // console.log(project)
      placeholder = project.title
    } else {
      placeholder = "Search for a project by name or paste the exact project ID"
    }
    // todo we have: projectInput.value
    $(select_).select2({
      placeholder: placeholder,
      minimumInputLength: cvoc_lc_seach_minimumInputLength,
      ajax: { // instead of writing the function to execute the request we use Select2's convenient helper
        url: (params) => {
          // check if the user posted a uuid (lc project id) and
          const uuid_regex = new RegExp("([a-f 0-9]{8})-([a-f 0-9]{4})-([a-f 0-9]{4})-([a-f 0-9]{4})-([a-f 0-9]{12})")
          if (uuid_regex.test(params.term)) {
            //await get_or_fetch(params.term)
            return `${serviceUrl}api/v1/projects/${params.term}`
          } else {
            return `${serviceUrl}api/v1/projects/?search=${params.term}`
          }
        },
        data: {},
        dataType: 'json',
        delay: cvoc_lc_search_delay,
        processResults: function(data, page) { // parse the results into the format expected by Select2.
          // console.log("processResults", data)
          // check if we did the search by uuid
          if (data.results === undefined && data.unique_id !== undefined) {
            return {
              results: [{ id: data.unique_id, text: data.title }]
            }
          }
          // normal search results
          return {
            results: data.results.map(e => ({
              id: e.unique_id, text: e.title
            }))
          }
        },
        cache: true
      }
    })


    $(select_).on('select2:select', function(e) {
      // console.log("select...")
      let data = e.params.data
      // console.log(data)
      projectInput.val(`${serviceUrl}projects/${data.id}`)
      cvoc_lc_LoadOrFetch(data.id)
    })
  }
}

function cvoc_lc_buildLCProjectPopup(project) {
  if ($.isEmptyObject(project)) {
    //Could report the error - e.g. No project with this URL found at serviceUrl - rather than just not changing the display

    return ''
  }
  const createItemImage = (notice_label) => {
    return `<div style="flex;flex-direction: column;text-align: center; max-width: 175px">
                    <div style="margin: 12px;">
                        <img loading="lazy" width="119px" src="${notice_label.img_url}" alt="">
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

async function cvoc_lc_LoadOrFetch(fullUrl, serviceUrl) {
  let lc_uuid = fullUrl;
  const baseUrl = `${serviceUrl}projects/`
  const retrievalUrl = `${serviceUrl}api/v1/projects/`
  if (lc_uuid.startsWith(baseUrl)) {
    lc_uuid = lc_uuid.substring(baseUrl.length)
  }
  const inStorage = sessionStorage.getItem(lc_uuid)
  if (inStorage) {
    return Promise.resolve(JSON.parse(inStorage))
  }
  const response = await fetch(`${retrievalUrl}${lc_uuid}`)
  if (!response.ok) {
    return {}
  }
  const project = await response.json()
  sessionStorage.setItem(lc_uuid, JSON.stringify(project))
  return Promise.resolve(project)
}
