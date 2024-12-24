#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, resolve, relative } from 'path';
import glob from 'glob';
import * as babelParser from '@babel/parser';
import traverse from '@babel/traverse';

// Function to get all story files synchronously
const getStoriesFiles = (baseDir) => {
  const pattern = `${baseDir.replace(/\\/g, '/')}/**/*.stories.@(js|jsx|ts|tsx)`;
  console.log('Using glob pattern:', pattern);

  return glob.sync(pattern);
};

const extractArgsOrArgTypes = (code) => {
  const props = [];

  // Parse the code into an AST
  const ast = babelParser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  traverse(ast, {
    ObjectProperty(path) {
      console.log("path", path);
      console.log('Visiting ObjectProperty:', path.node.key.name);
      const key = path.node.key.name;
      if (key === 'args' || key === 'argTypes') {
        const valueNode = path.node.value;
        const extracted = evaluateNode(valueNode);
        props.push(
          ...Object.entries(extracted).map(([name, value]) => ({
            name,
            type: typeof value.defaultValue || typeof value,
            defaultValue: value.defaultValue || value,
            isList: Array.isArray(value.defaultValue || value),
            description: value.description || null,
          }))
        );
        path.stop(); // No need to traverse further once found
      }
    },
  });

  return props;
};

const evaluateNode = (node) => {
  try {
    // Use a safe evaluation or serialization to turn the AST node into a JavaScript object
    const code = `(${generate(node).code})`;
    return eval(code); // or use a safer evaluator
  } catch (err) {
    console.error('Failed to evaluate node:', err);
    return {};
  }
};

// Main function to generate wmprefabconfig.json
const generatePrefabConfig = async () => {
  console.log("In generatePrefabConfig function");
  const baseDir = resolve(process.cwd(), './components');
  const outputPath = resolve(process.cwd(), './wmprefab.config.json');

  console.log('Base directory:', baseDir);
  console.log('Output path:', outputPath);

  try {
    const storiesFiles = getStoriesFiles(baseDir);
    const components = [];

    for (const file of storiesFiles) {
      const code = readFileSync(file, 'utf-8');
      console.log('Processing file code:', code);
      const componentDir = dirname(file);
      console.log('Component directory:', componentDir);
      const componentName = basename(componentDir);
      console.log('Component name:', componentName);
      const possibleFiles = glob.sync(
        `${componentDir}/${componentName}.@(js|jsx|ts|tsx)`
      );

      if (possibleFiles.length === 0) {
        console.warn(`No component file found for ${componentName}`);
        continue;
      }

      const componentFile = relative(baseDir, possibleFiles[0]).replace(/\\/g, '/');

      const props = extractArgsOrArgTypes(code);
      console.log('Extracted props:', props);

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
