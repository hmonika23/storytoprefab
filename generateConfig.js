#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, resolve, relative } from 'path';
import glob from 'glob';

// Function to get all story files synchronously
const getStoriesFiles = (baseDir) => {
  const pattern = `${baseDir.replace(/\\\\/g, '/')}/**/*.stories.@(js|jsx|ts|tsx)`;
  console.log('Using glob pattern:', pattern);

  return glob.sync(pattern);
};

// Parse property details from an `args` or `argTypes` string
const parseProps = (propsStr) => {
  try {
    const parsedProps = eval(`(${propsStr})`); 
     console.log('Parsed props:', parsedProps); 
    return Object.entries(parsedProps).map(([key, value]) => {
      const isList = Array.isArray(value.defaultValue);
      return {
        name: key,
        type: value.type || typeof value.defaultValue,
        defaultValue: value.defaultValue || null,
        isList: isList || false,
        description: value.description || null,
      };
    });
  } catch (error) {
    console.error('Error parsing props:', error);
    return [];
  }
};

// Function to extract metadata (args or argTypes)
const extractArgsOrArgTypes = (code) => {
  const argsMatch = code.match(/args:\\s*{([\\s\\S]*?)}/);
  console.log('Extracted args:', argsMatch);
  const argTypesMatch = code.match(/argTypes:\\s*{([\\s\\S]*?)}/);
  console.log('Extracted argTypes:', argTypesMatch);

  const argsStr = argsMatch ? argsMatch[0].replace('args:', '') : null;
  console.log('Extracted argsStr:', argsStr);
  const argTypesStr = argTypesMatch ? argTypesMatch[0].replace('argTypes:', '') : null;
  console.log('Extracted argTypesStr:', argTypesStr);
  const props = [];
  if (argsStr) props.push(...parseProps(argsStr));
  if (argTypesStr) props.push(...parseProps(argTypesStr));

  return props;
};

// Main function to generate wmprefabconfig.json
const generatePrefabConfig = async () => {
  const baseDir = resolve(process.cwd(), './components');
  const outputPath = resolve(process.cwd(), './wmprefab.config.json');

  console.log('Base directory:', baseDir);
  console.log('Output path:', outputPath);

  try {
    const storiesFiles = getStoriesFiles(baseDir);
    const components = [];

    for (const file of storiesFiles) {
      const code = readFileSync(file, 'utf-8');
      const componentDir = dirname(file);
      const componentName = basename(componentDir);

      const possibleFiles = glob.sync(
        `${componentDir}/${componentName}.@(js|jsx|ts|tsx)`
      );

      if (possibleFiles.length === 0) {
        console.warn(`No component file found for ${componentName}`);
        continue;
      }

      const componentFile = relative(baseDir, possibleFiles[0]).replace(/\\\\/g, '/');

      const props = extractArgsOrArgTypes(code);

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
    }

    const prefabConfig = { components };
    writeFileSync(outputPath, JSON.stringify(prefabConfig, null, 2));
    console.log(`wmprefabconfig.json generated at ${outputPath}`);
  } catch (error) {
    console.error('Error generating wmprefabconfig.json:', error);
  }
};

// Run the script
generatePrefabConfig();
