"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
exports.__esModule = true;
exports.transpile = exports.transpileTemplate = void 0;
var astTools_1 = require("./astTools");
var removeExports = ['vue-property-decorator', 'vue-class-component', 'vue-facing-decorator', ' Vue ', ' Vue, '];
function transpileTemplate(codeText, context) {
    var emits = __spreadArray([], __read(codeText.matchAll(/\$emit\s?\(['"]([a-zA-Z0-9]+)['"]/g)), false).map(function (x) { return x[1]; });
    if (context)
        context.emits = __spreadArray([], __read(new Set(emits)), false);
    return codeText.replace(/\$emit\s?\(/g, 'emit(');
}
exports.transpileTemplate = transpileTemplate;
function transpile(codeText, templateContext) {
    var e_1, _a, e_2, _b, e_3, _c, e_4, _d, e_5, _e, e_6, _f, e_7, _g, e_8, _h, e_9, _j, e_10, _k;
    var _l, _m, _o;
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
        if (((_l = expDefNode === null || expDefNode === void 0 ? void 0 : expDefNode.declaration) === null || _l === void 0 ? void 0 : _l.type) === 'ClassDeclaration')
            classNode = expDefNode === null || expDefNode === void 0 ? void 0 : expDefNode.declaration;
    }
    var className = classNode && code.getSource(classNode.id);
    // Code outside class
    var ignoredOutsideTypes = ['EmptyStatement', 'ExportDefaultDeclaration', 'ExportNamedDeclaration', 'ImportDeclaration',];
    var outsideCode = code.ast.body.filter(function (x) { return x !== classNode && !ignoredOutsideTypes.includes(x.type); });
    if (outsideCode === null || outsideCode === void 0 ? void 0 : outsideCode.length) {
        try {
            for (var outsideCode_1 = __values(outsideCode), outsideCode_1_1 = outsideCode_1.next(); !outsideCode_1_1.done; outsideCode_1_1 = outsideCode_1.next()) {
                var c = outsideCode_1_1.value;
                emitComments(c);
                emitLine(code.unIndent(code.getSource(c)));
                emitNewLine();
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (outsideCode_1_1 && !outsideCode_1_1.done && (_a = outsideCode_1["return"])) _a.call(outsideCode_1);
            }
            finally { if (e_1) throw e_1.error; }
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
        try {
            for (var staticMembers_1 = __values(staticMembers), staticMembers_1_1 = staticMembers_1.next(); !staticMembers_1_1.done; staticMembers_1_1 = staticMembers_1.next()) {
                var _p = staticMembers_1_1.value, id = _p.id, typeStr = _p.typeStr, node = _p.node;
                emitComments(node);
                var initializer = node.value != null ? ' = ' + code.unIndent(code.getSource(node.value)) : '';
                emitLine("const ".concat(id).concat(typeStr ? ': ' + typeStr : '').concat(initializer, ";"));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (staticMembers_1_1 && !staticMembers_1_1.done && (_b = staticMembers_1["return"])) _b.call(staticMembers_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        emitNewLine();
    }
    // Static non-reactive data (uninitialized instance properties)
    var nonReactiveMembers = properties.filter(function (x) { return !x.static && !(0, astTools_1.isDecorated)(x) && x.value == null; }).map(code.deconstructProperty);
    if (nonReactiveMembers === null || nonReactiveMembers === void 0 ? void 0 : nonReactiveMembers.length) {
        emitSectionHeader('Non-reactive data');
        try {
            for (var nonReactiveMembers_1 = __values(nonReactiveMembers), nonReactiveMembers_1_1 = nonReactiveMembers_1.next(); !nonReactiveMembers_1_1.done; nonReactiveMembers_1_1 = nonReactiveMembers_1.next()) {
                var _q = nonReactiveMembers_1_1.value, id = _q.id, typeStr = _q.typeStr, node = _q.node;
                code.deconstructProperty(node);
                emitComments(node);
                emitLine("let ".concat(id).concat(typeStr ? ': ' + typeStr : '', ";"));
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (nonReactiveMembers_1_1 && !nonReactiveMembers_1_1.done && (_c = nonReactiveMembers_1["return"])) _c.call(nonReactiveMembers_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        emitNewLine();
    }
    // Props
    var props = properties.filter(function (x) { return (0, astTools_1.isDecoratedWith)(x, 'Prop'); }).map(code.deconstructProperty);
    var propIdentifiers = {};
    if (props === null || props === void 0 ? void 0 : props.length) {
        emitSectionHeader('Props');
        emitLine('const props = defineProps<{');
        try {
            for (var props_1 = __values(props), props_1_1 = props_1.next(); !props_1_1.done; props_1_1 = props_1.next()) {
                var _r = props_1_1.value, id = _r.id, typeStr = _r.typeStr, node = _r.node;
                propIdentifiers[id] = node;
                emitComments(node);
                emitLine("\t".concat(id).concat(typeStr ? ': ' + typeStr : '').concat(node.value != null ? ' = ' + code.getSource(node.value) : '', ";"));
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (props_1_1 && !props_1_1.done && (_d = props_1["return"])) _d.call(props_1);
            }
            finally { if (e_4) throw e_4.error; }
        }
        emitLine('}>();');
        emitNewLine();
    }
    // Emits - found by usage
    var emits = {};
    (_m = templateContext === null || templateContext === void 0 ? void 0 : templateContext.emits) === null || _m === void 0 ? void 0 : _m.forEach(function (x) { return emits[x] = null; });
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
        emitNewLine();
    }
    // Refs
    var refs = properties.filter(function (x) { return !x.static && !(0, astTools_1.isDecorated)(x) && x.value != null; }).map(code.deconstructProperty);
    var refIdentifiers = {};
    if (refs === null || refs === void 0 ? void 0 : refs.length) {
        emitSectionHeader('State');
        try {
            for (var refs_1 = __values(refs), refs_1_1 = refs_1.next(); !refs_1_1.done; refs_1_1 = refs_1.next()) {
                var _s = refs_1_1.value, id = _s.id, typeStr = _s.typeStr, node = _s.node;
                refIdentifiers[id] = node;
                emitComments(node);
                emitLine("const ".concat(id, " = ref").concat(typeStr ? ("<".concat(typeStr, ">")) : '', "(").concat(code.getSource(node.value), ");"));
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (refs_1_1 && !refs_1_1.done && (_e = refs_1["return"])) _e.call(refs_1);
            }
            finally { if (e_5) throw e_5.error; }
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
    function transpiledText(node, unIndent) {
        var e_11, _a, e_12, _b, e_13, _c;
        var bodyText;
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
        try {
            // this.[prop] -> props.[prop]
            for (var _d = __values(Object.keys(propIdentifiers)), _e = _d.next(); !_e.done; _e = _d.next()) {
                var prop = _e.value;
                bodyText = replaceThisExpr(bodyText, prop, 'props.');
            }
        }
        catch (e_11_1) { e_11 = { error: e_11_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d["return"])) _a.call(_d);
            }
            finally { if (e_11) throw e_11.error; }
        }
        try {
            // this.[observable] -> [observable].value
            for (var _f = __values(Object.keys(refIdentifiers)), _g = _f.next(); !_g.done; _g = _f.next()) {
                var prop = _g.value;
                bodyText = replaceThisExpr(bodyText, prop, '', null, '.value');
            }
        }
        catch (e_12_1) { e_12 = { error: e_12_1 }; }
        finally {
            try {
                if (_g && !_g.done && (_b = _f["return"])) _b.call(_f);
            }
            finally { if (e_12) throw e_12.error; }
        }
        try {
            // this.[computed] -> [computed].value
            for (var _h = __values(Object.keys(computedIdentifiers)), _j = _h.next(); !_j.done; _j = _h.next()) {
                var prop = _j.value;
                bodyText = replaceThisExpr(bodyText, prop, '', null, '.value');
            }
        }
        catch (e_13_1) { e_13 = { error: e_13_1 }; }
        finally {
            try {
                if (_j && !_j.done && (_c = _h["return"])) _c.call(_h);
            }
            finally { if (e_13) throw e_13.error; }
        }
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
    var methods = memberNodes.filter(function (x) { return x.type === 'MethodDefinition'; });
    // Computeds
    var computeds = methods.filter(function (x) { return !(0, astTools_1.isDecorated)(x) && x.kind == 'get'; }).map(code.deconstructProperty);
    var computedSetters = new Map(methods.filter(function (x) { return !(0, astTools_1.isDecorated)(x) && x.kind == 'set'; })
        .map(code.deconstructProperty)
        .map(function (x) { return [x.id, x.node]; }));
    if (computeds === null || computeds === void 0 ? void 0 : computeds.length) {
        try {
            // Gather definitions
            for (var computeds_1 = __values(computeds), computeds_1_1 = computeds_1.next(); !computeds_1_1.done; computeds_1_1 = computeds_1.next()) {
                var _t = computeds_1_1.value, id = _t.id, node = _t.node;
                computedIdentifiers[id] = node;
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (computeds_1_1 && !computeds_1_1.done && (_f = computeds_1["return"])) _f.call(computeds_1);
            }
            finally { if (e_6) throw e_6.error; }
        }
        // Transpile references
        emitSectionHeader('Computeds');
        try {
            for (var computeds_2 = __values(computeds), computeds_2_1 = computeds_2.next(); !computeds_2_1.done; computeds_2_1 = computeds_2.next()) {
                var _u = computeds_2_1.value, id = _u.id, node = _u.node;
                var setter = computedSetters.get(id);
                if (setter) {
                    emitComments(node);
                    emitLine("const ".concat(id, " = computed({"));
                    emitComments(node);
                    emitLine("\tget: ".concat(transpiledText(node, false), ","));
                    emitLine("\tset: ".concat(transpiledText(setter, false)));
                    emitLine("});");
                    emitNewLine();
                }
                else {
                    emitComments(node);
                    emitLine("const ".concat(id, " = computed(").concat(transpiledText(node), ");"));
                    emitNewLine();
                }
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (computeds_2_1 && !computeds_2_1.done && (_g = computeds_2["return"])) _g.call(computeds_2);
            }
            finally { if (e_7) throw e_7.error; }
        }
    }
    // Watches
    var watches = methods.filter(function (x) { return (0, astTools_1.isDecoratedWith)(x, 'Watch'); }).map(code.deconstructProperty);
    if (watches === null || watches === void 0 ? void 0 : watches.length) {
        emitSectionHeader('Watches');
        try {
            for (var watches_1 = __values(watches), watches_1_1 = watches_1.next(); !watches_1_1.done; watches_1_1 = watches_1.next()) {
                var node = watches_1_1.value.node;
                var deco = node.decorators[0].expression;
                var decoArg0 = deco.arguments[0].value;
                var decoArg1 = (((_o = deco.arguments) === null || _o === void 0 ? void 0 : _o.length) > 1 ? deco.arguments[1] : null);
                var watchedExpr = transpiledText("this.".concat(decoArg0));
                var handler = transpiledText(node);
                var extraArg = "".concat(decoArg1 ? (', ' + code.getSource(decoArg1)) : '');
                emitComments(node);
                emitLine("watch(() => ".concat(watchedExpr, ", ").concat(handler).concat(extraArg, ");"));
                emitNewLine();
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (watches_1_1 && !watches_1_1.done && (_h = watches_1["return"])) _h.call(watches_1);
            }
            finally { if (e_8) throw e_8.error; }
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
        try {
            for (var specialFunctions_1 = __values(specialFunctions), specialFunctions_1_1 = specialFunctions_1.next(); !specialFunctions_1_1.done; specialFunctions_1_1 = specialFunctions_1.next()) {
                var _v = specialFunctions_1_1.value, id = _v.id, node = _v.node;
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
        catch (e_9_1) { e_9 = { error: e_9_1 }; }
        finally {
            try {
                if (specialFunctions_1_1 && !specialFunctions_1_1.done && (_j = specialFunctions_1["return"])) _j.call(specialFunctions_1);
            }
            finally { if (e_9) throw e_9.error; }
        }
    }
    function emitFunctions(functions) {
        var e_14, _a;
        try {
            for (var functions_1 = __values(functions), functions_1_1 = functions_1.next(); !functions_1_1.done; functions_1_1 = functions_1.next()) {
                var f = functions_1_1.value;
                emitComments(f.node);
                emitLine("".concat(f.async ? 'async ' : '', "function ").concat(f.id).concat(transpiledText(f.node.value)));
                emitNewLine();
            }
        }
        catch (e_14_1) { e_14 = { error: e_14_1 }; }
        finally {
            try {
                if (functions_1_1 && !functions_1_1.done && (_a = functions_1["return"])) _a.call(functions_1);
            }
            finally { if (e_14) throw e_14.error; }
        }
    }
    // Regular functions
    var functions = plainMethods.filter(function (_a) {
        var id = _a.id, node = _a.node;
        return !node.static && !specialMethods.includes(id);
    });
    if (functions === null || functions === void 0 ? void 0 : functions.length) {
        emitSectionHeader('Functions');
        emitFunctions(functions);
    }
    // Static functions
    var staticFunctions = plainMethods.filter(function (_a) {
        var id = _a.id, node = _a.node;
        return node.static && !specialMethods.includes(id);
    });
    if (staticFunctions === null || staticFunctions === void 0 ? void 0 : staticFunctions.length) {
        emitSectionHeader('Static functions');
        emitFunctions(staticFunctions);
    }
    // Exports (skip export of Vue class from vue-facing-decorator)
    var exportNodes = code.ast.body.filter(function (x) { return x.type === 'ExportNamedDeclaration'; })
        .filter(function (c) { return code.getSource(c.specifiers[0]) !== className; });
    if (exportNodes === null || exportNodes === void 0 ? void 0 : exportNodes.length) {
        emitSectionHeader('Exports');
        try {
            for (var exportNodes_1 = __values(exportNodes), exportNodes_1_1 = exportNodes_1.next(); !exportNodes_1_1.done; exportNodes_1_1 = exportNodes_1.next()) {
                var c = exportNodes_1_1.value;
                emitComments(c);
                emitLine(code.unIndent(code.getSource(c)));
                emitNewLine();
            }
        }
        catch (e_10_1) { e_10 = { error: e_10_1 }; }
        finally {
            try {
                if (exportNodes_1_1 && !exportNodes_1_1.done && (_k = exportNodes_1["return"])) _k.call(exportNodes_1);
            }
            finally { if (e_10) throw e_10.error; }
        }
    }
    if (issues === null || issues === void 0 ? void 0 : issues.length) {
        emitSectionHeader('Transpilation issues');
        issues.forEach(function (x) { var _a, _b; return emitLine("// * ".concat(x.message, " (script section, row ").concat((_b = (_a = x.node.loc) === null || _a === void 0 ? void 0 : _a.start) === null || _b === void 0 ? void 0 : _b.line, ")")); });
    }
    return xformed;
}
exports.transpile = transpile;
function reportShadowedProps(node, issues) {
    var e_15, _a;
    var thisUses = [];
    var locals = new Map();
    (0, astTools_1.applyRecursively)(node, function (x) {
        var e_16, _a;
        var _b;
        if (x.type === 'MemberExpression' && x.object.type === 'ThisExpression') {
            var member = x.property.type === 'Identifier' ? x.property.name : null;
            if (member)
                thisUses.push(member);
        }
        else if (x.type === 'VariableDeclaration') {
            try {
                for (var _c = __values(x.declarations), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var decl = _d.value;
                    if (decl.id.type === 'Identifier' && ((_b = decl.init) === null || _b === void 0 ? void 0 : _b.type) !== 'CallExpression' && !locals.has(decl.id.name))
                        locals.set(decl.id.name, decl);
                }
            }
            catch (e_16_1) { e_16 = { error: e_16_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c["return"])) _a.call(_c);
                }
                finally { if (e_16) throw e_16.error; }
            }
        }
    });
    var shadows = new Set(thisUses.filter(function (x) { return locals.has(x); }));
    try {
        for (var shadows_1 = __values(shadows), shadows_1_1 = shadows_1.next(); !shadows_1_1.done; shadows_1_1 = shadows_1.next()) {
            var x = shadows_1_1.value;
            var node_1 = locals.get(x);
            issues.push({
                message: "Local '".concat(x, "' shadows use of member with the same name. Rename to avoid compilation errors."),
                node: node_1
            });
        }
    }
    catch (e_15_1) { e_15 = { error: e_15_1 }; }
    finally {
        try {
            if (shadows_1_1 && !shadows_1_1.done && (_a = shadows_1["return"])) _a.call(shadows_1);
        }
        finally { if (e_15) throw e_15.error; }
    }
}
