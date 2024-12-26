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
  try {
    // Using Function constructor to evaluate the string as a JavaScript object.
    // This assumes the string is syntactically correct as a JavaScript object.
    return Function(`"use strict"; return (${jsObjectString});`)();
  } catch (error) {
    console.error('Failed to parse JS Object:', error.message);
    return null;
  }
};


/**
 * Extracts props from args or argTypes objects.
 */
const extractPropsFromArgsOrArgTypes = (args, argTypes) => {
  console.log('Extracting props from args or argTypes:', args, argTypes);
  const props = [];
  const allProperties = { ...args, ...argTypes };

  for (const [key, value] of Object.entries(allProperties)) {
    const prop = {
      name: key,
      type: value?.type?.name || 'unknown',
      description: value?.description || '',
      defaultValue: args[key] || undefined,
      isList: Array.isArray(args[key]),
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
const block = extractBlock(code, key);

let props = [];
if (block) {

  console.log("Parsing block", block);
  console.log(`${key} block found, parsing...`);
  const parsedBlock = parseJSObject(block); // Use the safe parsing function
 
  if (parsedBlock) {
    const args = isTSX ? parsedBlock : {};
    const argTypes = isTSX ? {} : parsedBlock;

    props = extractPropsFromArgsOrArgTypes(args, argTypes);
  } else {
    console.warn(`Failed to parse ${key} block for ${file}`);
  }
} else {
  console.warn(`No ${key} block found in ${file}`);
}



    components.push({
      name: componentName.toLowerCase(),
      version: '1.0.0',
      displayName: componentName.replace(/-/g, ' ').toUpperCase(),
      baseDir: './components',
      module: `require('.${componentFile}/${componentFile}').default`,
      include: [`.${componentFile}/${componentFile}`],
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
