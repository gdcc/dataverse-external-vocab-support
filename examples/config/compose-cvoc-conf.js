#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Compose a CVocConf.json file from multiple JSON files.
 * 
 * @param {string[]} filenames - List of file names (with or without .json extension)
 * @param {string} outputFile - Output file name (default: CVocConf.json)
 */
function composeCvocConfig(filenames, outputFile = 'CVocConf.json') {
    const allObjects = [];
    
    for (const filename of filenames) {
        // Add .json extension if not present
        const fullFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
        
        // Check if file exists
        if (!fs.existsSync(fullFilename)) {
            console.warn(`Warning: File ${fullFilename} not found, skipping...`);
            continue;
        }
        
        try {
            // Read and parse the JSON file
            const fileContent = fs.readFileSync(fullFilename, 'utf8');
            const data = JSON.parse(fileContent);
            
            // Ensure data is an array
            if (!Array.isArray(data)) {
                console.warn(`Warning: ${fullFilename} does not contain a JSON array, skipping...`);
                continue;
            }
            
            // Add all objects from this file to the combined list
            allObjects.push(...data);
            console.log(`Added ${data.length} object(s) from ${fullFilename}`);
            
        } catch (error) {
            if (error instanceof SyntaxError) {
                console.error(`Error: Failed to parse ${fullFilename}: ${error.message}`);
            } else {
                console.error(`Error: Failed to read ${fullFilename}: ${error.message}`);
            }
            continue;
        }
    }
    
    // Write the combined array to output file
    try {
        fs.writeFileSync(outputFile, JSON.stringify(allObjects, null, 2), 'utf8');
        console.log(`\n${outputFile} created successfully with ${allObjects.length} total object(s)!`);
    } catch (error) {
        console.error(`Error: Failed to write ${outputFile}: ${error.message}`);
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node compose-cvoc-config.js <file1> <file2> <file3> ...');
        console.log('Example: node compose-cvoc-config.js depositorOrcid authorOrcid publication');
        process.exit(1);
    }
    
    composeCvocConfig(args);
}

module.exports = { composeCvocConfig };