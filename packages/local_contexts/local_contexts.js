var cvoc_lc_projectSelector = "span[data-cvoc-protocol='localcontexts']";
var cvoc_lc_projectInputSelector = "input[data-cvoc-protocol='localcontexts']";

var cvoc_lc_lcBaseUrl = "https://localcontextshub.org";

var cvoc_lc_seach_minimumInputLength = 4;
var cvoc_lc_search_delay = 1000;

// if (typeof initFunction !== "function") {
//     function initFunction() {
//         console.log("doc ready")
//         cvoc_lc_viewProject();
//         cvoc_lc_editProject();
//     }
//
//     $(document).ready(initFunction);
// }

$(document).ready(() => {
    // console.log("doc ready")
    cvoc_lc_viewProject();
    cvoc_lc_editProject();
});

function cvoc_lc_buildLCProjectPopup(project) {

    const createItemImage = (notice_label) => {
        return `<div style="flex;flex-direction: column;text-align: center; max-width: 175px">
                    <div style="margin: 12px;">
                        <img loading="lazy" width="119px" src="${notice_label.img_url}" alt="">
                        <p style="margin-top:8px; font-size: 14px">${notice_label.name}</p>
                    </div>
                </div>`
    }

    // console.log(project)
    const notices = project.notice || []
    const labels = (project.tk_labels || []).concat(project.bc_labels || [])
    const lcWrapper = `<div style="max-width: 700px; margin-top: 10px;
                border: 0.5px solid darkgray;border-radius: 2rem; background: white">
        <div  style="padding: 12px;padding-bottom: 0; width: 100&; display: flex; flex-wrap: wrap; justify-content: flex-start">
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

async function cvoc_lc_LoadOrFetch(fullUrl) {
    const lc_project_url_base = `${cvoc_lc_lcBaseUrl}/projects/`
    let lc_uuid = fullUrl;
    if (lc_uuid.startsWith(lc_project_url_base)) {
        lc_uuid = lc_uuid.substring(lc_project_url_base.length);
    }
    const inStorage = sessionStorage.getItem(lc_uuid)
    if (inStorage) {
        return Promise.resolve(JSON.parse(inStorage))
    }
    const response = await fetch(`${cvoc_lc_lcBaseUrl}/api/v1/projects/${lc_uuid}`)
    const project = await response.json()
    sessionStorage.setItem(lc_uuid, JSON.stringify(project));
    return Promise.resolve(project)
}

async function cvoc_lc_viewProject() {
    // console.log("cvoc_lc_viewProject")
    const jqSelect = $(cvoc_lc_projectSelector);
    if (jqSelect.length === 0)
        return
    const projectField = jqSelect[0];
    const fullUrl = projectField.textContent
    // this hack needs to be done, when ready is executed twice. it prevents adding the LC container twice
    // console.log(projectField.parentNode.children.length)
    setTimeout(async () => {
        if (projectField.parentNode.children.length === 1) {
            const project = await cvoc_lc_LoadOrFetch(fullUrl);
            let lcContainerElement = cvoc_lc_buildLCProjectPopup(project)
            projectField.after(lcContainerElement);
        }
    }, Math.random() * 1000)

    projectField.innerHTML = `<a href='${fullUrl}' target='_blank' rel='noopener' >${fullUrl}</a>`;
}

async function cvoc_lc_editProject() {
    var projectInput = $(cvoc_lc_projectInputSelector)
    if (projectInput.length === 0)
        return
    projectInput.hide()
    let select_ = document.createElement("select")
    select_.id = "localcontextsProjectInputSelector"
    select_.classList = "form-control add-resource select2"
    select_.setAttribute("aria-hidden", true)
    select_.setAttribute("tabindex", -1)
    // console.log("PI", projectInput, projectInput[0].value)
    projectInput.after(select_)
    let placeholder = ""
    if(projectInput[0].value !== "") {
        const project = await cvoc_lc_LoadOrFetch(projectInput[0].value);
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
                    return `${cvoc_lc_lcBaseUrl}/api/v1/projects/${params.term}`
                } else {
                    return `${cvoc_lc_lcBaseUrl}/api/v1/projects/?search=${params.term}`
                }
            },
            data: {},
            dataType: 'json',
            delay: cvoc_lc_search_delay,
            processResults: function (data, page) { // parse the results into the format expected by Select2.
                // console.log("processResults", data)
                // check if we did the search by uuid
                if (data.results === undefined && data.unique_id !== undefined) {
                    return {
                        results: [{id: data.unique_id, text: data.title}]
                    }
                }
                // normal search results
                return {
                    results: data.results.map(e => ({
                        id: e.unique_id, text: e.title
                    }))
                };
            },
            cache: true
        }
    });

    $(select_).on('select2:select', function (e) {
        // console.log("select...")
        let data = e.params.data;
        // console.log(data)
        projectInput.val(`${cvoc_lc_lcBaseUrl}/projects/${data.id}`);
        cvoc_lc_LoadOrFetch(data.id);
        // if (data.id != data.text) {
        //     projectInput.val(`${lcBaseUrl}/projects/${data.id}`);
        //     get_or_fetch(data.id);
        // } else {
        //     projectInput.val(data.id);
        // }
    });
}

