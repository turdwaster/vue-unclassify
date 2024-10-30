import { getNewLine } from './astTools';
import { transpile, transpileTemplate } from './transpiler';
export function splitSFC(text) {
    const newLine = getNewLine(text);
    const scriptNode = extractTag(text, 'script');
    let scriptBody = undefined;
    if (scriptNode) {
        const start = scriptNode.indexOf('>') + 1;
        const end = scriptNode.lastIndexOf('</');
        if (start > 0 && end > start)
            scriptBody = scriptNode.substring(start, end);
    }
    return {
        templateNode: extractTag(text, 'template'),
        scriptNode,
        scriptBody,
        styleNode: extractTag(text, 'style'),
        newLine
    };
}
export function joinSFC(sfc) {
    var _a, _b, _c;
    let result = '';
    if ((_a = sfc.templateNode) === null || _a === void 0 ? void 0 : _a.length)
        result += `${sfc.templateNode}${sfc.newLine}${sfc.newLine}`;
    if ((_b = sfc.scriptBody) === null || _b === void 0 ? void 0 : _b.length)
        result += `${sfc.scriptNode}${sfc.newLine}${sfc.newLine}`;
    if ((_c = sfc.styleNode) === null || _c === void 0 ? void 0 : _c.length)
        result += sfc.styleNode;
    return result;
}
export function transpileSFC(source) {
    var _a, _b, _c;
    const sfc = splitSFC(source);
    const templateContext = { emits: [] };
    if ((_a = sfc.templateNode) === null || _a === void 0 ? void 0 : _a.length)
        sfc.templateNode = transpileTemplate(sfc.templateNode, templateContext);
    if (((_b = sfc.scriptBody) === null || _b === void 0 ? void 0 : _b.length) && !((_c = sfc.scriptNode) === null || _c === void 0 ? void 0 : _c.includes('<script setup'))) {
        sfc.scriptBody = transpile(sfc.scriptBody, templateContext);
        sfc.scriptNode = `<script setup lang="ts">${sfc.newLine}${sfc.scriptBody.trimEnd()}${sfc.newLine}</script>`;
    }
    return sfc;
}
function extractTag(data, tagName) {
    const start = data.indexOf(`<${tagName}`);
    const endTag = `</${tagName}>`;
    const end = data.lastIndexOf(endTag);
    return start >= 0 && end > start ? data.substring(start, end + endTag.length) : undefined;
}
