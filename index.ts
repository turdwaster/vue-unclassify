#! /usr/bin/env node
import { transpileSFC } from './src/transpiler';
import { readFileSync, writeFileSync } from 'fs';
import { parseArgs } from 'node:util';
import { globSync } from 'glob';

const args = parseArgs({
  allowPositionals: true,
  options: {
    replace: {
      type: 'boolean',
      short: "r"
    }
  }
});

const paths = args.positionals;
if (paths.length) {
    const files = globSync(paths, { nodir: true });
    for (const filename of files) {
        console.info('\x1b[36mTranspiling ' + filename + '...\x1b[0m');
        const src = readFileSync(filename, { encoding: 'utf-8' });
        const result = transpileSFC(src);
        if (args.values.replace)
            writeFileSync(filename, result);
        else
            console.log(result);
    }
} else
    console.log(`Usage: unclassify [--replace] file names/patterns...`);
