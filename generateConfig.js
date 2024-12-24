#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, resolve, relative } from 'path';
import glob from 'glob';

// Function to get all story files synchronously
const getStoriesFiles = (baseDir) => {
  const pattern = `${baseDir.replace(/\\/g, '/')}/**/*.stories.@(js|jsx|ts|tsx)`;
  console.log('Using glob pattern:', pattern);

  const files = glob.sync(pattern);
  console.log('Found story files:', files);

  return files;
};

// Function to extract metadata (args or argTypes)
const extractArgsOrArgTypes = (code, filePath) => {
  console.log('filePath:', filePath);

  const componentName = basename(dirname(filePath));
  console.log('componentName:', componentName);

  let metadata = {
    name: componentName.toLowerCase(),
    props: [],
  };

  // Match and extract the `args` or `argTypes` object
  const argsMatch = code.match(/args:\s*{([\s\S]*?)}/);
  console.log('argsMatch:', argsMatch);
  const argTypesMatch = code.match(/argTypes:\s*{([\s\S]*?)}/);
  console.log('argTypesMatch:', argTypesMatch);
  if (argsMatch) {
    metadata.args = argsMatch[0];
 console.log('metadata.args:', metadata.args);
  }

  if (argTypesMatch) {
    metadata.argTypes = argTypesMatch[0];

    console.log('metadata.argTypes:', metadata.argTypes);
  }

  return metadata;
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
      const metadata = extractArgsOrArgTypes(code, file);

      const componentDir = dirname(file);
      console.log('componentDir:', componentDir);
      const componentName = basename(componentDir);
      console.log('componentName:', componentName);
      const possibleFiles = glob.sync(
        `${componentDir}/${componentName}.@(js|jsx|ts|tsx)`
      );

      if (possibleFiles.length === 0) {
        console.warn(`No component file found for ${componentName}`);
        continue;
      }

      const componentFile = relative(baseDir, possibleFiles[0]).replace(/\\/g, '/');

      components.push({
        name: metadata.name,
        version: '1.0.0',
        displayName: metadata.name.replace(/-/g, ' ').toUpperCase(),
        baseDir: './components',
        module: `require('./${componentFile}').default`,
        include: [`./${componentFile}`],
        metadata: {
          args: metadata.args || null,
          argTypes: metadata.argTypes || null,
        },
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
