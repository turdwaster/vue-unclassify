"use strict";
exports.__esModule = true;
exports.transpileSFC = exports.joinSFC = exports.splitSFC = void 0;
var transpiler_1 = require("./transpiler");
function splitSFC(text) {
    var scriptNode = extractTag(text, 'script');
    var scriptBody = undefined;
    if (scriptNode) {
        var start = scriptNode.indexOf('>') + 1;
        var end = scriptNode.lastIndexOf('</');
        if (start > 0 && end > start)
            scriptBody = scriptNode.substring(start, end);
    }
    return {
        templateNode: extractTag(text, 'template'),
        scriptNode: scriptNode,
        scriptBody: scriptBody,
        styleNode: extractTag(text, 'style')
    };
}
exports.splitSFC = splitSFC;
function joinSFC(sfc) {
    var _a, _b, _c;
    var result = '';
    if ((_a = sfc.templateNode) === null || _a === void 0 ? void 0 : _a.length)
        result += "".concat(sfc.templateNode, "\n\n");
    if ((_b = sfc.scriptBody) === null || _b === void 0 ? void 0 : _b.length)
        result += "".concat(sfc.scriptNode, "\n\n");
    if ((_c = sfc.styleNode) === null || _c === void 0 ? void 0 : _c.length)
        result += sfc.styleNode;
    return result;
}
exports.joinSFC = joinSFC;
function transpileSFC(source) {
    var _a, _b;
    var sfc = splitSFC(source);
    if (((_a = sfc.scriptBody) === null || _a === void 0 ? void 0 : _a.length) && !((_b = sfc.scriptNode) === null || _b === void 0 ? void 0 : _b.includes('<script setup'))) {
        sfc.scriptBody = (0, transpiler_1.transpile)(sfc.scriptBody);
        sfc.scriptNode = "<script setup lang=\"ts\">\n".concat(sfc.scriptBody.trimEnd(), "\n</script>");
    }
    return joinSFC(sfc);
}
exports.transpileSFC = transpileSFC;
function extractTag(data, tagName) {
    var start = data.indexOf("<".concat(tagName));
    var endTag = "</".concat(tagName, ">");
    var end = data.lastIndexOf(endTag);
    return start >= 0 && end > start ? data.substring(start, end + endTag.length) : undefined;
}
