# Shared React JSF Adapter

`jsf-external-vocabulary-adapter.js` is a thin legacy adapter for the shared React
picker. It mounts only on JSF inputs marked with
`data-cvoc-adapter="shared-react-jsf"`.

The adapter reads JSF `data-cvoc-*` configuration, creates an empty mount node, and
calls `DataverseExternalVocabularyReact.mount()`. The React component owns the picker
subtree. The adapter writes selected values to the original JSF inputs, dispatches
`input` and `change` events, and observes AJAX-added repeatable fields.

Run `npm install` once, then run `node scripts/deploy.js link` to build
`dist/js/external-vocabulary-react.js` and link the adapter/core scripts. `CVocConf`
must load the scripts in this order:

```text
external-vocabulary-core.js
external-vocabulary-react.js
jsf-external-vocabulary-adapter.js
```
