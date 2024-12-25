#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import glob from 'glob';

/**
 * Finds the components directory within the project folder dynamically.
 * @returns {string|null} - Path to components directory or null if not found.
 */
const findComponentsDir = () => {
  const projectRoot = process.cwd(); 
  const possibleDir = join(projectRoot, 'components');
  if (existsSync(possibleDir) && statSync(possibleDir).isDirectory()) {
    console.log(`Found components directory at: ${possibleDir}`);
    return possibleDir;
  }
  console.warn('Components directory not found.');
  return null;
};

/**
 * Extracts `args` and `argTypes` from the story source code.
 * @param {string} code - The story source code.
 * @returns {object} - Extracted args or argTypes object.
 */
const extractArgsOrArgTypes = (code) => {
  try {
    const matchedArgs = code.match(/args\s*=\s*({[\s\S]*?})/);
    const matchedArgTypes = code.match(/argTypes\s*=\s*({[\s\S]*?})/);

    const args = matchedArgs ? eval(`(${matchedArgs[1]})`) : {};
    const argTypes = matchedArgTypes ? eval(`(${matchedArgTypes[1]})`) : {};

    console.log('Extracted args or argTypes:', args || argTypes);
    return { args, argTypes };
  } catch (error) {
    console.error('Error extracting args or argTypes:', error);
    return { args: {}, argTypes: {} };
  }
};

/**
 * Converts `argTypes` into props for the component.
 * @param {object} argTypes - The `argTypes` object from the story.
 * @returns {Array} - Array of props metadata.
 */
const convertArgTypesToProps = (argTypes) => {
  return Object.keys(argTypes).map((key) => ({
    name: key,
    type: argTypes[key]?.type?.name || 'unknown',
    defaultValue: argTypes[key]?.defaultValue || null,
    description: argTypes[key]?.description || '',
  }));
};

/**
 * Main function to generate `wmprefab.config.json`.
 */
const generateConfig = () => {
  const componentsDir = findComponentsDir();
  if (!componentsDir) {
    console.error('No components directory found. Exiting...');
    return;
  }

  console.log(`Using components directory: ${componentsDir}`);

  const storiesFiles = glob.sync(`${componentsDir}/**/*.stories.@(js|jsx|ts|tsx)`);
  console.log('Story files found:', storiesFiles);

  const components = [];

  storiesFiles.forEach((file) => {
    console.log(`Processing story file: ${file}`);

    const code = readFileSync(file, 'utf-8');
    const componentDir = dirname(file);
    const componentName = basename(componentDir);

    const possibleFiles = glob.sync(`${componentDir}/${componentName}.@(js|jsx|ts|tsx)`);
    if (possibleFiles.length === 0) {
      console.warn(`No component file found for ${componentName}`);
      return;
    }

    const componentFile = relative(componentDir, possibleFiles[0]).replace(/\\/g, '/');
    console.log(`Component file found: ${componentFile}`);

    const { args, argTypes } = extractArgsOrArgTypes(code);

    const props = convertArgTypesToProps(argTypes);

    components.push({
      name: componentName.toLowerCase(),
      version: '1.0.0',
      displayName: componentName.replace(/-/g, ' ').toUpperCase(),
      baseDir: './components',
      module: `require('./${componentFile}').default`,
      include: [`./${componentFile}`],
      props,
      args,
      packages: [],
    });
  });

  const config = { components };
  const outputPath = 'wmprefab.config.json';
  writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`Configuration generated: ${outputPath}`);
};

generateConfig();
