#!/usr/bin/env node

import fs from 'fs';
import path, { dirname, join, relative, basename } from 'path';
import glob from 'glob';

/**
 * Dynamically finds the `components` directory.
 * @returns {string | null} Path to the `components` directory or null if not found.
 */
const findComponentsDir = () => {
  const projectRoot = process.cwd();
  const possibleDir = join(projectRoot, 'components');
  if (fs.existsSync(possibleDir) && fs.statSync(possibleDir).isDirectory()) {
    console.log(`Found components directory at: ${possibleDir}`);
    return possibleDir;
  }
  console.warn('Components directory not found.');
  return null;
};

/**
 * Extracts `args` and `argTypes` from the story source code.
 * @param {string} code - The story source code.
 * @returns {object} Extracted args and argTypes.
 */
const extractArgsOrArgTypes = (code) => {
  try {
    const argsMatch = code.match(/args\s*=\s*({[\s\S]*?\n})/);
    console.log('Extracted argsMatch:', argsMatch);
    const argTypesMatch = code.match(/argTypes\s*=\s*({[\s\S]*?\n})/);
    console.log('Extracted argTypesMatch:', argTypesMatch);
    const args = argsMatch ? eval(`(${argsMatch[1]})`) : {};
    const argTypes = argTypesMatch ? eval(`(${argTypesMatch[1]})`) : {};

    console.log('Extracted args:', args);
    console.log('Extracted argTypes:', argTypes);
    return { args, argTypes };
  } catch (error) {
    console.error('Error extracting args or argTypes:', error);
    return { args: {}, argTypes: {} };
  }
};

/**
 * Converts `args` and `argTypes` to the `props` format.
 * @param {object} args - Extracted args.
 * @param {object} argTypes - Extracted argTypes.
 * @returns {Array} Array of props.
 */
const generateProps = (args, argTypes) => {
  const props = [];

  Object.entries(args || {}).forEach(([key, value]) => {
    const prop = {
      name: key,
      defaultValue: value,
      type: Array.isArray(value) ? 'object' : typeof value,
      isList: Array.isArray(value),
    };
    props.push(prop);
  });

  Object.entries(argTypes || {}).forEach(([key, value]) => {
    const existingProp = props.find((prop) => prop.name === key);
    const newProp = {
      name: key,
      description: value.description || '',
      type: value.type?.name || 'unknown',
      isList: value.type?.name === 'array',
      defaultValue: value.defaultValue,
    };
    if (existingProp) {
      Object.assign(existingProp, newProp);
    } else {
      props.push(newProp);
    }
  });

  return props;
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
  const storyFiles = glob.sync(`${componentsDir}/**/*.stories.@(js|jsx|ts|tsx)`);
  console.log('Story files found:', storyFiles);

  const components = [];
  storyFiles.forEach((file) => {
    console.log(`Processing story file: ${file}`);
    const code = fs.readFileSync(file, 'utf-8');
    const componentDir = dirname(file);
    const componentName = basename(componentDir);

    const possibleFiles = glob.sync(`${componentDir}/${componentName}.@(js|jsx|ts|tsx)`);
    if (possibleFiles.length === 0) {
      console.warn(`No component file found for ${componentName}`);
      return;
    }

    const componentFile = relative(componentDir, possibleFiles[0]).replace(/\\/g, '/');
    console.log(`Component file found for ${componentName}:`, componentFile);

    const { args, argTypes } = extractArgsOrArgTypes(code);
    const props = generateProps(args, argTypes);

    components.push({
      name: componentName.toLowerCase(),
      version: '1.0.0',
      displayName: componentName.replace(/-/g, ' ').toUpperCase(),
      baseDir: './components',
      module: `require('./${componentFile}').default`,
      include: [`./${componentFile}`],
      props,
      packages: [],
    });
  });

  const config = { components };
  console.log('Final config object:', JSON.stringify(config, null, 2));

  const outputPath = 'wmprefab.config.json';
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`wmprefab.config.json has been generated at ${outputPath}`);
};

generateConfig();
