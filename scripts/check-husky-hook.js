#!/usr/bin/env node
/**
 * check-husky-hook.js
 *
 * Verifies that .husky/pre-commit exists and is executable.
 * Runs as part of the `prepare` lifecycle so developers are alerted
 * immediately after `npm install` if the persona image guard is missing.
 */

const fs = require('fs');
const path = require('path');

const HOOK_PATH = path.resolve(__dirname, '..', '.husky', 'pre-commit');

const RED   = '\x1b[31m';
const YELLOW= '\x1b[33m';
const BOLD  = '\x1b[1m';
const RESET = '\x1b[0m';

function fatal(lines) {
  const bar = '═'.repeat(70);
  console.error('');
  console.error(`${RED}${BOLD}${bar}${RESET}`);
  console.error(`${RED}${BOLD}  ⚠️  PRE-COMMIT HOOK MISSING OR NOT EXECUTABLE${RESET}`);
  console.error(`${RED}${BOLD}${bar}${RESET}`);
  for (const line of lines) {
    console.error(`${YELLOW}  ${line}${RESET}`);
  }
  console.error('');
  console.error(`${YELLOW}  To restore the hook, run:${RESET}`);
  console.error('');
  console.error(`${BOLD}    git config core.hooksPath .husky${RESET}`);
  console.error(`${BOLD}    chmod +x .husky/pre-commit${RESET}`);
  console.error('');
  console.error(`${YELLOW}  The pre-commit hook guards persona portrait integrity.${RESET}`);
  console.error(`${YELLOW}  Without it, broken or duplicate images can slip into commits.${RESET}`);
  console.error(`${RED}${BOLD}${bar}${RESET}`);
  console.error('');
  process.exit(1);
}

// Check existence
let stat;
try {
  stat = fs.statSync(HOOK_PATH);
} catch {
  fatal([
    `File not found: .husky/pre-commit`,
    '',
    'This usually means the repository was cloned without the hook file,',
    'or .husky/ was accidentally deleted.',
  ]);
}

// Check executable bit (owner, group, or other)
const EXEC_MASK = 0o111;
if ((stat.mode & EXEC_MASK) === 0) {
  fatal([
    `File exists but is NOT executable: .husky/pre-commit`,
    `  Current mode: 0${(stat.mode & 0o777).toString(8)}`,
    '',
    'The hook file must have at least one executable bit set.',
  ]);
}

console.log('✓ .husky/pre-commit is present and executable.');
