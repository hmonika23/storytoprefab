#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import glob from 'glob';
import * as babelParser from '@babel/parser';

const getStoriesFiles = (baseDir) => {
  const pattern = `${baseDir.replace(/\\/g, '/')}/**/*.stories.@(js|jsx|ts|tsx)`;
  console.log('Using glob pattern:', pattern);
  return glob.sync(pattern);
};

// Simple function to parse and get args/argTypes/props
const parseArgsAndProps = (code) => {
  console.log('Parsing code:', code);
  const props = [];
  
  // Parse the code into an Abstract Syntax Tree (AST)
  const ast = babelParser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  console.log('AST:', ast);
  // Simple recursive function to extract node values
  const extractNodeValue = (node) => {
    switch (node.type) {
      case 'Literal': return node.value;
      case 'ObjectExpression': 
        return node.properties.reduce((acc, { key, value }) => {
          acc[key.name] = extractNodeValue(value);
          return acc;
        }, {});
      case 'ArrayExpression': return node.elements.map(extractNodeValue);
      case 'CallExpression': return `Function(${node.callee.name || 'Unknown function'})`;
      case 'Identifier': return node.name;
      default: return null;
    }
  };
  

  const extractProps = (node) => {
    if (node.type === 'ObjectExpression') {
      node.properties.forEach((property) => {
        if (property.key && property.value) {
          if (property.key.name === 'args' || property.key.name === 'argTypes') {
            props.push({
              name: property.key.name,
              defaultValue: extractNodeValue(property.value),
              isList: Array.isArray(property.value),
            });
          }
        }
      });
    }
  };

  ast.program.body.forEach((node) => extractProps(node));

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

    // Iterate over each story file
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

      const componentFile = relative(baseDir, possibleFiles[0]).replace(/\\/g, '/');

      const props = parseArgsAndProps(code);

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

// Run the function
generatePrefabConfig();
