# Shared Core JSF Adapter

`jsf-external-vocabulary-adapter.js` is a thin legacy adapter for the framework-neutral
`external-vocabulary-core.js` package. It mounts only on JSF inputs marked with
`data-cvoc-adapter="shared-core-jsf"`, leaving existing GDCC scripts unchanged.

The adapter owns its generated subtree, writes selections to the original JSF
inputs, dispatches `input` and `change` events, and observes AJAX-added repeatable
fields. The companion configuration is intentionally limited to Author Name and
Author Affiliation as the compatibility prototype.
