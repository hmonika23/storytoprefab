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
    (node) =>
      node.type === 'ExportDefaultDeclaration'
  );
};

// Function to extract metadata from the parsed code
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

  // Process AST to fetch props
  ast.program.body.forEach((node) => {
    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'ObjectExpression'
    ) {
      node.declaration.properties.forEach((prop) => {
        if (prop.key.name === 'argTypes' || prop.key.name === 'args') { // Modified condition
          const props = [];
          prop.value.properties.forEach((argProp) => {
            const name = argProp.key.name || argProp.key.value; // Support computed keys
            const details = {};

            argProp.value.properties.forEach((detail) => {
              if (detail.key.name === 'description') {
                details.description = detail.value.value;
              }
              if (detail.key.name === 'defaultValue') {
                if (detail.value.type === 'ArrayExpression') {
                  details.defaultValue = detail.value.elements.map((el) =>
                    el.type === 'ArrayExpression'
                      ? el.elements.map((subEl) => subEl.value)
                      : el.value
                  );
                  details.isList = true;
                  details.type = 'object';
                } else if (detail.value.type === 'ObjectExpression') {
                  details.defaultValue = {};
                  detail.value.properties.forEach((objProp) => {
                    details.defaultValue[objProp.key.name] =
                      objProp.value.value;
                  });
                  details.type = 'object';
                } else {
                  details.defaultValue = detail.value.value;
                  details.type = typeof detail.value.value;
                }
              }
              if (detail.key.name === 'type') {
                details.type = detail.value.properties
                  ? detail.value.properties[0].value.value
                  : 'string';
              }
            });

            props.push({
              name,
              ...details,
            });
          });
          metadata.props = props;
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
