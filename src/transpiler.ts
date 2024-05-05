import { AnyNode, CallExpression, ClassDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration,
    Expression, Literal, MethodDefinition, PropertyDefinition } from 'acorn';
import { applyRecursively, isDecorated, isDecoratedWith, parseTS } from './astTools';

const removeExports = ['vue-property-decorator', 'vue-class-component', 'vue-facing-decorator', ' Vue ', ' Vue, '];

interface SFCSections {
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
    }
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

export function transpile(codeText: string) {
    // Fixup: interface before @Component -> syntax error
    codeText = codeText.replace(/@Component[\(\s$]/, ';$&');

    const code = parseTS(codeText);
    let xformed = '';
    const issues: { message: string, node: AnyNode }[] = [];

    function emitSectionHeader(text: string | null) {
        xformed += `// ${text}\n`;
    }

    function emitLine(text: string | null) {
        if (text?.length) {
            if (text === '\n')
                xformed += text;
            else
                xformed += `${text}\n`;
        }
    }

    function emitComments(node: AnyNode) {
        let comments = code.getCommentsFor(node);
        if (comments?.length) {
            xformed += '\n';
            xformed += comments;
        }
    }

    // Imports
    emitLine('import { ref, computed, watch, onMounted } from \'vue\'');
    code.ast.body.filter(x => x.type === 'ImportDeclaration')
        .map(code.getSource)
        .filter((x: string | null) => !removeExports.some(r => x!.includes(r)))
        .map(emitLine);
    emitLine('\n');

    // Try vue-facing-decorator style class def first (class X extends Vue ... export default X)
    let classNode = code.ast.body.find(x => x.type === 'ClassDeclaration' && x.superClass?.type === 'Identifier' && x.superClass.name === 'Vue') as ClassDeclaration;
    if (classNode == null) {
        // Try old style (export default class X)
        const expDefNode = code.ast.body.find(x => x.type === 'ExportDefaultDeclaration') as ExportDefaultDeclaration;
        if (expDefNode?.declaration?.type === 'ClassDeclaration')
            classNode = expDefNode?.declaration as ClassDeclaration;
    }

    const className = classNode && code.getSource(classNode.id);

    // Code outside class
    const ignoredOutsideTypes = ['EmptyStatement', 'ExportDefaultDeclaration', 'ExportNamedDeclaration', 'ImportDeclaration',];
    const outsideCode = code.ast.body.filter(x => x !== classNode && !ignoredOutsideTypes.includes(x.type));
    if (outsideCode?.length) {
        for (const c of outsideCode) {
            emitComments(c);
            emitLine(unIndent(code.getSource(c)! + '\n'));
        }
    }

    if (!classNode) {
        emitSectionHeader('Transpilation failed; could not identify component class node');
        return xformed;
    }

    emitComments(classNode);

    const memberNodes = classNode.body.body;
    const properties = memberNodes.filter(x => x.type === 'PropertyDefinition') as any as PropertyDefinition[];

    // Static non-reactive data (static properties)
    const staticMembers = properties.filter(x => x.static).map(code.deconstructProperty);
    if (staticMembers?.length) {
        emitSectionHeader('Static shared data (move to separate script section?)');
        for (const { id, typeStr, node } of staticMembers) {
            emitComments(node);
            const initializer = node.value != null ? ' = ' + unIndent(code.getSource(node.value)!) : '';
            emitLine(`const ${id}${typeStr ? ': ' + typeStr : ''}${initializer};`);
        }
        emitLine('\n');
    }

    // Static non-reactive data (uninitialized instance properties)
    const nonReactiveMembers = properties.filter(x => !x.static && !isDecorated(x) && x.value == null).map(code.deconstructProperty);
    if (nonReactiveMembers?.length) {
        emitSectionHeader('Non-reactive data');
        for (const { id, typeStr, node } of nonReactiveMembers) {
            code.deconstructProperty(node);
            emitComments(node);
            emitLine(`let ${id}${typeStr ? ': ' + typeStr : ''};`);
        }
        emitLine('\n');
    }

    // Props
    const props = properties.filter(x => isDecoratedWith(x, 'Prop')).map(code.deconstructProperty);
    const propIdentifiers: { [id: string]: AnyNode } = {};
    if (props?.length) {
        emitSectionHeader('Props');
        emitLine('const props = defineProps({');
        for (const { id, typeStr, node } of props) {
            propIdentifiers[id] = node;
            emitComments(node);
            emitLine(`\t${id}${typeStr ? ': ' + typeStr : ''}${node.value != null ? ' = ' + code.getSource(node.value) : ''},`);
        }
        emitLine('});\n');
    }

    // Emits - found by usage
    const emits: { [id: string]: AnyNode } = {};
    applyRecursively(classNode.body, n => {
        if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression') {
            const name = code.getSource(n.callee.property);
            if (name === '$emit' && n.arguments?.length >= 1) {
                const eventName = (n.arguments[0] as Literal).value;
                if (typeof eventName === 'string' && !emits[eventName])
                    emits[eventName] = n;
                else
                    issues.push({ message: 'Failed to interpret $emit call', node: n })
            }
        }
    });
    const emitNames = Object.keys(emits);
    if (emitNames.length) {
        emitSectionHeader('Emits');
        emitLine(`const emit = defineEmits(['${emitNames.join('\', \'')}']);\n`);
    }

    // Refs
    const refs = properties.filter(x => !x.static && !isDecorated(x) && x.value != null).map(code.deconstructProperty);
    const refIdentifiers: { [id: string]: AnyNode } = {};
    if (refs?.length) {
        emitSectionHeader('State');
        for (const { id, typeStr, node } of refs) {
            refIdentifiers[id] = node;
            emitComments(node);
            emitLine(`const ${id} = ref${typeStr ? (`<${typeStr}>`) : ''}(${code.getSource(node.value)});`);
        }
        emitLine('\n');
    }

    // function/lambda body transpilation

    function replaceThisExpr(code: string, member: string, prefix?: string, suffix?: string) {
        const regex = new RegExp(`([^a-zA-Z0-9])this\\.${member}([^a-zA-Z0-9])`, 'g');
        return code.replace(regex, `$1${prefix ?? ''}${member}${suffix ?? ''}$2`)
    }

    const computedIdentifiers: { [id: string]: AnyNode } = {};
    const staticRefRegexp = new RegExp(`([^a-zA-Z0-9])${className}\\.`, 'g');
    const emitRegexp = new RegExp(`([^a-zA-Z0-9])this\\.\\$emit(\\s?\\()`, 'g');
    const watchRegexp = new RegExp(`([^a-zA-Z0-9])this\\.\\$watch\\s?\\(\\s?['"]([^'"]+)['"]`, 'g');
    const otherMemberRegexp = new RegExp(`([^a-zA-Z0-9])this\\.`, 'g');

    function transpiledText(node: MethodDefinition | PropertyDefinition | Expression) {
        let bodyText: string;
        if (node.type === 'MethodDefinition' || node.type === 'PropertyDefinition')
            bodyText = code.asLambda(node)!;
        else
            bodyText = code.getSource(node)!;

        // this.$watch(...) -> watch(...) (keep `this.` to apply observables etc below)
        bodyText = bodyText.replace(watchRegexp, '$1watch(() => this.$2');

        // this.[prop] -> props.[prop]
        for (const prop of Object.keys(propIdentifiers))
            bodyText = replaceThisExpr(bodyText, prop, 'props.');

        // this.[observable] -> [observable].value
        for (const prop of Object.keys(refIdentifiers))
            bodyText = replaceThisExpr(bodyText, prop, '', '.value');

        // this.[computed] -> [computed].value
        for (const prop of Object.keys(computedIdentifiers))
            bodyText = replaceThisExpr(bodyText, prop, '', '.value');

        // this.$emit(ev, ...) -> emit(ev, ...)
        bodyText = bodyText.replace(emitRegexp, '$1emit$2');

        // <className>.method/property (static member reference)
        bodyText = bodyText.replace(staticRefRegexp, '$1');

        // this.[other member] -> [other member]
        bodyText = bodyText.replace(otherMemberRegexp, '$1');

        return unIndent(bodyText);
    }

    const methods = memberNodes.filter(x => x.type === 'MethodDefinition') as MethodDefinition[];

    // Computeds
    const computeds = methods.filter(x => !isDecorated(x) && x.kind == 'get').map(code.deconstructProperty);
    if (computeds?.length) {
        emitSectionHeader('Computeds');
        for (const { id, node } of computeds) {
            computedIdentifiers[id] = node;
            emitComments(node);
            emitLine(`const ${id} = computed(${transpiledText(node)});\n`);
        }
    }
    
    // Watches
    const watches = methods.filter(x => isDecoratedWith(x, 'Watch')).map(code.deconstructProperty);
    if (watches?.length) {
        emitSectionHeader('Watches');
        for (const { node } of watches) {
            const deco = (node as any).decorators[0].expression as CallExpression;
            const decoArg = (deco.arguments[0] as Literal).value;
            const decoArg1 = (deco.arguments?.length > 1 ? deco.arguments[1] : null) as Expression;
            emitComments(node);
            emitLine(`watch(() => ${decoArg}.value, ${transpiledText(node)}${decoArg1 ? (', ' + code.getSource(decoArg1)) : ''});\n`);
        }
    }

    const plainMethods = methods.filter(x => !isDecorated(x) && x.kind == 'method').map(code.deconstructProperty)

    // Life cycle hooks
    const specialMethods = ['created', 'mounted'];
    const specialFunctions = plainMethods.filter(({ id }) => specialMethods.includes(id));
    if (specialFunctions?.length) {
        emitSectionHeader('Initialization');
        for (const { id, node } of specialFunctions) {
            emitComments(node);
            if (id == 'created')
                emitLine(unIndent(transpiledText((node.value! as any).body)).slice(2, -3) + '\n');
            else if (id == 'mounted')
                emitLine(`onMounted(${transpiledText(node)});\n`);
        }
    }

    // Regular functions
    const functions = plainMethods.filter(({ id, node }) => !node.static && !specialMethods.includes(id));
    if (functions?.length) {
        emitSectionHeader('Functions');
        for (const { id, node } of functions) {
            emitComments(node);
            emitLine(`function ${id}${transpiledText(node.value!)}\n`);
        }
    }

    // Static functions
    const staticFunctions = plainMethods.filter(({ id, node }) => node.static && !specialMethods.includes(id));
    if (staticFunctions?.length) {
        emitSectionHeader('Static functions');
        for (const { id, node } of staticFunctions) {
            emitComments(node);
            emitLine(`function ${id}${transpiledText(node.value!)}\n`);
        }
    }

    // Exports (skip export of Vue class from vue-facing-decorator)
    const exportNodes = code.ast.body.filter(x => x.type === 'ExportNamedDeclaration')
        .filter(c => code.getSource((c as ExportNamedDeclaration).specifiers[0]) !== className);
    if (exportNodes?.length) {
        emitSectionHeader('Exports');
        for (const c of exportNodes) {
            emitComments(c);
            emitLine(unIndent(code.getSource(c)! + '\n'));
        }
    }

    if (issues?.length) {
        emitSectionHeader('Transpilation issues');
        issues.forEach(x => emitLine(`// * ${x.message} (at ${x.node.loc?.start?.line}:${x.node.loc?.start?.column})`));
    }

    return xformed;
}

const indentRegex = /^([ \t]+)(?:[^\s]|$)/;

function unIndent(bodyText: string) {
    let lines = bodyText.split('\n');
    if (lines.length > 1) {
        let minIndent: string | null = null;
        for (const line of lines) {
            const lineIndent = indentRegex.exec(line)?.[1];
            if (lineIndent?.length && (minIndent == null || lineIndent.length < minIndent.length))
                minIndent = lineIndent;
        }

        if (minIndent?.length)
            bodyText = lines.map(l => l.replace(minIndent!, '')).join('\n');
    }
    return bodyText;
}
