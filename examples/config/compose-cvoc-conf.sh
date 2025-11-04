#!/bin/bash

# Usage: ./compose-cvoc-config.sh file1 file2 file3 ...
# Creates CVocConf.json from the specified files
# Supports relative paths, e.g., demos/authors configs/depositorOrcid

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq first."
    exit 1
fi

# Check if at least one file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <file1> <file2> <file3> ..."
    echo "Example: $0 depositorOrcid authorOrcid publication"
    echo "Example with paths: $0 demos/authors configs/depositorOrcid"
    exit 1
fi

# Start the output array
echo "[" > CVocConf.json

first=true

# Process each file
for filepath in "$@"; do
    # Extract directory and filename
    dirname=$(dirname "$filepath")
    basename=$(basename "$filepath")
    
    # Add .json extension if not present
    if [[ ! "$basename" =~ \.json$ ]]; then
        basename="${basename}.json"
    fi
    
    # Construct full path
    if [ "$dirname" = "." ]; then
        filename="$basename"
    else
        filename="${dirname}/${basename}"
    fi
    
    # Check if file exists
    if [ ! -f "$filename" ]; then
        echo "Warning: File $filename not found, skipping..."
        continue
    fi
    
    # Add comma separator if not the first file
    if [ "$first" = false ]; then
        echo "," >> CVocConf.json
    fi
    first=false
    
    # Extract the array contents (remove outer brackets)
    # This uses jq to parse and re-output without the outer array brackets
    jq -c '.[]' "$filename" | while IFS= read -r line; do
        echo "  $line" >> CVocConf.json
        # Add comma if not the last line from this file
        if [ -n "$(tail -n 1)" ]; then
            sed -i '$ s/$/,/' CVocConf.json 2>/dev/null || sed -i '' '$ s/$/,/' CVocConf.json
        fi
    done
    
    echo "Added object(s) from $filename"
done

# Remove trailing comma from last entry
sed -i '$ s/,$//' CVocConf.json 2>/dev/null || sed -i '' '$ s/,$//' CVocConf.json

# Close the output array
echo "]" >> CVocConf.json

# Validate the result
echo ""
echo "Validating combined result..."

# Check if the file is valid JSON
if ! jq empty CVocConf.json 2>/dev/null; then
    echo "Validation Error: CVocConf.json is not valid JSON"
    exit 1
fi

# Check if it's an array
if ! jq -e 'type == "array"' CVocConf.json > /dev/null 2>&1; then
    echo "Validation Error: CVocConf.json is not a JSON array"
    exit 1
fi

# Check if all elements are objects
if ! jq -e 'all(type == "object")' CVocConf.json > /dev/null 2>&1; then
    echo "Validation Error: Not all elements in the array are objects"
    exit 1
fi

# Get the count of objects
count=$(jq 'length' CVocConf.json)

if [ "$count" -eq 0 ]; then
    echo "Validation Warning: Result is an empty array"
else
    echo "Validation: Result is a valid JSON array"
fi

echo ""
echo "CVocConf.json created successfully with $count total object(s)!"
echo "File validation: PASSED"