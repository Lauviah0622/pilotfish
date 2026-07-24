#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const AGENTS_SRC = path.resolve(__dirname, '../agents');

function usage() {
  console.log('Usage: install.js [--force] <target-directory> [app-name]');
  console.log('');
  console.log('  target-directory  Where to install agents content');
  console.log('  app-name          Optional: install only a specific app (e.g. obsidian-skills, editor-skills)');
  console.log('  --force           Overwrite target if it already exists');
  console.log('');
  console.log('Examples:');
  console.log('  ./install.js /my/project/.claude');
  console.log('  ./install.js /my/project/.claude obsidian-skills');
  console.log('  ./install.js --force /my/project/.claude');
  process.exit(1);
}

const args = process.argv.slice(2);
let force = false;
const positional = [];

for (const arg of args) {
  if (arg === '--force') force = true;
  else if (arg === '--help' || arg === '-h') usage();
  else positional.push(arg);
}

if (positional.length === 0) usage();

const target = positional[0];
const appName = positional[1] ?? '';

let src, dest;

if (appName) {
  src = path.join(AGENTS_SRC, 'skills', appName);
  dest = path.join(target, 'skills', appName);
  if (!fs.existsSync(src)) {
    console.error(`Error: app '${appName}' not found in ${path.join(AGENTS_SRC, 'skills')}`);
    console.error('Available apps:');
    fs.readdirSync(path.join(AGENTS_SRC, 'skills')).forEach(name => console.error(`  ${name}`));
    process.exit(1);
  }
} else {
  src = AGENTS_SRC;
  dest = target;
}

if (fs.existsSync(dest) && !force) {
  console.error(`Error: target already exists: ${dest}`);
  console.error('Use --force to overwrite.');
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true, dereference: true });

console.log(`Installed to: ${dest}`);
