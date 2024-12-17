#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import glob from 'glob';
import { parse } from '@babel/parser';

// Function to get all .stories.js files synchronously
const getStoriesFiles = (baseDir) => {
  // const pattern = `${baseDir.replace(/\\/g, '/')}/**/*.stories.js`;

  const pattern = `${baseDir.replace(/\\/g, '/')}/**/*.stories.{js,tsx}`;

  console.log('Using glob pattern:', pattern);

  const files = glob.sync(pattern);
  console.log('Found story files:', files);

  return files;
};

// Function to extract metadata from the parsed code

const extractMetadata = (code, filePath) => {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'], // For JSX and TypeScript support
  });

  console.log("ast", ast);

  const metadata = {
    name: basename(filePath).replace(/(\.stories\.js|\.tsx|\.ts)$/, '').toLowerCase(),
    props: [],
  };

  console.log("metadata", metadata);

  ast.program.body.forEach((node) => {
    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'ObjectExpression'
    ) {
      node.declaration.properties.forEach((prop) => {
        if (prop.key.name === 'argTypes') {
          const props = [];
          prop.value.properties.forEach((argProp) => {
            const name = argProp.key.name;
            const details = {};

            argProp.value.properties.forEach((detail) => {
              if (detail.key.name === 'description') {
                details.description = detail.value.value;
              }
              if (detail.key.name === 'defaultValue') {
                // Handle arrays, objects, and primitives
                if (detail.value.type === 'ArrayExpression') {
                  details.defaultValue = detail.value.elements.map((el) =>
                    el.type === 'ArrayExpression'
                      ? el.elements.map((subEl) => subEl.value)
                      : el.value
                  );
                  details.isList = true; // Mark as a list if it's an array
                  details.type = 'object'; // Use 'object' for structured data
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
  const baseDir = resolve(process.cwd(), './components'); // Base directory for story files
  const outputPath = resolve(process.cwd(), './wmprefab.config.json'); // Output file location

  console.log('Base directory:', baseDir);
  console.log('Output path:', outputPath);

  try {
    const storiesFiles = getStoriesFiles(baseDir); // Fetch story files
    const components = [];

    for (const file of storiesFiles) {
      const code = readFileSync(file, 'utf-8'); // Read the story file
      const metadata = extractMetadata(code, file); // Extract metadata

      components.push({
        name: metadata.name,
        version: '1.0.0',
        displayName: metadata.name.replace(/-/g, ' ').toUpperCase(),
        baseDir: './components',
        module: `require('./${metadata.name}/${metadata.name}').default`,
        include: [`./${metadata.name}/${metadata.name}.js`],
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
