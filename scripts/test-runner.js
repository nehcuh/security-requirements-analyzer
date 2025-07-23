#!/usr/bin/env node

/**
 * Test Runner Script
 * Provides convenient commands to run different test suites
 */

const { execSync } = require('child_process');
const path = require('path');

const commands = {
  'unit': 'vitest run tests/document-parser.test.js',
  'stac': 'vitest run tests/stac-service.test.js', 
  'integration': 'vitest run tests/integration.test.js',
  'e2e': 'vitest run tests/e2e.test.js',
  'all': 'vitest run',
  'watch': 'vitest',
  'coverage': 'vitest run --coverage'
};

const testType = process.argv[2] || 'all';

if (!commands[testType]) {
  console.log('Available test commands:');
  Object.keys(commands).forEach(cmd => {
    console.log(`  npm run test:${cmd}`);
  });
  process.exit(1);
}

try {
  console.log(`Running ${testType} tests...`);
  execSync(commands[testType], { stdio: 'inherit', cwd: process.cwd() });
} catch (error) {
  console.error(`Test execution failed with exit code: ${error.status}`);
  process.exit(error.status || 1);
}