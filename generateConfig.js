#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, resolve, relative } from 'path';
import glob from 'glob';
import * as babelParser from '@babel/parser';

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

  // Helper function to process object properties
  const processProperties = (node) => {
    if (node.type === 'ObjectExpression') {
      for (const property of node.properties) {
        if (
          property.type === 'ObjectProperty' &&
          (property.key.name === 'args' || property.key.name === 'argTypes')
        ) {
          const extracted = evaluateNode(property.value);
          props.push(
            ...Object.entries(extracted).map(([name, value]) => ({
              name,
              type: typeof value.defaultValue || typeof value,
              defaultValue: value.defaultValue || value,
              isList: Array.isArray(value.defaultValue || value),
              description: value.description || null,
            }))
          );
        }
      }
    }
  };

  // Recursively search for the `args` or `argTypes` properties
  const findArgsOrArgTypes = (node) => {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
      processProperties(node.declaration);
    } else if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.init) processProperties(decl.init);
      }
    }

    // Check child nodes recursively
    for (const key in node) {
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(findArgsOrArgTypes);
      } else if (typeof value === 'object') {
        findArgsOrArgTypes(value);
      }
    }
  };

  findArgsOrArgTypes(ast);
  return props;
};

// Replace eval with a safer method to turn AST nodes into a usable object
const evaluateNode = (node) => {
  try {
    if (node.type === 'ObjectExpression') {
      const result = {};
      node.properties.forEach(property => {
        if (property.key && property.value) {
          result[property.key.name || property.key.value] = getNodeValue(property.value);
        }
      });
      return result;
    }
    return getNodeValue(node);
  } catch (error) {
    console.error('Error evaluating node:', error);
    return {};
  }
};

// Convert a given AST node to its corresponding value
const getNodeValue = (node) => {
  switch (node.type) {
    case 'Literal':
      return node.value;
    case 'ObjectExpression':
      return evaluateNode(node); // Process object nodes recursively
    case 'ArrayExpression':
      return node.elements.map(element => getNodeValue(element));
    case 'Identifier':
      return node.name;
    default:
      console.warn('Unsupported node type:', node.type);
      return null;
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
