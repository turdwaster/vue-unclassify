#! /usr/bin/env node
"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var e_1, _a;
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
        try {
            for (var files_1 = __values(files), files_1_1 = files_1.next(); !files_1_1.done; files_1_1 = files_1.next()) {
                var filename = files_1_1.value;
                console.info('\x1b[36mTranspiling ' + filename + '...\x1b[0m');
                var src = (0, fs_1.readFileSync)(filename, { encoding: 'utf-8' });
                var result = (0, sfc_1.joinSFC)((0, sfc_1.transpileSFC)(src));
                if (args.values.replace)
                    (0, fs_1.writeFileSync)(filename, result);
                else
                    console.log(result);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (files_1_1 && !files_1_1.done && (_a = files_1["return"])) _a.call(files_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
}
else
    console.log("Usage: vue-unclassify [--replace] file names/patterns...");
