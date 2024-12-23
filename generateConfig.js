#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, resolve, relative } from 'path';
import glob from 'glob';
import { parse } from '@babel/parser';

// Function to get all story files synchronously
const getStoriesFiles = (baseDir) => {
  const pattern = `${baseDir.replace(/\\/g, '/')}/**/*.stories.@(js|jsx|ts|tsx)`;
  console.log('Using glob pattern:', pattern);

  const files = glob.sync(pattern);
  console.log('Found story files:', files);

  return files;
};

// Function to check if a file has a default export
const hasDefaultExport = (filePath) => {
  const code = readFileSync(filePath, 'utf-8');
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'], // For JSX and TypeScript support
  });

  return ast.program.body.some(
    (node) => node.type === 'ExportDefaultDeclaration'
  );
};

// Function to extract metadata and args from the parsed code
const extractMetadata = (code, filePath) => {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'], // For JSX and TypeScript support
  });

  console.log('filePath:', filePath);

  // Extract the parent directory name as the component name
  const componentName = basename(dirname(filePath));
  console.log('componentName:', componentName);

  const metadata = {
    name: componentName.toLowerCase(),
    props: [],
  };

  // Helper function to process args
  const extractArgs = (argsNode) => {
    const args = [];
    argsNode.properties.forEach((prop) => {
      const name = prop.key.name || prop.key.value; // Support computed keys
      let value;

      // Handle different node types for property values
      switch (prop.value.type) {
        case 'StringLiteral':
        case 'NumericLiteral':
        case 'BooleanLiteral':
          value = prop.value.value;
          break;
        case 'ArrayExpression':
          value = prop.value.elements.map((el) =>
            el.type === 'StringLiteral' || el.type === 'NumericLiteral'
              ? el.value
              : null
          );
          break;
        case 'ObjectExpression':
          value = {};
          prop.value.properties.forEach((objProp) => {
            value[objProp.key.name] = objProp.value.value;
          });
          break;
        default:
          value = null; // Fallback for unsupported value types
      }

      args.push({ name, value });
    });
    return args;
  };

  // Process AST to fetch props and args
  ast.program.body.forEach((node) => {
    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'ObjectExpression'
    ) {
      node.declaration.properties.forEach((prop) => {
        if (prop.key.name === 'args') {
          metadata.props = extractArgs(prop.value);
        }
        if (prop.key.name === 'argTypes') {
          metadata.props = extractArgs(prop.value);
        }
      });
    }

    if (
      node.type === 'VariableDeclaration' &&
      node.declarations.some(
        (decl) => decl.id.name === 'meta' && decl.init.type === 'ObjectExpression'
      )
    ) {
      const metaDecl = node.declarations.find(
        (decl) => decl.id.name === 'meta'
      );
      if (metaDecl.init.properties) {
        metaDecl.init.properties.forEach((prop) => {
          if (prop.key.name === 'args') {
            metadata.props = extractArgs(prop.value);
          }
        });
      }
    }

    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration.type === 'VariableDeclaration'
    ) {
      node.declaration.declarations.forEach((decl) => {
        if (
          decl.init.type === 'ObjectExpression' &&
          decl.init.properties.some((prop) => prop.key.name === 'args')
        ) {
          const argsProp = decl.init.properties.find(
            (prop) => prop.key.name === 'args'
          );
          metadata.props = [...metadata.props, ...extractArgs(argsProp.value)];
        }
      });
    }
  });

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
      const metadata = extractMetadata(code, file);

      const componentDir = dirname(file); // Directory containing the component
      console.log('componentDir:', componentDir);
      const componentName = basename(componentDir); // Component name
      console.log('componentName:', componentName);
      const possibleFiles = glob.sync(
        `${componentDir}/${componentName}.@(js|jsx|ts|tsx)`
      );

      if (possibleFiles.length === 0) {
        console.warn(`No component file found for ${componentName}`);
        continue;
      }

      const componentFile = relative(baseDir, possibleFiles[0]).replace(/\\/g, '/'); // Normalize to forward slashes

      if (!hasDefaultExport(possibleFiles[0])) {
        console.warn(`No default export found in ${possibleFiles[0]}`);
        continue;
      }

      console.log('componentFile:', componentFile);

      components.push({
        name: metadata.name,
        version: '1.0.0',
        displayName: metadata.name.replace(/-/g, ' ').toUpperCase(),
        baseDir: './components',
        module: `require('./${componentFile}').default`,
        include: [`./${componentFile}`],
        props: metadata.props,
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
