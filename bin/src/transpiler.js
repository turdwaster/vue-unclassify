"use strict";
exports.__esModule = true;
exports.transpile = exports.transpileTemplate = void 0;
var astTools_1 = require("./astTools");
var removeExports = ['vue-property-decorator', 'vue-class-component', 'vue-facing-decorator', ' Vue ', ' Vue, '];
function transpileTemplate(codeText) {
    return codeText.replace(/\$emit\s?\(/g, 'emit(');
}
exports.transpileTemplate = transpileTemplate;
function transpile(codeText) {
    var _a, _b;
    // Fixup: interface before @Component -> syntax error
    codeText = codeText.replace(/@Component[\(\s$]/, ';$&');
    var code = (0, astTools_1.parseTS)(codeText);
    var xformed = '';
    var issues = [];
    function emitSectionHeader(text) {
        emitLine("// ".concat(text));
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
        var comments = code.getCommentsFor(node);
        if (comments === null || comments === void 0 ? void 0 : comments.length) {
            emitNewLine();
            xformed += comments;
        }
    }
    // Imports
    emitLine('import { ref, computed, watch, onMounted } from \'vue\'');
    code.ast.body.filter(function (x) { return x.type === 'ImportDeclaration'; })
        .map(code.getSource)
        .filter(function (x) { return !removeExports.some(function (r) { return x.includes(r); }); })
        .map(emitLine);
    emitNewLine();
    // Try vue-facing-decorator style class def first (class X extends Vue ... export default X)
    var classNode = code.ast.body.find(function (x) { var _a; return x.type === 'ClassDeclaration' && ((_a = x.superClass) === null || _a === void 0 ? void 0 : _a.type) === 'Identifier' && x.superClass.name === 'Vue'; });
    if (classNode == null) {
        // Try old style (export default class X)
        var expDefNode = code.ast.body.find(function (x) { return x.type === 'ExportDefaultDeclaration'; });
        if (((_a = expDefNode === null || expDefNode === void 0 ? void 0 : expDefNode.declaration) === null || _a === void 0 ? void 0 : _a.type) === 'ClassDeclaration')
            classNode = expDefNode === null || expDefNode === void 0 ? void 0 : expDefNode.declaration;
    }
    var className = classNode && code.getSource(classNode.id);
    // Code outside class
    var ignoredOutsideTypes = ['EmptyStatement', 'ExportDefaultDeclaration', 'ExportNamedDeclaration', 'ImportDeclaration',];
    var outsideCode = code.ast.body.filter(function (x) { return x !== classNode && !ignoredOutsideTypes.includes(x.type); });
    if (outsideCode === null || outsideCode === void 0 ? void 0 : outsideCode.length) {
        for (var _i = 0, outsideCode_1 = outsideCode; _i < outsideCode_1.length; _i++) {
            var c = outsideCode_1[_i];
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
    var memberNodes = classNode.body.body;
    var properties = memberNodes.filter(function (x) { return x.type === 'PropertyDefinition'; });
    // Static non-reactive data (static properties)
    var staticMembers = properties.filter(function (x) { return x.static; }).map(code.deconstructProperty);
    if (staticMembers === null || staticMembers === void 0 ? void 0 : staticMembers.length) {
        emitSectionHeader('Static shared data (move to separate script section?)');
        for (var _c = 0, staticMembers_1 = staticMembers; _c < staticMembers_1.length; _c++) {
            var _d = staticMembers_1[_c], id = _d.id, typeStr = _d.typeStr, node = _d.node;
            emitComments(node);
            var initializer = node.value != null ? ' = ' + code.unIndent(code.getSource(node.value)) : '';
            emitLine("const ".concat(id).concat(typeStr ? ': ' + typeStr : '').concat(initializer, ";"));
        }
        emitNewLine();
    }
    // Static non-reactive data (uninitialized instance properties)
    var nonReactiveMembers = properties.filter(function (x) { return !x.static && !(0, astTools_1.isDecorated)(x) && x.value == null; }).map(code.deconstructProperty);
    if (nonReactiveMembers === null || nonReactiveMembers === void 0 ? void 0 : nonReactiveMembers.length) {
        emitSectionHeader('Non-reactive data');
        for (var _e = 0, nonReactiveMembers_1 = nonReactiveMembers; _e < nonReactiveMembers_1.length; _e++) {
            var _f = nonReactiveMembers_1[_e], id = _f.id, typeStr = _f.typeStr, node = _f.node;
            code.deconstructProperty(node);
            emitComments(node);
            emitLine("let ".concat(id).concat(typeStr ? ': ' + typeStr : '', ";"));
        }
        emitNewLine();
    }
    // Props
    var props = properties.filter(function (x) { return (0, astTools_1.isDecoratedWith)(x, 'Prop'); }).map(code.deconstructProperty);
    var propIdentifiers = {};
    if (props === null || props === void 0 ? void 0 : props.length) {
        emitSectionHeader('Props');
        emitLine('const props = defineProps<{');
        for (var _g = 0, props_1 = props; _g < props_1.length; _g++) {
            var _h = props_1[_g], id = _h.id, typeStr = _h.typeStr, node = _h.node;
            propIdentifiers[id] = node;
            emitComments(node);
            emitLine("\t".concat(id).concat(typeStr ? ': ' + typeStr : '').concat(node.value != null ? ' = ' + code.getSource(node.value) : '', ";"));
        }
        emitLine('}>();');
        emitNewLine();
    }
    // Emits - found by usage
    var emits = {};
    (0, astTools_1.applyRecursively)(classNode.body, function (n) {
        var _a;
        if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression') {
            var name_1 = code.getSource(n.callee.property);
            if (name_1 === '$emit' && ((_a = n.arguments) === null || _a === void 0 ? void 0 : _a.length) >= 1) {
                var eventName = n.arguments[0].value;
                if (typeof eventName === 'string' && !emits[eventName])
                    emits[eventName] = n;
                else
                    issues.push({ message: 'Failed to interpret $emit call', node: n });
            }
        }
    });
    var emitNames = Object.keys(emits);
    if (emitNames.length) {
        emitSectionHeader('Emits');
        emitLine("const emit = defineEmits(['".concat(emitNames.join('\', \''), "']);"));
    }
    // Refs
    var refs = properties.filter(function (x) { return !x.static && !(0, astTools_1.isDecorated)(x) && x.value != null; }).map(code.deconstructProperty);
    var refIdentifiers = {};
    if (refs === null || refs === void 0 ? void 0 : refs.length) {
        emitSectionHeader('State');
        for (var _j = 0, refs_1 = refs; _j < refs_1.length; _j++) {
            var _k = refs_1[_j], id = _k.id, typeStr = _k.typeStr, node = _k.node;
            refIdentifiers[id] = node;
            emitComments(node);
            emitLine("const ".concat(id, " = ref").concat(typeStr ? ("<".concat(typeStr, ">")) : '', "(").concat(code.getSource(node.value), ");"));
        }
        emitNewLine();
    }
    // function/lambda body transpilation
    var thisDot = "([^a-zA-Z0-9]|^)this\\.";
    function replaceThisExpr(code, member, prefix, newName, suffix) {
        var regex = new RegExp("".concat(thisDot).concat(member, "([^a-zA-Z0-9]|$)"), 'g');
        return code.replace(regex, "$1".concat(prefix !== null && prefix !== void 0 ? prefix : '').concat(newName !== null && newName !== void 0 ? newName : member).concat(suffix !== null && suffix !== void 0 ? suffix : '', "$2"));
    }
    var computedIdentifiers = {};
    var staticRefRegexp = new RegExp("([^a-zA-Z0-9]|^)".concat(className, "\\."), 'g');
    var watchRegexp = new RegExp("".concat(thisDot, "\\$watch\\s?\\(\\s?['\"]([^'\"]+)['\"]"), 'g');
    var otherMemberRegexp = new RegExp("".concat(thisDot), 'g');
    function transpiledText(node) {
        var bodyText;
        if (typeof node == 'string')
            bodyText = node;
        else if (node.type === 'MethodDefinition')
            bodyText = code.asLambda(node);
        else
            bodyText = code.getSource(node);
        // this.$watch(...) -> watch(...) (keep `this.` to apply observables etc below)
        bodyText = bodyText.replace(watchRegexp, '$1watch(() => this.$2');
        // this.[prop] -> props.[prop]
        for (var _i = 0, _a = Object.keys(propIdentifiers); _i < _a.length; _i++) {
            var prop = _a[_i];
            bodyText = replaceThisExpr(bodyText, prop, 'props.');
        }
        // this.[observable] -> [observable].value
        for (var _b = 0, _c = Object.keys(refIdentifiers); _b < _c.length; _b++) {
            var prop = _c[_b];
            bodyText = replaceThisExpr(bodyText, prop, '', null, '.value');
        }
        // this.[computed] -> [computed].value
        for (var _d = 0, _e = Object.keys(computedIdentifiers); _d < _e.length; _d++) {
            var prop = _e[_d];
            bodyText = replaceThisExpr(bodyText, prop, '', null, '.value');
        }
        // this.$emit(ev, ...) -> emit(ev, ...)
        bodyText = replaceThisExpr(bodyText, '\\$emit', '', 'emit');
        // this.$nextTick(...) -> nextTick(ev, ...)
        bodyText = replaceThisExpr(bodyText, '\\$nextTick', '', 'nextTick');
        // <className>.method/property (static member reference)
        bodyText = bodyText.replace(staticRefRegexp, '$1');
        // this.[other member] -> [other member]
        bodyText = bodyText.replace(otherMemberRegexp, '$1');
        return code.unIndent(bodyText);
    }
    var methods = memberNodes.filter(function (x) { return x.type === 'MethodDefinition'; });
    // Computeds
    var computeds = methods.filter(function (x) { return !(0, astTools_1.isDecorated)(x) && x.kind == 'get'; }).map(code.deconstructProperty);
    if (computeds === null || computeds === void 0 ? void 0 : computeds.length) {
        // Gather definitions
        for (var _l = 0, computeds_1 = computeds; _l < computeds_1.length; _l++) {
            var _m = computeds_1[_l], id = _m.id, node = _m.node;
            computedIdentifiers[id] = node;
        }
        // Transpile references
        emitSectionHeader('Computeds');
        for (var _o = 0, computeds_2 = computeds; _o < computeds_2.length; _o++) {
            var _p = computeds_2[_o], id = _p.id, node = _p.node;
            emitComments(node);
            emitLine("const ".concat(id, " = computed(").concat(transpiledText(node), ");"));
            emitNewLine();
        }
    }
    // Watches
    var watches = methods.filter(function (x) { return (0, astTools_1.isDecoratedWith)(x, 'Watch'); }).map(code.deconstructProperty);
    if (watches === null || watches === void 0 ? void 0 : watches.length) {
        emitSectionHeader('Watches');
        for (var _q = 0, watches_1 = watches; _q < watches_1.length; _q++) {
            var node = watches_1[_q].node;
            var deco = node.decorators[0].expression;
            var decoArg0 = deco.arguments[0].value;
            var decoArg1 = (((_b = deco.arguments) === null || _b === void 0 ? void 0 : _b.length) > 1 ? deco.arguments[1] : null);
            var watchedExpr = transpiledText("this.".concat(decoArg0));
            var handler = transpiledText(node);
            var extraArg = "".concat(decoArg1 ? (', ' + code.getSource(decoArg1)) : '');
            emitComments(node);
            emitLine("watch(() => ".concat(watchedExpr, ", ").concat(handler).concat(extraArg, ");"));
            emitNewLine();
        }
    }
    var plainMethods = methods.filter(function (x) { return !(0, astTools_1.isDecorated)(x) && x.kind == 'method'; }).map(code.deconstructProperty);
    // Life cycle hooks
    var specialMethods = ['created', 'mounted'];
    var specialFunctions = plainMethods.filter(function (_a) {
        var id = _a.id;
        return specialMethods.includes(id);
    });
    if (specialFunctions === null || specialFunctions === void 0 ? void 0 : specialFunctions.length) {
        emitSectionHeader('Initialization');
        for (var _r = 0, specialFunctions_1 = specialFunctions; _r < specialFunctions_1.length; _r++) {
            var _s = specialFunctions_1[_r], id = _s.id, node = _s.node;
            emitComments(node);
            if (id == 'created')
                emitLine(code.unIndent(transpiledText(node.value.body)).slice(2, -2).trim());
            else if (id == 'mounted')
                emitLine("onMounted(".concat(transpiledText(node), ");"));
            else
                continue;
            emitNewLine();
        }
    }
    // Regular functions
    var functions = plainMethods.filter(function (_a) {
        var id = _a.id, node = _a.node;
        return !node.static && !specialMethods.includes(id);
    });
    if (functions === null || functions === void 0 ? void 0 : functions.length) {
        emitSectionHeader('Functions');
        for (var _t = 0, functions_1 = functions; _t < functions_1.length; _t++) {
            var _u = functions_1[_t], id = _u.id, node = _u.node;
            emitComments(node);
            emitLine("function ".concat(id).concat(transpiledText(node.value)));
            emitNewLine();
        }
    }
    // Static functions
    var staticFunctions = plainMethods.filter(function (_a) {
        var id = _a.id, node = _a.node;
        return node.static && !specialMethods.includes(id);
    });
    if (staticFunctions === null || staticFunctions === void 0 ? void 0 : staticFunctions.length) {
        emitSectionHeader('Static functions');
        for (var _v = 0, staticFunctions_1 = staticFunctions; _v < staticFunctions_1.length; _v++) {
            var _w = staticFunctions_1[_v], id = _w.id, node = _w.node;
            emitComments(node);
            emitLine("function ".concat(id).concat(transpiledText(node.value)));
            emitNewLine();
        }
    }
    // Exports (skip export of Vue class from vue-facing-decorator)
    var exportNodes = code.ast.body.filter(function (x) { return x.type === 'ExportNamedDeclaration'; })
        .filter(function (c) { return code.getSource(c.specifiers[0]) !== className; });
    if (exportNodes === null || exportNodes === void 0 ? void 0 : exportNodes.length) {
        emitSectionHeader('Exports');
        for (var _x = 0, exportNodes_1 = exportNodes; _x < exportNodes_1.length; _x++) {
            var c = exportNodes_1[_x];
            emitComments(c);
            emitLine(code.unIndent(code.getSource(c)));
            emitNewLine();
        }
    }
    if (issues === null || issues === void 0 ? void 0 : issues.length) {
        emitSectionHeader('Transpilation issues');
        issues.forEach(function (x) { var _a, _b, _c, _d; return emitLine("// * ".concat(x.message, " (at ").concat((_b = (_a = x.node.loc) === null || _a === void 0 ? void 0 : _a.start) === null || _b === void 0 ? void 0 : _b.line, ":").concat((_d = (_c = x.node.loc) === null || _c === void 0 ? void 0 : _c.start) === null || _d === void 0 ? void 0 : _d.column, ")")); });
    }
    return xformed;
}
exports.transpile = transpile;
