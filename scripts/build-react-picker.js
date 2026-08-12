const esbuild = require('esbuild');
const path = require('path');

const root = path.join(__dirname, '..');

esbuild.build({
    bundle: true,
    entryPoints: [path.join(root, 'packages', 'external-vocabulary-react', 'src', 'jsf-browser-entry.tsx')],
    format: 'iife',
    globalName: 'DataverseExternalVocabularyReact',
    outfile: path.join(root, 'dist', 'js', 'external-vocabulary-react.js'),
    platform: 'browser',
    target: ['es2018']
}).catch(() => process.exit(1));
