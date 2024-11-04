"use strict";
exports.__esModule = true;
exports.transpileSFC = exports.joinSFC = exports.splitSFC = void 0;
var astTools_1 = require("./astTools");
var transpiler_1 = require("./transpiler");
function splitSFC(text) {
    var newLine = (0, astTools_1.getNewLine)(text);
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
        styleNode: extractTag(text, 'style'),
        newLine: newLine
    };
}
exports.splitSFC = splitSFC;
function joinSFC(sfc) {
    var _a, _b, _c;
    var result = '';
    if ((_a = sfc.templateNode) === null || _a === void 0 ? void 0 : _a.length)
        result += "".concat(sfc.templateNode).concat(sfc.newLine).concat(sfc.newLine);
    if ((_b = sfc.scriptBody) === null || _b === void 0 ? void 0 : _b.length)
        result += "".concat(sfc.scriptNode).concat(sfc.newLine).concat(sfc.newLine);
    if ((_c = sfc.styleNode) === null || _c === void 0 ? void 0 : _c.length)
        result += sfc.styleNode;
    return result;
}
exports.joinSFC = joinSFC;
function transpileSFC(source) {
    var _a, _b, _c;
    var sfc = splitSFC(source);
    var templateContext = { emits: [] };
    if ((_a = sfc.templateNode) === null || _a === void 0 ? void 0 : _a.length)
        sfc.templateNode = (0, transpiler_1.transpileTemplate)(sfc.templateNode, templateContext);
    if (((_b = sfc.scriptBody) === null || _b === void 0 ? void 0 : _b.length) && !((_c = sfc.scriptNode) === null || _c === void 0 ? void 0 : _c.includes('<script setup'))) {
        sfc.scriptBody = (0, transpiler_1.transpile)(sfc.scriptBody, templateContext);
        sfc.scriptNode = "<script setup lang=\"ts\">".concat(sfc.newLine).concat(sfc.scriptBody.trimEnd()).concat(sfc.newLine, "</script>");
    }
    return sfc;
}
exports.transpileSFC = transpileSFC;
function extractTag(data, tagName) {
    var start = data.indexOf("<".concat(tagName));
    var endTag = "</".concat(tagName, ">");
    var end = data.lastIndexOf(endTag);
    return start >= 0 && end > start ? data.substring(start, end + endTag.length) : undefined;
}
