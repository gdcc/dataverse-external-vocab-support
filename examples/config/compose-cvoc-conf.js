#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Validate that the result is a valid JSON array
 * 
 * @param {any} data - The data to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateJsonArray(data) {
    if (!Array.isArray(data)) {
        console.error('Validation Error: Result is not a JSON array');
        return false;
    }
    
    if (data.length === 0) {
        console.warn('Validation Warning: Result is an empty array');
        return true;
    }
    
    // Check that all elements are objects
    for (let i = 0; i < data.length; i++) {
        if (typeof data[i] !== 'object' || data[i] === null || Array.isArray(data[i])) {
            console.error(`Validation Error: Element at index ${i} is not a valid object`);
            return false;
        }
    }
    
    console.log('Validation: Result is a valid JSON array');
    return true;
}

/**
 * Compose a CVocConf.json file from multiple JSON files.
 * 
 * @param {string[]} filenames - List of file names (with or without .json extension), can include relative paths
 * @param {string} outputFile - Output file name (default: CVocConf.json)
 */
function composeCvocConfig(filenames, outputFile = 'CVocConf.json') {
    const allObjects = [];
    
    for (const filename of filenames) {
        // Parse the path and filename
        const parsedPath = path.parse(filename);
        const dir = parsedPath.dir;
        const base = parsedPath.base;
        
        // Add .json extension if not present
        const nameWithExt = base.endsWith('.json') ? base : `${base}.json`;
        
        // Construct the full path
        const fullFilename = dir ? path.join(dir, nameWithExt) : nameWithExt;
        
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
    
    // Validate the combined result
    console.log('\nValidating combined result...');
    if (!validateJsonArray(allObjects)) {
        console.error('Validation failed. Aborting write operation.');
        process.exit(1);
    }
    
    // Write the combined array to output file
    try {
        const jsonOutput = JSON.stringify(allObjects, null, 2);
        fs.writeFileSync(outputFile, jsonOutput, 'utf8');
        
        // Verify the written file can be parsed
        console.log('\nVerifying written file...');
        const verifyContent = fs.readFileSync(outputFile, 'utf8');
        const verifyData = JSON.parse(verifyContent);
        
        if (!validateJsonArray(verifyData)) {
            console.error('Verification failed. The written file is not valid.');
            process.exit(1);
        }
        
        console.log(`\n${outputFile} created successfully with ${allObjects.length} total object(s)!`);
        console.log('File validation: PASSED');
    } catch (error) {
        console.error(`Error: Failed to write or verify ${outputFile}: ${error.message}`);
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node compose-cvoc-config.js <file1> <file2> <file3> ...');
        console.log('Example: node compose-cvoc-config.js depositorOrcid authorOrcid publication');
        console.log('Example with paths: node compose-cvoc-config.js demos/authors configs/depositorOrcid');
        process.exit(1);
    }
    
    composeCvocConfig(args);
}

module.exports = { composeCvocConfig };