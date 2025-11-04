#!/usr/bin/env python3

import json
import sys
import os

def compose_cvoc_config(filenames, output_file='CVocConf.json'):
    """
    Compose a CVocConf.json file from multiple JSON files.
    
    Args:
        filenames: List of file names (with or without .json extension)
        output_file: Output file name (default: CVocConf.json)
    """
    all_objects = []
    
    for filename in filenames:
        # Add .json extension if not present
        if not filename.endswith('.json'):
            filename = f"{filename}.json"
        
        # Check if file exists
        if not os.path.exists(filename):
            print(f"Warning: File {filename} not found, skipping...", file=sys.stderr)
            continue
        
        try:
            # Read and parse the JSON file
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Ensure data is a list
            if not isinstance(data, list):
                print(f"Warning: {filename} does not contain a JSON array, skipping...", file=sys.stderr)
                continue
            
            # Add all objects from this file to the combined list
            all_objects.extend(data)
            print(f"Added {len(data)} object(s) from {filename}")
            
        except json.JSONDecodeError as e:
            print(f"Error: Failed to parse {filename}: {e}", file=sys.stderr)
            continue
        except Exception as e:
            print(f"Error: Failed to read {filename}: {e}", file=sys.stderr)
            continue
    
    # Write the combined array to output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_objects, f, indent=2, ensure_ascii=False)
        print(f"\n{output_file} created successfully with {len(all_objects)} total object(s)!")
    except Exception as e:
        print(f"Error: Failed to write {output_file}: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python compose_cvoc_config.py <file1> <file2> <file3> ...")
        print("Example: python compose_cvoc_config.py depositorOrcid authorOrcid publication")
        sys.exit(1)
    
    filenames = sys.argv[1:]
    compose_cvoc_config(filenames)