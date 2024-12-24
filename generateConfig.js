#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve, basename, dirname, relative } from 'path';
import glob from 'glob';

// Function to extract the meta and argTypes from Storybook code
const extractMetaAndArgTypes = (storyCode) => {
  console.log('Extracting meta and argTypes from story code...');
  
  // Extract meta using regex or another parsing method
  const metaPattern = /export\s+default\s+(\{[^}]+\});/;
  const metaMatch = storyCode.match(metaPattern);
  
  if (!metaMatch || !metaMatch[1]) {
    console.log('No meta found.');
    return { meta: {}, argTypes: {} };
  }

  const meta = eval(`(${metaMatch[1]})`); // Convert string to JSON-like object
  console.log('Meta extracted:', meta);

  // Extract `argTypes` if defined
  const argTypes = meta.argTypes || {}; // Defaults to an empty object if not defined
  console.log('ArgTypes extracted:', argTypes);
  
  return { meta, argTypes };
};

// Extract the argument types (from `argTypes` within meta)
const extractArgTypes = (argTypes) => {
  console.log('Extracting argument types (props)...');

  const props = [];

  if (argTypes) {
    Object.keys(argTypes).forEach((key) => {
      const arg = argTypes[key];

      const prop = {
        name: key,
        type: arg.type?.name || 'unknown',
        defaultValue: arg.defaultValue || null,
        description: arg.description || null,
        isList: Array.isArray(arg.defaultValue),
        controlType: arg.control?.type || null,
      };

      console.log(`Extracted prop for ${key}:`, prop);
      props.push(prop);
    });
  }

  return props;
};

// Function to generate the wmprefab.config.json file
const generateConfig = () => {
  // Path where the storybook components are stored
  const componentsDir = 'C:/Users/moikah_500338/Desktop/teststorytoprefab/storybookproject/components/';
  console.log('Searching for stories in:', componentsDir);

  // Storybook components file patterns to match using glob
  const storiesFiles = glob.sync(
    `${componentsDir}/**/*.stories.@(js|jsx|ts|tsx)`
  );
  console.log('Story files found:', storiesFiles);

  // Array to hold all components' metadata
  const components = [];

  // Iterate over story files and process each
  storiesFiles.forEach((file) => {
    console.log(`Processing file: ${file}`);

    const code = readFileSync(file, 'utf-8');
    const componentDir = dirname(file);
    const componentName = basename(componentDir);

    // Use glob to find the component file corresponding to each story
    const possibleFiles = glob.sync(
      `${componentDir}/${componentName}.@(js|jsx|ts|tsx)`
    );

    // Ensure component file exists
    if (possibleFiles.length === 0) {
      console.warn(`No component file found for ${componentName}`);
      return;
    }

    const componentFile = relative(componentDir, possibleFiles[0]).replace(/\\/g, '/');
    console.log(`Component file found for ${componentName}:`, componentFile);

    // Extract `meta` and `argTypes` from the code
    const { meta, argTypes } = extractMetaAndArgTypes(code);

    // Extract `props` from `argTypes`
    const props = extractArgTypes(argTypes);

    // Push the processed component data into the components array
    components.push({
      name: componentName.toLowerCase(),
      version: '1.0.0',
      displayName: componentName.replace(/-/g, ' ').toUpperCase(),
      baseDir: './components',
      module: `require('./${componentFile}').default`,
      include: [`./${componentFile}`],
      props, // Include the properties (argTypes data)
      packages: [],
    });
  });

  // Construct the final config object
  const config = { components };
  console.log('Config object created:', config);

  // Write the JSON output to a file named wmprefab.config.json
  const outputPath = 'wmprefab.config.json';
  writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`wmprefab.config.json has been generated at ${outputPath}`);
};

// Call the function at the end of the script
generateConfig();
