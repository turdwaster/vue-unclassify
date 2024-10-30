import { applyRecursively, isDecorated, isDecoratedWith, parseTS } from './astTools';
const removeExports = ['vue-property-decorator', 'vue-class-component', 'vue-facing-decorator', ' Vue ', ' Vue, '];
export function transpileTemplate(codeText, context) {
    const emits = [...codeText.matchAll(/\$emit\s?\(['"]([a-zA-Z0-9]+)['"]/g)].map(x => x[1]);
    if (context)
        context.emits = [...new Set(emits)];
    return codeText.replace(/\$emit\s?\(/g, 'emit(');
}
export function transpile(codeText, templateContext) {
    var _a, _b, _c;
    // Fixup: interface before @Component -> syntax error
    codeText = codeText.replace(/@Component[\(\s$]/, ';$&');
    const code = parseTS(codeText);
    let xformed = '';
    const issues = [];
    function emitSectionHeader(text) {
        emitLine(`// ${text}`);
    }
    function emitLine(text) {
        var _a;
        if ((_a = text === null || text === void 0 ? void 0 : text.trim()) === null || _a === void 0 ? void 0 : _a.length) {
            xformed += text;
            emitNewLine();
        }
    }
    function emitNewLine() {
        xformed += code.newLine;
    }
    function emitComments(node) {
        const comments = code.getCommentsFor(node);
        if (comments === null || comments === void 0 ? void 0 : comments.length) {
            emitNewLine();
            xformed += comments;
        }
    }
    // Imports
    emitLine('import { ref, computed, watch, onMounted } from \'vue\'');
    code.ast.body.filter(x => x.type === 'ImportDeclaration')
        .map(code.getSource)
        .filter((x) => !removeExports.some(r => x.includes(r)))
        .map(emitLine);
    emitNewLine();
    // Try vue-facing-decorator style class def first (class X extends Vue ... export default X)
    let classNode = code.ast.body.find(x => { var _a; return x.type === 'ClassDeclaration' && ((_a = x.superClass) === null || _a === void 0 ? void 0 : _a.type) === 'Identifier' && x.superClass.name === 'Vue'; });
    if (classNode == null) {
        // Try old style (export default class X)
        const expDefNode = code.ast.body.find(x => x.type === 'ExportDefaultDeclaration');
        if (((_a = expDefNode === null || expDefNode === void 0 ? void 0 : expDefNode.declaration) === null || _a === void 0 ? void 0 : _a.type) === 'ClassDeclaration')
            classNode = expDefNode === null || expDefNode === void 0 ? void 0 : expDefNode.declaration;
    }
    const className = classNode && code.getSource(classNode.id);
    // Code outside class
    const ignoredOutsideTypes = ['EmptyStatement', 'ExportDefaultDeclaration', 'ExportNamedDeclaration', 'ImportDeclaration',];
    const outsideCode = code.ast.body.filter(x => x !== classNode && !ignoredOutsideTypes.includes(x.type));
    if (outsideCode === null || outsideCode === void 0 ? void 0 : outsideCode.length) {
        for (const c of outsideCode) {
            emitComments(c);
            emitLine(code.unIndent(code.getSource(c)));
            emitNewLine();
        }
    }
    if (!classNode) {
        emitSectionHeader('Transpilation failed; could not identify component class node');
        return xformed;
    }
    emitComments(classNode);
    const memberNodes = classNode.body.body;
    const properties = memberNodes.filter(x => x.type === 'PropertyDefinition');
    // Static non-reactive data (static properties)
    const staticMembers = properties.filter(x => x.static).map(code.deconstructProperty);
    if (staticMembers === null || staticMembers === void 0 ? void 0 : staticMembers.length) {
        emitSectionHeader('Static shared data (move to separate script section?)');
        for (const { id, typeStr, node } of staticMembers) {
            emitComments(node);
            const initializer = node.value != null ? ' = ' + code.unIndent(code.getSource(node.value)) : '';
            emitLine(`const ${id}${typeStr ? ': ' + typeStr : ''}${initializer};`);
        }
        emitNewLine();
    }
    // Static non-reactive data (uninitialized instance properties)
    const nonReactiveMembers = properties.filter(x => !x.static && !isDecorated(x) && x.value == null).map(code.deconstructProperty);
    if (nonReactiveMembers === null || nonReactiveMembers === void 0 ? void 0 : nonReactiveMembers.length) {
        emitSectionHeader('Non-reactive data');
        for (const { id, typeStr, node } of nonReactiveMembers) {
            code.deconstructProperty(node);
            emitComments(node);
            emitLine(`let ${id}${typeStr ? ': ' + typeStr : ''};`);
        }
        emitNewLine();
    }
    // Props
    const props = properties.filter(x => isDecoratedWith(x, 'Prop')).map(code.deconstructProperty);
    const propIdentifiers = {};
    if (props === null || props === void 0 ? void 0 : props.length) {
        emitSectionHeader('Props');
        emitLine('const props = defineProps<{');
        for (const { id, typeStr, node } of props) {
            propIdentifiers[id] = node;
            emitComments(node);
            emitLine(`\t${id}${typeStr ? ': ' + typeStr : ''}${node.value != null ? ' = ' + code.getSource(node.value) : ''};`);
        }
        emitLine('}>();');
        emitNewLine();
    }
    // Emits - found by usage
    const emits = {};
    (_b = templateContext === null || templateContext === void 0 ? void 0 : templateContext.emits) === null || _b === void 0 ? void 0 : _b.forEach(x => emits[x] = null);
    applyRecursively(classNode.body, n => {
        var _a;
        if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression') {
            const name = code.getSource(n.callee.property);
            if (name === '$emit' && ((_a = n.arguments) === null || _a === void 0 ? void 0 : _a.length) >= 1) {
                const eventName = n.arguments[0].value;
                if (typeof eventName === 'string' && !emits[eventName])
                    emits[eventName] = n;
                else
                    issues.push({ message: 'Failed to interpret $emit call', node: n });
            }
        }
    });
    const emitNames = Object.keys(emits);
    if (emitNames.length) {
        emitSectionHeader('Emits');
        emitLine(`const emit = defineEmits(['${emitNames.join('\', \'')}']);`);
        emitNewLine();
    }
    // Refs
    const refs = properties.filter(x => !x.static && !isDecorated(x) && x.value != null).map(code.deconstructProperty);
    const refIdentifiers = {};
    if (refs === null || refs === void 0 ? void 0 : refs.length) {
        emitSectionHeader('State');
        for (const { id, typeStr, node } of refs) {
            refIdentifiers[id] = node;
            emitComments(node);
            emitLine(`const ${id} = ref${typeStr ? (`<${typeStr}>`) : ''}(${code.getSource(node.value)});`);
        }
        emitNewLine();
    }
    // function/lambda body transpilation
    const thisDot = `([^a-zA-Z0-9]|^)this\\.`;
    function replaceThisExpr(code, member, prefix, newName, suffix) {
        const regex = new RegExp(`${thisDot}${member}([^a-zA-Z0-9]|$)`, 'g');
        return code.replace(regex, `$1${prefix !== null && prefix !== void 0 ? prefix : ''}${newName !== null && newName !== void 0 ? newName : member}${suffix !== null && suffix !== void 0 ? suffix : ''}$2`);
    }
    const computedIdentifiers = {};
    const staticRefRegexp = new RegExp(`([^a-zA-Z0-9]|^)${className}\\.`, 'g');
    const watchRegexp = new RegExp(`${thisDot}\\$watch\\s?\\(\\s?['"]([^'"]+)['"]`, 'g');
    const otherMemberRegexp = new RegExp(`${thisDot}`, 'g');
    function transpiledText(node, unIndent) {
        let bodyText;
        if (typeof node == 'string')
            bodyText = node;
        else if (node.type === 'MethodDefinition')
            bodyText = code.asLambda(node);
        else
            bodyText = code.getSource(node);
        // this.$watch(...) -> watch(...) (keep `this.` to apply observables etc below)
        bodyText = bodyText.replace(watchRegexp, '$1watch(() => this.$2');
        if (typeof node !== 'string')
            reportShadowedProps(node, issues);
        // this.[prop] -> props.[prop]
        for (const prop of Object.keys(propIdentifiers))
            bodyText = replaceThisExpr(bodyText, prop, 'props.');
        // this.[observable] -> [observable].value
        for (const prop of Object.keys(refIdentifiers))
            bodyText = replaceThisExpr(bodyText, prop, '', null, '.value');
        // this.[computed] -> [computed].value
        for (const prop of Object.keys(computedIdentifiers))
            bodyText = replaceThisExpr(bodyText, prop, '', null, '.value');
        // this.$emit(ev, ...) -> emit(ev, ...)
        bodyText = replaceThisExpr(bodyText, '\\$emit', '', 'emit');
        // this.$nextTick(...) -> nextTick(ev, ...)
        bodyText = replaceThisExpr(bodyText, '\\$nextTick', '', 'nextTick');
        // <className>.method/property (static member reference)
        bodyText = bodyText.replace(staticRefRegexp, '$1');
        // this.[other member] -> [other member]
        bodyText = bodyText.replace(otherMemberRegexp, '$1');
        if (unIndent === false)
            return bodyText;
        return code.unIndent(bodyText);
    }
    const methods = memberNodes.filter(x => x.type === 'MethodDefinition');
    // Computeds
    const computeds = methods.filter(x => !isDecorated(x) && x.kind == 'get').map(code.deconstructProperty);
    const computedSetters = new Map(methods.filter(x => !isDecorated(x) && x.kind == 'set')
        .map(code.deconstructProperty)
        .map(x => [x.id, x.node]));
    if (computeds === null || computeds === void 0 ? void 0 : computeds.length) {
        // Gather definitions
        for (const { id, node } of computeds)
            computedIdentifiers[id] = node;
        // Transpile references
        emitSectionHeader('Computeds');
        for (const { id, node } of computeds) {
            const setter = computedSetters.get(id);
            if (setter) {
                emitComments(node);
                emitLine(`const ${id} = computed({`);
                emitComments(node);
                emitLine(`\tget: ${transpiledText(node, false)},`);
                emitLine(`\tset: ${transpiledText(setter, false)}`);
                emitLine(`});`);
                emitNewLine();
            }
            else {
                emitComments(node);
                emitLine(`const ${id} = computed(${transpiledText(node)});`);
                emitNewLine();
            }
        }
    }
    // Watches
    const watches = methods.filter(x => isDecoratedWith(x, 'Watch')).map(code.deconstructProperty);
    if (watches === null || watches === void 0 ? void 0 : watches.length) {
        emitSectionHeader('Watches');
        for (const { node } of watches) {
            const deco = node.decorators[0].expression;
            const decoArg0 = deco.arguments[0].value;
            const decoArg1 = (((_c = deco.arguments) === null || _c === void 0 ? void 0 : _c.length) > 1 ? deco.arguments[1] : null);
            const watchedExpr = transpiledText(`this.${decoArg0}`);
            const handler = transpiledText(node);
            const extraArg = `${decoArg1 ? (', ' + code.getSource(decoArg1)) : ''}`;
            emitComments(node);
            emitLine(`watch(() => ${watchedExpr}, ${handler}${extraArg});`);
            emitNewLine();
        }
    }
    const plainMethods = methods.filter(x => !isDecorated(x) && x.kind == 'method').map(code.deconstructProperty);
    // Life cycle hooks
    const specialMethods = ['created', 'mounted'];
    const specialFunctions = plainMethods.filter(({ id }) => specialMethods.includes(id));
    if (specialFunctions === null || specialFunctions === void 0 ? void 0 : specialFunctions.length) {
        emitSectionHeader('Initialization');
        for (const { id, node } of specialFunctions) {
            emitComments(node);
            if (id == 'created')
                emitLine(code.unIndent(transpiledText(node.value.body)).slice(2, -2).trim());
            else if (id == 'mounted')
                emitLine(`onMounted(${transpiledText(node)});`);
            else
                continue;
            emitNewLine();
        }
    }
    function emitFunctions(functions) {
        for (const f of functions) {
            emitComments(f.node);
            emitLine(`${f.async ? 'async ' : ''}function ${f.id}${transpiledText(f.node.value)}`);
            emitNewLine();
        }
    }
    // Regular functions
    const functions = plainMethods.filter(({ id, node }) => !node.static && !specialMethods.includes(id));
    if (functions === null || functions === void 0 ? void 0 : functions.length) {
        emitSectionHeader('Functions');
        emitFunctions(functions);
    }
    // Static functions
    const staticFunctions = plainMethods.filter(({ id, node }) => node.static && !specialMethods.includes(id));
    if (staticFunctions === null || staticFunctions === void 0 ? void 0 : staticFunctions.length) {
        emitSectionHeader('Static functions');
        emitFunctions(staticFunctions);
    }
    // Exports (skip export of Vue class from vue-facing-decorator)
    const exportNodes = code.ast.body.filter(x => x.type === 'ExportNamedDeclaration')
        .filter(c => code.getSource(c.specifiers[0]) !== className);
    if (exportNodes === null || exportNodes === void 0 ? void 0 : exportNodes.length) {
        emitSectionHeader('Exports');
        for (const c of exportNodes) {
            emitComments(c);
            emitLine(code.unIndent(code.getSource(c)));
            emitNewLine();
        }
    }
    if (issues === null || issues === void 0 ? void 0 : issues.length) {
        emitSectionHeader('Transpilation issues');
        issues.forEach(x => { var _a, _b; return emitLine(`// * ${x.message} (script section, row ${(_b = (_a = x.node.loc) === null || _a === void 0 ? void 0 : _a.start) === null || _b === void 0 ? void 0 : _b.line})`); });
    }
    return xformed;
}
function reportShadowedProps(node, issues) {
    const thisUses = [];
    const locals = new Map();
    applyRecursively(node, x => {
        var _a;
        if (x.type === 'MemberExpression' && x.object.type === 'ThisExpression') {
            const member = x.property.type === 'Identifier' ? x.property.name : null;
            if (member)
                thisUses.push(member);
        }
        else if (x.type === 'VariableDeclaration') {
            for (const decl of x.declarations) {
                if (decl.id.type === 'Identifier' && ((_a = decl.init) === null || _a === void 0 ? void 0 : _a.type) !== 'CallExpression' && !locals.has(decl.id.name))
                    locals.set(decl.id.name, decl);
            }
        }
    });
    const shadows = new Set(thisUses.filter(x => locals.has(x)));
    for (const x of shadows) {
        const node = locals.get(x);
        issues.push({
            message: `Local '${x}' shadows use of member with the same name. Rename to avoid compilation errors.`,
            node: node
        });
    }
}
