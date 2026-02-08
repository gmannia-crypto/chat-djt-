#!/usr/bin/env node

const idx = process.argv.indexOf('--localhost');
if (idx !== -1) {
  process.argv.splice(idx, 1);
}

require(require.resolve('@expo/cli', { paths: [require.resolve('expo')] }));
