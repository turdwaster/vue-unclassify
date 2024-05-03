#! /usr/bin/env node
import { splitSFC, transpile } from './src/transpiler';
import { readFileSync } from 'fs';

if (process.argv.length === 3) {
    const filename = process.argv[2];
    console.info('Transpiling ' + filename + '...');
    const src = readFileSync(filename, { encoding: 'utf-8' });
    const parts = splitSFC(src);
    const result = parts?.scriptBody ? transpile(parts.scriptBody) : '';
    console.log(result);
}
