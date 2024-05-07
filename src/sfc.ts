import { getNewLine } from './astTools';
import { transpile, transpileTemplate } from './transpiler';

export interface SFCSections {
    templateNode?: string;
    scriptNode?: string;
    scriptBody?: string;
    styleNode?: string;
    newLine: string;
}

export function splitSFC(text: string) {
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

export function joinSFC(sfc: SFCSections) {
    let result = '';
    if (sfc.templateNode?.length)
        result += `${sfc.templateNode}${sfc.newLine}${sfc.newLine}`;
    if (sfc.scriptBody?.length)
        result += `${sfc.scriptNode}${sfc.newLine}${sfc.newLine}`;
    if (sfc.styleNode?.length)
        result += sfc.styleNode;
    return result;
}

export function transpileSFC(source: string) {
    const sfc = splitSFC(source);
    if (sfc.scriptBody?.length && !sfc.scriptNode?.includes('<script setup')) {
        sfc.scriptBody = transpile(sfc.scriptBody);
        sfc.scriptNode = `<script setup lang="ts">${sfc.newLine}${sfc.scriptBody.trimEnd()}${sfc.newLine}</script>`;
    }
    if (sfc.templateNode?.length)
        sfc.templateNode = transpileTemplate(sfc.templateNode);
    return joinSFC(sfc);
}

function extractTag(data: string, tagName: string) {
    const start = data.indexOf(`<${tagName}`);
    const endTag = `</${tagName}>`;
    const end = data.lastIndexOf(endTag);
    return start >= 0 && end > start ? data.substring(start, end + endTag.length) : undefined;
}
