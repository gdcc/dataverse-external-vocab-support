#!/bin/bash

# Usage: ./compose-cvoc-config.sh file1 file2 file3 ...
# Creates CVocConf.json from the specified files

# Check if at least one file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <file1> <file2> <file3> ..."
    echo "Example: $0 depositorOrcid authorOrcid publication"
    exit 1
fi

# Start the output array
echo "[" > CVocConf.json

first=true

# Process each file
for filename in "$@"; do
    # Add .json extension if not present
    if [[ ! "$filename" =~ \.json$ ]]; then
        filename="${filename}.json"
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
done

# Remove trailing comma from last entry
sed -i '$ s/,$//' CVocConf.json 2>/dev/null || sed -i '' '$ s/,$//' CVocConf.json

# Close the output array
echo "]" >> CVocConf.json

echo "CVocConf.json created successfully!"