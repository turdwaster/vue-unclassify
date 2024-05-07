import { transpile } from './transpiler';

export interface SFCSections {
    templateNode?: string;
    scriptNode?: string;
    scriptBody?: string;
    styleNode?: string;
}

export function splitSFC(text: string) {
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
    };
}

export function joinSFC(sfc: SFCSections) {
    let result = '';
    if (sfc.templateNode?.length)
        result += `${sfc.templateNode}\n\n`;
    if (sfc.scriptBody?.length)
        result += `${sfc.scriptNode}\n\n`;
    if (sfc.styleNode?.length)
        result += sfc.styleNode;
    return result;
}

export function transpileSFC(source: string) {
    const sfc = splitSFC(source);
    if (sfc.scriptBody?.length && !sfc.scriptNode?.includes('<script setup')) {
        sfc.scriptBody = transpile(sfc.scriptBody);
        sfc.scriptNode = `<script setup lang="ts">\n${sfc.scriptBody.trimEnd()}\n</script>`;
    }
    return joinSFC(sfc);
}

function extractTag(data: string, tagName: string) {
    const start = data.indexOf(`<${tagName}`);
    const endTag = `</${tagName}>`;
    const end = data.lastIndexOf(endTag);
    return start >= 0 && end > start ? data.substring(start, end + endTag.length) : undefined;
}
