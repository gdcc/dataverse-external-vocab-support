#!/usr/bin/env python3

import json
import sys
import os

def validate_json_array(data):
    """
    Validate that the result is a valid JSON array.
    
    Args:
        data: The data to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    if not isinstance(data, list):
        print('Validation Error: Result is not a JSON array', file=sys.stderr)
        return False
    
    if len(data) == 0:
        print('Validation Warning: Result is an empty array', file=sys.stderr)
        return True
    
    # Check that all elements are dictionaries (objects)
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            print(f'Validation Error: Element at index {i} is not a valid object', file=sys.stderr)
            return False
    
    print('Validation: Result is a valid JSON array')
    return True

def compose_cvoc_config(filenames, output_file='CVocConf.json'):
    """
    Compose a CVocConf.json file from multiple JSON files.
    
    Args:
        filenames: List of file names (with or without .json extension), can include relative paths
        output_file: Output file name (default: CVocConf.json)
    """
    all_objects = []
    
    for filename in filenames:
        # Parse the path
        dirname = os.path.dirname(filename)
        basename = os.path.basename(filename)
        
        # Add .json extension if not present
        if not basename.endswith('.json'):
            basename = f"{basename}.json"
        
        # Construct the full path
        full_filename = os.path.join(dirname, basename) if dirname else basename
        
        # Check if file exists
        if not os.path.exists(full_filename):
            print(f"Warning: File {full_filename} not found, skipping...", file=sys.stderr)
            continue
        
        try:
            # Read and parse the JSON file
            with open(full_filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Ensure data is a list
            if not isinstance(data, list):
                print(f"Warning: {full_filename} does not contain a JSON array, skipping...", file=sys.stderr)
                continue
            
            # Add all objects from this file to the combined list
            all_objects.extend(data)
            print(f"Added {len(data)} object(s) from {full_filename}")
            
        except json.JSONDecodeError as e:
            print(f"Error: Failed to parse {full_filename}: {e}", file=sys.stderr)
            continue
        except Exception as e:
            print(f"Error: Failed to read {full_filename}: {e}", file=sys.stderr)
            continue
    
    # Validate the combined result
    print('\nValidating combined result...')
    if not validate_json_array(all_objects):
        print('Validation failed. Aborting write operation.', file=sys.stderr)
        sys.exit(1)
    
    # Write the combined array to output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_objects, f, indent=2, ensure_ascii=False)
        
        # Verify the written file can be parsed
        print('\nVerifying written file...')
        with open(output_file, 'r', encoding='utf-8') as f:
            verify_data = json.load(f)
        
        if not validate_json_array(verify_data):
            print('Verification failed. The written file is not valid.', file=sys.stderr)
            sys.exit(1)
        
        print(f"\n{output_file} created successfully with {len(all_objects)} total object(s)!")
        print('File validation: PASSED')
    except Exception as e:
        print(f"Error: Failed to write or verify {output_file}: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python compose_cvoc_config.py <file1> <file2> <file3> ...")
        print("Example: python compose_cvoc_config.py depositorOrcid authorOrcid publication")
        print("Example with paths: python compose_cvoc_config.py demos/authors configs/depositorOrcid")
        sys.exit(1)
    
    filenames = sys.argv[1:]
    compose_cvoc_config(filenames)