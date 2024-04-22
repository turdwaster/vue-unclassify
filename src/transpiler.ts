import * as acorn from 'acorn';
import { isDecorated, isDecoratedWith, parseTS } from './astTools';

const removeExports = ['vue-property-decorator'];

export function splitSFC(data: string) {
    const scriptNode = extractTag(data, 'script');
    let scriptBody = undefined;
    if (scriptNode) {
        const start = scriptNode.indexOf('>') + 1;
        const end = scriptNode.lastIndexOf('</');
        if (start > 0 && end > start)
            scriptBody = scriptNode.substring(start, end);
    }

    return {
        templateNode: extractTag(data, 'template'),
        scriptNode,
        scriptBody,
        styleNode: extractTag(data, 'style'),
    }
}

function extractTag(data: string, tagName: string) {
    const start = data.indexOf(`<${tagName}`);
    const endTag = `</${tagName}>`;
    const end = data.lastIndexOf(endTag);
    return start >= 0 && end > start ? data.substring(start, end + endTag.length) : undefined;
}

export function transpile(codeText: string) {
    const code = parseTS(codeText);
    let xformed = '';

    function emitLine(node: acorn.Node | string | null) {
        let text: string | undefined;
        if (typeof node === 'string')
            text = node;
        else {
            const nodeCode = code.getSource(node);
            if (nodeCode?.trim()?.length)
                text = nodeCode;
        }
        if (text != null)
            xformed += `${text}\n`;
    }

    // Imports
    code.ast.body.filter(x => x.type === 'ImportDeclaration')
        .map(code.getSource)
        .filter(x => !removeExports.some(r => x!.includes(r)))
        .map(x => x!.includes('import Vue from') ? 'import { computed, ref, watch } from \'vue\';' : x)
        .map(emitLine);

    const expDefNode = code.ast.body.find(x => x.type === 'ExportDefaultDeclaration') as acorn.ExportDefaultDeclaration;
    const classNode = expDefNode.declaration as acorn.ClassDeclaration;
    if (!classNode)
        return xformed;

    const memberNodes = classNode.body.body;
    const properties = memberNodes.filter(x => x.type === 'PropertyDefinition') as acorn.PropertyDefinition[];

    // Static non-reactive data (static properties)
    const staticMembers = properties.filter(x => x.static).map(code.deconstructProperty);
    if (staticMembers?.length) {
        emitLine('\n// Static shared data (move to separate script section?)');
        for (const { id, typeStr, node } of staticMembers)
            emitLine(`const ${id}${typeStr ? ': ' + typeStr : ''}${node.value != null ? ' = ' + code.getSource(node.value) : ''};`);
    }

    // Static non-reactive data (instance properties)
    const nonReactiveMembers = properties.filter(x => !x.static && !isDecorated(x) && x.value == null).map(code.deconstructProperty);
    if (nonReactiveMembers?.length) {
        emitLine('\n// Non-reactive data');
        for (const { id, typeStr, node } of nonReactiveMembers) {
            code.deconstructProperty(node);
            emitLine(`let ${id}${typeStr ? ': ' + typeStr : ''};`);
            console.debug(node);
        }
    }

    // Props
    const props = properties.filter(x => isDecoratedWith(x, 'Prop')).map(code.deconstructProperty);
    const propIdentifiers: { [id: string]: acorn.Node } = {};
    if (props?.length) {
        emitLine('\n// Props');
        emitLine('const props = defineProps({');
        for (const { id, typeStr, node } of props) {
            propIdentifiers[id] = node;
            emitLine(`\t${id}${typeStr ? ': ' + typeStr : ''}${node.value != null ? ' = ' + code.getSource(node.value) : ''},`);
        }
        emitLine('});');
    }

    // Refs
    const refs = properties.filter(x => !x.static && !isDecorated(x) && x.value != null).map(code.deconstructProperty);
    const refIdentifiers: { [id: string]: acorn.Node } = {};
    if (refs?.length) {
        emitLine('\n// State');
        for (const { id, typeStr, node } of refs) {
            refIdentifiers[id] = node;
            emitLine(`const ${id} = ref<${typeStr}>(${code.getSource(node.value)});`);
        }
    }

    // function/lambda body transpilation

    function replaceThisExpr(code: string, member: string, prefix?: string, suffix?: string) {
        const regex = new RegExp(`this\\.${member}([^a-zA-Z0-9])`, 'g');
        return code.replace(regex, `${prefix ?? ''}${member}${suffix ?? ''}$1`)
    }

    function transpiledText(node: acorn.MethodDefinition | acorn.PropertyDefinition | acorn.Expression) {
        let bodyText: string;
        if (node.type === 'MethodDefinition' || node.type === 'PropertyDefinition')
            bodyText = code.asLambda(node)!;
        else
            bodyText = code.getSource(node)!;

        // this.[prop] -> props.[prop]
        for (const prop of Object.keys(propIdentifiers))
            bodyText = replaceThisExpr(bodyText, prop, 'props.');

        // this.[observable] -> [observable].value
        for (const prop of Object.keys(refIdentifiers))
            bodyText = replaceThisExpr(bodyText, prop, '', '.value');

        // this.[other member] -> [other member]
        bodyText = bodyText.replace(/([^a-zA-Z0-9])this\./g, '$1');

        return unIndent(bodyText);
    }

    const methods = memberNodes.filter(x => x.type === 'MethodDefinition') as acorn.MethodDefinition[];

    // Watches
    const watches = methods.filter(x => isDecoratedWith(x, 'Watch')).map(code.deconstructProperty);
    if (watches?.length) {
        emitLine('\n// Watches');
        for (const { id, node } of watches) {
            const deco = (node as any).decorators[0].expression as acorn.CallExpression;
            const decoArg = (deco.arguments[0] as acorn.Literal).value;
            const decoArg1 = (deco.arguments?.length > 1 ? deco.arguments[1] : null) as acorn.Expression;
            emitLine(`const ${id} = watch(() => ${decoArg}.value, ${transpiledText(node)}${decoArg1 ? (', ' + code.getSource(decoArg1)) : ''});`);
        }
    }

    // Computeds
    const computeds = methods.filter(x => !isDecorated(x) && x.kind == 'get').map(code.deconstructProperty);
    if (computeds?.length) {
        emitLine('\n// Computeds');
        for (const { id, node } of computeds)
            emitLine(`const ${id} = computed(${transpiledText(node)});`);
    }

    const plainMethods = methods.filter(x => !isDecorated(x) && x.kind == 'method').map(code.deconstructProperty)

    // Life cycle hooks
    const specialMethods = ['created', 'mounted'];
    const specialFunctions = plainMethods.filter(({ id }) => specialMethods.includes(id));
    if (specialFunctions?.length) {
        emitLine('\n// Initialization');
        for (const { id, node } of specialFunctions) {
            if (id == 'created')
                emitLine(unIndent(transpiledText((node.value! as any).body)).slice(2, -3) + ';\n');
            else if (id == 'mounted')
                emitLine(`onMounted(${transpiledText(node)});`);
        }
    }

    // Regular functions
    const functions = plainMethods.filter(({ id, node }) => !node.static && !specialMethods.includes(id));
    if (functions?.length) {
        emitLine('\n// Functions');
        for (const { id, node } of functions)
            emitLine(`function ${id}${transpiledText(node.value!)}`);
    }

    // Regular functions
    const staticFunctions = plainMethods.filter(({ id, node }) => node.static && !specialMethods.includes(id));
    if (staticFunctions?.length) {
        emitLine('\n// Static functions');
        for (const { id, node } of staticFunctions)
            emitLine(`function ${id}${transpiledText(node.value!)}`);
    }

    return xformed;
}

function unIndent(bodyText: string) {
    const lines = bodyText.split('\n');
    const indentRegex = new RegExp('^( {4}|\t)');
    bodyText = lines.map(l => l.replace(indentRegex, '')).join('\n');
    return bodyText;
}

