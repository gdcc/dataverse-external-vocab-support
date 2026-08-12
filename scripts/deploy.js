const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const { composeCvocConfig } = require('./compose-cvoc-conf');

const SERVICES_DIR = path.join(__dirname, '..', 'services');
const SHARED_CORE_DIR = path.join(__dirname, '..', 'packages', 'external-vocabulary-core');
const DIST_ROOT = path.join(__dirname, '..', 'dist');
const DIST_DIR = path.join(DIST_ROOT, 'js');
const DIST_IMG_DIR = path.join(DIST_ROOT, 'img');
const DEFAULT_OUTPUT = 'CVocConf.json';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

/**
 * Ensures a directory exists.
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Creates a symlink, handling existing ones.
 */
function createSymlink(target, link) {
    if (fs.existsSync(link)) {
        const stats = fs.lstatSync(link);
        if (stats.isSymbolicLink() || stats.isFile() || stats.isDirectory()) {
            fs.rmSync(link, { recursive: true, force: true });
        }
    }
    
    const relativeTarget = path.relative(path.dirname(link), target);
    try {
        const type = fs.statSync(target).isDirectory() ? 'junction' : 'file';
        fs.symlinkSync(relativeTarget, link, type);
        console.log(`Linked: ${path.basename(link)} -> ${relativeTarget}`);
    } catch (err) {
        console.error(`Failed to link ${link}: ${err.message}`);
        console.log(`Attempting copy instead...`);
        fs.cpSync(target, link, { recursive: true });
        console.log(`Copied: ${path.basename(link)}`);
    }
}

/**
 * Populates the dist directory with symlinks to service files.
 */
function linkServices() {
    console.log('Populating dist/ directory...');
    ensureDir(DIST_DIR);
    ensureDir(path.join(DIST_DIR, 'i18n'));
    ensureDir(DIST_IMG_DIR);

    const services = fs.readdirSync(SERVICES_DIR);

    services.forEach(service => {
        const servicePath = path.join(SERVICES_DIR, service);
        if (!fs.statSync(servicePath).isDirectory()) return;

        // Link JS files
        const files = fs.readdirSync(servicePath);
        files.forEach(file => {
            if (file.endsWith('.js')) {
                createSymlink(path.join(servicePath, file), path.join(DIST_DIR, file));
            }
        });

        // Link i18n files
        const i18nDir = path.join(servicePath, 'i18n');
        if (fs.existsSync(i18nDir) && fs.statSync(i18nDir).isDirectory()) {
            const i18nFiles = fs.readdirSync(i18nDir);
            i18nFiles.forEach(file => {
                if (file.endsWith('.json')) {
                    createSymlink(path.join(i18nDir, file), path.join(DIST_DIR, 'i18n', file));
                }
            });
        }

        // Link img files
        const imgDir = path.join(servicePath, 'img');
        if (fs.existsSync(imgDir) && fs.statSync(imgDir).isDirectory()) {
            const imgFiles = fs.readdirSync(imgDir);
            imgFiles.forEach(file => {
                createSymlink(path.join(imgDir, file), path.join(DIST_IMG_DIR, file));
            });
        }
    });

    createSymlink(
        path.join(SHARED_CORE_DIR, 'external-vocabulary-core.js'),
        path.join(DIST_DIR, 'external-vocabulary-core.js')
    );

    console.log('Building the shared React picker for JSF...');
    execSync('node scripts/build-react-picker.js', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
    });
}

/**
 * Lists all available configurations.
 */
function listConfigs() {
    const services = fs.readdirSync(SERVICES_DIR);
    const configs = [];

    services.forEach(service => {
        const configDir = path.join(SERVICES_DIR, service, 'configs');
        if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
            const files = fs.readdirSync(configDir);
            files.forEach(file => {
                if (file.endsWith('.json') && !file.endsWith('.schema.json')) {
                    configs.push({
                        service,
                        name: file,
                        path: path.join(configDir, file)
                    });
                }
            });
        }
    });

    return configs;
}

/**
 * Rewrites js-url in the configuration.
 */
function rewriteJsUrls(configPath, baseUrl) {
    if (!baseUrl) return;
    
    console.log(`Rewriting JS URLs to base: ${baseUrl}`);
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);

    const configArray = Array.isArray(config) ? config : [config];
    const updatedConfig = configArray.map(item => {
        if (item['js-url']) {
            const urls = Array.isArray(item['js-url']) ? item['js-url'] : [item['js-url']];
            const updatedUrls = urls.map(url => {
                const fileName = path.basename(url);
                // The base URL now points to the dist root, so we add /js/
                return `${baseUrl.replace(/\/$/, '')}/js/${fileName}`;
            });
            item['js-url'] = Array.isArray(item['js-url']) ? updatedUrls : updatedUrls[0];
        }
        return item;
    });

    fs.writeFileSync(configPath, JSON.stringify(Array.isArray(config) ? updatedConfig : updatedConfig[0], null, 2), 'utf8');
}

/**
 * Interactive composition command.
 */
async function compose() {
    const availableConfigs = listConfigs();
    console.log('\nAvailable configurations:');
    availableConfigs.forEach((cfg, index) => {
        console.log(`${index + 1}: [${cfg.service}] ${cfg.name}`);
    });

    const selection = await question('\nEnter numbers of configs to include (comma separated, or "all"): ');
    let selectedConfigs = [];

    if (selection.toLowerCase() === 'all') {
        selectedConfigs = availableConfigs;
    } else {
        const indices = selection.split(',').map(s => parseInt(s.trim()) - 1);
        selectedConfigs = indices.map(i => availableConfigs[i]).filter(cfg => cfg);
    }

    if (selectedConfigs.length === 0) {
        console.log('No configurations selected.');
        return;
    }

    const outputFile = await question(`Output filename (default: ${DEFAULT_OUTPUT}): `) || DEFAULT_OUTPUT;
    
    composeCvocConfig(selectedConfigs.map(cfg => cfg.path), outputFile);

    const rewrite = await question('\nRewrite js-url to a local base URL? (y/N): ');
    if (rewrite.toLowerCase() === 'y') {
        console.log('\nNote: The base URL should be the location where the dist/ directory will be linked (e.g., the URL of your cvoc directory).');
        const baseUrl = await question('Enter local base URL (e.g., http://localhost/cvoc/): ');
        rewriteJsUrls(outputFile, baseUrl);
    }

    console.log(`\nConfiguration saved to ${outputFile}`);
}

/**
 * Interactive updateDataverse command.
 */
async function updateDataverse() {
    const configFile = await question(`Configuration file to upload (default: ${DEFAULT_OUTPUT}): `) || DEFAULT_OUTPUT;
    
    if (!fs.existsSync(configFile)) {
        console.error(`Error: File ${configFile} not found.`);
        return;
    }

    const dvUrl = await question('Dataverse URL (default: http://localhost:8080/): ') || 'http://localhost:8080/';
    const unblockKey = await question('Unblock Key (optional, if required by your Dataverse): ');

    let endpoint = `${dvUrl.replace(/\/$/, '')}/api/admin/settings/:CVocConf`;
    if (unblockKey) {
        endpoint += `?unblock-key=${unblockKey}`;
    }

    console.log(`Uploading ${configFile} to ${endpoint.replace(unblockKey, '********')}...`);

    try {
        // Using curl via execSync for simplicity as requested in requirements
        const command = `curl -X PUT --upload-file "${configFile}" "${endpoint}"`;
        const result = execSync(command, { encoding: 'utf8' });
        console.log('\nResponse from Dataverse:');
        console.log(result);
        console.log('\nSuccess: The :CVocConf setting has been updated and scripts that have been linked and composed with this script should now be active.');
        console.log('Note: Individual scripts may also require specific metadata blocks or other configuration and users should review the instructions for the scripts they use.');
    } catch (err) {
        console.error(`\nFailed to upload: ${err.message}`);
        const maskedCommand = `curl -X PUT --upload-file "${configFile}" "${endpoint.replace(unblockKey, '********')}"`;
        console.log(`Attempted command: ${maskedCommand}`);
        if (err.stdout) console.log(err.stdout);
        if (err.stderr) console.error(err.stderr);
    }
}

/**
 * Interactive linkWeb command to link dist directory to web server.
 */
async function linkWeb() {
    console.log('\nThis step will link your dist/ directory (containing js and img) to your web server.');
    
    const configFile = await question(`Reference configuration file to check for base URL (default: ${DEFAULT_OUTPUT}): `) || DEFAULT_OUTPUT;
    if (fs.existsSync(configFile)) {
        try {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            const configArray = Array.isArray(config) ? config : [config];
            const firstItem = configArray.find(item => item['js-url']);
            if (firstItem) {
                let jsUrl = Array.isArray(firstItem['js-url']) ? firstItem['js-url'][0] : firstItem['js-url'];
                if (jsUrl) {
                    const scriptDir = jsUrl.substring(0, jsUrl.lastIndexOf('/'));
                    console.log(`\nBased on ${configFile}, your scripts are configured to be in: ${scriptDir}/`);
                    if (jsUrl.includes('/js/')) {
                        const baseUrl = jsUrl.substring(0, jsUrl.lastIndexOf('/js/'));
                        console.log(`You should link the dist/ directory to the local directory corresponding to the web path: ${baseUrl}`);
                    } else {
                        console.log('Note: Could not automatically determine the base directory from this URL.');
                    }
                } else {
                    console.log(`\nNo valid 'js-url' found in ${configFile}.`);
                }
            } else {
                console.log(`\nNo 'js-url' found in ${configFile}.`);
            }
        } catch (e) {
            console.error(`\nError parsing ${configFile}: ${e.message}`);
        }
    } else {
        console.log(`\nFile ${configFile} not found. Skipping URL detection.`);
    }

    console.log('\nIt is recommended to link the entire dist/ directory so that both scripts and images are available.');
    
    const webPath = await question('Enter the target path on your web server (the local directory corresponding to the web path used in the compose step): ');
    if (!webPath) {
        console.log('No path provided. Skipping.');
        return;
    }

    if (fs.existsSync(webPath)) {
        console.log(`\nNote: ${webPath} already exists. Skipping link creation.`);
        return;
    }

    const absoluteDist = path.resolve(DIST_ROOT);
    console.log(`Linking ${absoluteDist} to ${webPath}...`);

    try {
        if (process.platform === 'win32') {
            // Use junction for directories on Windows
            execSync(`cmd /c mklink /j "${webPath}" "${absoluteDist}"`);
        } else {
            execSync(`ln -s "${absoluteDist}" "${webPath}"`);
        }
        console.log(`\nSuccess: Linked ${absoluteDist} to ${webPath}`);
    } catch (err) {
        console.error(`\nFailed to create link: ${err.message}`);
        console.log('\nPlease run the following command manually (possibly with sudo):');
        if (process.platform === 'win32') {
            console.log(`  mklink /j "${webPath}" "${absoluteDist}"`);
        } else {
            console.log(`  sudo ln -s "${absoluteDist}" "${webPath}"`);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    switch (command) {
        case 'link':
            linkServices();
            rl.close();
            break;
        case 'compose':
            await compose();
            rl.close();
            break;
        case 'updateDataverse':
            await updateDataverse();
            rl.close();
            break;
        case 'linkWeb':
            await linkWeb();
            rl.close();
            break;
        case 'help':
        default:
            console.log('Usage: node scripts/deploy.js [command]');
            console.log('Commands:');
            console.log('  link     Populate dist/ directory with symlinks to services');
            console.log('  linkWeb  Link the dist/ directory to your web server');
            console.log('  compose  Interactively select and combine configurations');
            console.log('  updateDataverse  Upload a configuration to Dataverse API');
            rl.close();
            break;
    }
}

main();
