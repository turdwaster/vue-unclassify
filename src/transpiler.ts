import * as acorn from 'acorn';
import { isDecorated, isDecoratedWith, parseTS } from './astTools';

const removeExports = ['vue-property-decorator', 'vue-facing-decorator', ' Vue ', ' Vue, '];

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
    }
}

function extractTag(data: string, tagName: string) {
    const start = data.indexOf(`<${tagName}`);
    const endTag = `</${tagName}>`;
    const end = data.lastIndexOf(endTag);
    return start >= 0 && end > start ? data.substring(start, end + endTag.length) : undefined;
}

export function transpile(codeText: string) {
    // Fixup: interface before @Component -> syntax error
    codeText = codeText.replace(/@Component[\(\s$]/, ';$&');

    const code = parseTS(codeText);
    let xformed = '';

    function emitLine(text: string | null) {
        if (text?.length)
            xformed += `${text}\n`;
    }

    function emitComments(node: acorn.Node) {
        let comments = code.getCommentsFor(node);
        if (comments?.length) {
            xformed += '\n';
            xformed += comments;
        }
    }

    // Imports
    emitLine('import { ref, computed, watch } from \'vue\'');
    code.ast.body.filter(x => x.type === 'ImportDeclaration')
        .map(code.getSource)
        .filter(x => !removeExports.some(r => x!.includes(r)))
        .map(emitLine);

    // Code outside class
    const ignoredOutsideTypes = ['EmptyStatement', 'ExportDefaultDeclaration', 'ImportDeclaration'];
    const outsideCode = code.ast.body.filter(x => !ignoredOutsideTypes.includes(x.type));
    if (outsideCode?.length) {
        xformed += '\n'
        for (const c of outsideCode) {
            emitComments(c);
            emitLine(code.getSource(c));
        }
    }

    const expDefNode = code.ast.body.find(x => x.type === 'ExportDefaultDeclaration') as acorn.ExportDefaultDeclaration;
    const classNode = expDefNode?.declaration as acorn.ClassDeclaration;
    if (!classNode)
        return xformed;

    emitComments(classNode);

    const memberNodes = classNode.body.body;
    const properties = memberNodes.filter(x => x.type === 'PropertyDefinition') as acorn.PropertyDefinition[];

    // Static non-reactive data (static properties)
    const staticMembers = properties.filter(x => x.static).map(code.deconstructProperty);
    if (staticMembers?.length) {
        emitLine('\n// Static shared data (move to separate script section?)');
        for (const { id, typeStr, node } of staticMembers) {
            emitComments(node);
            emitLine(`const ${id}${typeStr ? ': ' + typeStr : ''}${node.value != null ? ' = ' + code.getSource(node.value) : ''};`);
        }
    }

    // Static non-reactive data (uninitialized instance properties)
    const nonReactiveMembers = properties.filter(x => !x.static && !isDecorated(x) && x.value == null).map(code.deconstructProperty);
    if (nonReactiveMembers?.length) {
        emitLine('\n// Non-reactive data');
        for (const { id, typeStr, node } of nonReactiveMembers) {
            code.deconstructProperty(node);
            emitComments(node);
            emitLine(`let ${id}${typeStr ? ': ' + typeStr : ''};`);
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
            emitComments(node);
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
            emitComments(node);
            emitLine(`const ${id} = ref${typeStr ? (`<${typeStr}>`) : ''}(${code.getSource(node.value)});`);
        }
    }

    // function/lambda body transpilation

    function replaceThisExpr(code: string, member: string, prefix?: string, suffix?: string) {
        const regex = new RegExp(`this\\.${member}([^a-zA-Z0-9])`, 'g');
        return code.replace(regex, `${prefix ?? ''}${member}${suffix ?? ''}$1`)
    }

    const computedIdentifiers: { [id: string]: acorn.Node } = {};

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

        // this.[computed] -> [computed].value
        for (const prop of Object.keys(computedIdentifiers))
            bodyText = replaceThisExpr(bodyText, prop, '', '.value');

        // this.[other member] -> [other member]
        bodyText = bodyText.replace(/([^a-zA-Z0-9])this\./g, '$1');

        return unIndent(bodyText);
    }

    const methods = memberNodes.filter(x => x.type === 'MethodDefinition') as acorn.MethodDefinition[];

    // Computeds
    const computeds = methods.filter(x => !isDecorated(x) && x.kind == 'get').map(code.deconstructProperty);
    if (computeds?.length) {
        emitLine('\n// Computeds');
        for (const { id, node } of computeds) {
            computedIdentifiers[id] = node;
            emitComments(node);
            emitLine(`const ${id} = computed(${transpiledText(node)});`);
        }
    }
    
    // Watches
    const watches = methods.filter(x => isDecoratedWith(x, 'Watch')).map(code.deconstructProperty);
    if (watches?.length) {
        emitLine('\n// Watches');
        for (const { id, node } of watches) {
            const deco = (node as any).decorators[0].expression as acorn.CallExpression;
            const decoArg = (deco.arguments[0] as acorn.Literal).value;
            const decoArg1 = (deco.arguments?.length > 1 ? deco.arguments[1] : null) as acorn.Expression;
            emitComments(node);
            emitLine(`watch(() => ${decoArg}.value, ${transpiledText(node)}${decoArg1 ? (', ' + code.getSource(decoArg1)) : ''});`);
        }
    }

    const plainMethods = methods.filter(x => !isDecorated(x) && x.kind == 'method').map(code.deconstructProperty)

    // Life cycle hooks
    const specialMethods = ['created', 'mounted'];
    const specialFunctions = plainMethods.filter(({ id }) => specialMethods.includes(id));
    if (specialFunctions?.length) {
        emitLine('\n// Initialization');
        for (const { id, node } of specialFunctions) {
            emitComments(node);
            if (id == 'created')
                emitLine(unIndent(transpiledText((node.value! as any).body)).slice(2, -3) + ';\n');
            else if (id == 'mounted')
                emitLine(`onMounted(${transpiledText(node)});\n`);
        }
    }

    // Regular functions
    const functions = plainMethods.filter(({ id, node }) => !node.static && !specialMethods.includes(id));
    if (functions?.length) {
        emitLine('\n// Functions');
        for (const { id, node } of functions) {
            emitComments(node);
            emitLine(`function ${id}${transpiledText(node.value!)}\n`);
        }
    }

    // Regular functions
    const staticFunctions = plainMethods.filter(({ id, node }) => node.static && !specialMethods.includes(id));
    if (staticFunctions?.length) {
        emitLine('\n// Static functions');
        for (const { id, node } of staticFunctions) {
            emitComments(node);
            emitLine(`function ${id}${transpiledText(node.value!)}\n`);
        }
    }

    return xformed;
}

function unIndent(bodyText: string) {
    const lines = bodyText.split('\n');
    const indentRegex = new RegExp('^( {4}|\t)');
    bodyText = lines.map(l => l.replace(indentRegex, '')).join('\n');
    return bodyText;
}

