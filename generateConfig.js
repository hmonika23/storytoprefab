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

  const metadata = {
    name: basename(dirname(filePath)).toLowerCase(),
    props: [],
  };

  let metaObject = null;
  let stories = [];

  // Process AST to fetch props and metadata
  ast.program.body.forEach((node) => {
    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'ObjectExpression'
    ) {
      metaObject = node.declaration;
    }

    if (node.type === 'VariableDeclaration') {
      node.declarations.forEach((declaration) => {
        if (declaration.id.name === 'Basic') {
          stories.push(declaration);
        }
      });
    }
  });

  // Extract args from the `meta` object
  if (metaObject) {
    console.log('metaObject:', metaObject);
    metaObject.properties.forEach((prop) => {
      if (prop.key.name === 'args') {
        const args = {};
        prop.value.properties.forEach((argProp) => {
          args[argProp.key.name] = argProp.value.value;
        });
        metadata.props.push(args);
      }
    });
  }

  // Extract args from stories like `Basic`
  stories.forEach((story) => {
    story.init.properties.forEach((prop) => {
      if (prop.key.name === 'args') {
        const args = {};
        prop.value.properties.forEach((argProp) => {
          args[argProp.key.name] = argProp.value.value;
        });
        metadata.props.push(args);
      }
    });
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
      console.log('metadata:', metadata);
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
