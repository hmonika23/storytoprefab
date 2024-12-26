#!/usr/bin/env node

// Import only the functions used
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve, basename, dirname, relative } from 'path';
import glob from 'glob';

/**
 * Dynamically finds the components directory in the project root.
 */
const findComponentsDir = () => {
  const projectRoot = process.cwd();
  const possibleDir = resolve(projectRoot, 'components');

  if (existsSync(possibleDir) && statSync(possibleDir).isDirectory()) {
    console.log(`Found components directory at: ${possibleDir}`);
    return possibleDir;
  } else {
    console.warn('Components directory not found.');
    return null;
  }
};

/**
 * Extracts a block (args or argTypes) based on the provided key from the content.
 */
function extractBlock(content, key) {
  const regex = new RegExp(`${key}:\\s*{`, 'g');
  const startMatch = regex.exec(content);
  console.log('startMatch', startMatch);
  console.log(`Searching for ${key} block...`);
  if (!startMatch) return null; // If no match, return null

  let startIndex = startMatch.index + startMatch[0].length - 1; // Start after the key
  let openBraces = 1; // Track opening braces
  let endIndex = startIndex;

  while (openBraces > 0 && endIndex < content.length) {
    endIndex++;
    if (content[endIndex] === '{') openBraces++;
    if (content[endIndex] === '}') openBraces--;
  }

  if (openBraces === 0) {
    return content.substring(startMatch.index, endIndex + 1); // Return the entire block
  }
  return null; // If no closing brace found, return null
}

/**
 * Safely parses a JavaScript-like object from a string.
 * Handles parsing inline objects in args or argTypes.
 */
const parseJSObject = (jsObjectString) => {

  console.log('In parseJSObject ,Parsing JS Object:', jsObjectString);
  try {
    // Trim and normalize multiline strings for valid JavaScript
    const normalizedString = jsObjectString.replace(/(\r\n|\n|\r)/gm, "").trim();
    return Function(`"use strict"; return (${normalizedString});`)();
  } catch (error) {
    console.error('Failed to parse JS Object:', error.message);
    return null;
  }
};

const inferTypeFromValue = (value) => {
  if (Array.isArray(value)) {
    return 'object'; // Treat array as an object
  } else if (value === null) {
    return 'null';
  } else if (typeof value === 'object') {
    return 'object';
  } else {
    return typeof value; // string, number, boolean, etc.
  }
};

const extractPropsFromArgsOrArgTypes = (propsSource) => {
  const props = [];

  for (const [key, value] of Object.entries(propsSource)) {
    let type;
    let description = '';
    let defaultValue = undefined;
    let isList = false;

    // Check if we're dealing with `args` or `argTypes`
    if (value?.type && value?.type.name) {
      // We are working with `argTypes` so use its structure
      type = value.type.name === 'array' ? 'object' : value.type.name || inferTypeFromValue(value);
      description = value.description || '';
      defaultValue = value.defaultValue;
      isList = Array.isArray(value.defaultValue);
    } else {
      // Handle `args` structure where we only check the value
      type = inferTypeFromValue(value);
      defaultValue = value;
      isList = Array.isArray(value);
    }

    const prop = {
      name: key,
      type,
      description,
      defaultValue,
      isList,
    };

    props.push(prop);
  }

  return props;
};



/**
 * Main function to generate the wmprefab.config.json file.
 */
const generateConfig = () => {
  const componentsDir = findComponentsDir();
  if (!componentsDir) {
    console.error('No components directory found. Exiting...');
    return;
  }

  console.log(`Using components directory: ${componentsDir}`);

  // Find story files
  const storiesFiles = glob.sync(
    `${componentsDir}/**/*.stories.@(js|jsx|ts|tsx)`
  );
  console.log('Story files found:', storiesFiles);

  const components = [];

  storiesFiles.forEach((file) => {
    console.log(`Processing story file: ${file}`);

    const code = readFileSync(file, 'utf-8');
    const componentDir = dirname(file);
    const componentName = basename(componentDir);

    const possibleFiles = glob.sync(
      `${componentDir}/${componentName}.@(js|jsx|ts|tsx)`
    );

    if (possibleFiles.length === 0) {
      console.warn(`No component file found for ${componentName}`);
      return;
    }

    const componentFile = relative(componentDir, possibleFiles[0]).replace(/\\/g, '/');
    console.log(`Component file found for ${componentName}:`, componentFile);

// Determine if args or argTypes should be extracted
const isTSX = file.endsWith('.tsx');
const key = isTSX ? 'args' : 'argTypes';

console.log(`Searching for ${key} block...`);
let props = [];
const block = extractBlock(code, key); // Original block
if (block) {
  const cleanBlock = block.replace(new RegExp(`^${key}:\\s*`), '').trim(); // Remove the '<key>:' prefix

  const sanitizedBlock = cleanBlock.replace(/,\s*}/g, '}'); // Remove trailing commas
  console.log(`Sanitized block: ${sanitizedBlock}`);
  
  const parsedBlock = parseJSObject(sanitizedBlock);
  if (parsedBlock) {
    console.log('Parsed block:', parsedBlock);
    props = extractPropsFromArgsOrArgTypes(parsedBlock, {});
  } else {
    console.warn('Failed to parse sanitized block for', file);
  }
}




    components.push({
      name: componentName.toLowerCase(),
      version: '1.0.0',
      displayName: componentName.replace(/-/g, ' ').toUpperCase(),
      baseDir: './components',
      module: `require('./${componentName}/${componentFile}').default`,
      include: [`./${componentName}/${componentFile}`],
      props, // Include the properties
      packages: []
    });
  });

  const config = { components };
  console.log('Config object created:', config);

  const outputPath = 'wmprefab.config.json';
  writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`wmprefab.config.json has been generated at ${outputPath}`);
};

// Execute the generateConfig function
generateConfig();
