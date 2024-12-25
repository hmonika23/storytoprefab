#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename, dirname, relative, join } from 'path';
import glob from 'glob';


const findComponentsDir = () => {
  const projectRoot = process.cwd();
  console.log(`Searching for components directory in: ${projectRoot}`);
  const possibleDir = join(projectRoot, 'components');
  console.log(`Checking for components directory at: ${possibleDir}`);
  if (existsSync(possibleDir) && fs.statSync(possibleDir).isDirectory()) {
    console.log(`Found components directory at: ${possibleDir}`);
    return possibleDir;
  } else {
    console.warn('Components directory not found.');
    return null;
  }
};


const extractArgsOrArgTypes = (code) => {
  const argsPattern = /args\s*:\s*(\{[\s\S]+?\}),/;
  const argTypesPattern = /argTypes\s*:\s*(\{[\s\S]+?\}),/;

  let argsMatch = code.match(argsPattern);
  console.log('Args match:', argsMatch);
  let argTypesMatch = code.match(argTypesPattern);
   console.log('ArgTypes match:', argTypesMatch);
  return {
    args: argsMatch ? JSON.parse(argsMatch[1]) : {},
    argTypes: argTypesMatch ? JSON.parse(argTypesMatch[1]) : {},
  };
};


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

  // Find .stories.tsx files
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

    // Extract props from args or argTypes
    const { args, argTypes } = extractArgsOrArgTypes(code);

    const props = extractPropsFromArgsOrArgTypes(args, argTypes);

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
