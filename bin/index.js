#! /usr/bin/env node
"use strict";
exports.__esModule = true;
var sfc_1 = require("./src/sfc");
var fs_1 = require("fs");
var node_util_1 = require("node:util");
var glob_1 = require("glob");
var args = (0, node_util_1.parseArgs)({
    allowPositionals: true,
    options: {
        replace: {
            type: 'boolean',
            short: "r"
        }
    }
});
var paths = args.positionals;
if (paths.length) {
    var files = (0, glob_1.globSync)(paths, { nodir: true });
    if (!files.length)
        console.error('No files found for pattern', paths);
    else {
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var filename = files_1[_i];
            console.info('\x1b[36mTranspiling ' + filename + '...\x1b[0m');
            var src = (0, fs_1.readFileSync)(filename, { encoding: 'utf-8' });
            var result = (0, sfc_1.joinSFC)((0, sfc_1.transpileSFC)(src));
            if (args.values.replace)
                (0, fs_1.writeFileSync)(filename, result);
            else
                console.log(result);
        }
    }
}
else
    console.log("Usage: vue-unclassify [--replace] file names/patterns...");
