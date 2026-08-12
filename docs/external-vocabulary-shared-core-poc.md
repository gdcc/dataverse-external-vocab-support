# External Vocabulary Shared React POC Notes

This proof of concept provides shared ORCID/ROR behavior and a shared React picker for
the Dataverse Modern UI and legacy JSF UI. The SPA and JSF use the same
`ExternalVocabularyPicker` component through separate adapters that synchronize their
host form state.

## New Files

| Location | Purpose |
| --- | --- |
| `packages/external-vocabulary-core/external-vocabulary-core.js` | Browser-loadable shared core. It normalizes ORCID/ROR terms and maps selected terms to Dataverse managed fields. It exposes `DataverseExternalVocabularyCore` in the browser. |
| `packages/external-vocabulary-core/external-vocabulary-core.mjs` | ESM entry point for Modern UI builds. |
| `packages/external-vocabulary-core/external-vocabulary-core.d.ts` | TypeScript declarations for the shared core. |
| `packages/external-vocabulary-core/external-vocabulary-core.test.js` | Shared-core unit tests. |
| `packages/external-vocabulary-core/package.json` | Package metadata for `@iqss/dataverse-external-vocabulary-core`. |
| `packages/external-vocabulary-core/README.md` | Shared-core package documentation. |
| `packages/external-vocabulary-react/src/ExternalVocabularyPicker.tsx` | Reusable React picker. It renders the Person/Organization selector, search input, result list, and loading, no-results, and error states. Both SPA and JSF use this component. |
| `packages/external-vocabulary-react/src/jsf-browser-entry.tsx` | JSF bundle entry point. It mounts the shared picker with `ReactDOM.createRoot()`. |
| `packages/external-vocabulary-react/package.json` | Package metadata for `@iqss/dataverse-external-vocabulary-react`. |
| `scripts/build-react-picker.js` | Uses esbuild to create the browser bundle that JSF loads. |
| `services/jsf-adapter/jsf-external-vocabulary-adapter.js` | JSF adapter. It reads Dataverse `data-cvoc-*` attributes, mounts the React bundle, and writes selected values back to original JSF fields. It searches through the Dataverse API, so browsers do not call ROR directly. |
| `services/jsf-adapter/configs/authorsOrcidAndRorSharedCore.json` | Example `CVocConf` for the Author ORCID/ROR JSF proof of concept. |
| `services/jsf-adapter/README.md` | JSF adapter documentation. |

## Modified Existing Files

| Location | Purpose |
| --- | --- |
| `package.json` / `package-lock.json` | Build dependencies for React, ReactDOM, esbuild, and React TypeScript declarations. |
| `scripts/deploy.js` | `node scripts/deploy.js link` links the shared core into `dist/js/` and builds the JSF React bundle. |
| `.gitignore` | Ignores generated `dist/` and `node_modules/` directories. |

## Existing Services Left Unchanged

The POC does not modify existing GDCC provider scripts, including:

- `services/ror/ror.js`
- Existing ORCID and person-or-org services
- `services/skosmos/`, `services/geonames/`, and `services/ontoportal/`

`dist/js/ror.js` is a generated symlink to `services/ror/ror.js`; it is not a POC
source change. The current JSF POC loads only the shared core, shared React bundle,
and JSF adapter.

## Local Use

Install the build dependencies once:

```sh
npm install
```

Build and link the local assets:

```sh
node scripts/deploy.js link
```

Local nginx exposes `dist/` at `/cvoc/`. JSF `CVocConf` must load these files in the
following order:

```text
/cvoc/js/external-vocabulary-core.js
/cvoc/js/external-vocabulary-react.js
/cvoc/js/jsf-external-vocabulary-adapter.js
```

The order matters: the JSF adapter depends on both the shared core and the generated
React bundle.

## Adapter Boundaries

- The SPA adapter connects the shared picker to React Hook Form, the Modern UI
  repository, and Dataverse managed fields.
- The JSF adapter mounts the same component with `ReactDOM.createRoot()` and
  synchronizes values with original JSF fields.

Provider search, field configuration, and host-form synchronization remain adapter
responsibilities. The picker only owns reusable input, selection, results, and state
UI.

## Remaining Work

Before production adoption, add integration coverage for repeatable Author rows, JSF
partial updates, editing existing values, validation, free-text fallback, keyboard
navigation, and screen-reader behavior. Publish versioned packages and the browser
bundle through an agreed release process instead of relying on local `file:`
dependencies.
