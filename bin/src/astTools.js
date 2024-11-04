"use strict";
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
exports.__esModule = true;
exports.unIndent = exports.applyRecursively = exports.decorators = exports.isDecoratedWith = exports.isDecorated = exports.getNewLine = exports.parseTS = void 0;
var acorn_1 = require("acorn");
var acorn_typescript_1 = require("acorn-typescript");
function parseTS(code) {
    var _a, _b;
    var newLine = getNewLine(code);
    var parser = acorn_1.Parser.extend((0, acorn_typescript_1.tsPlugin)());
    try {
        var comments = [];
        var ast = parser.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            onComment: comments,
            locations: true // Required for acorn-typescript
        });
        fixBrokenSourceRanges(ast);
        var commentLines = mapComments(code, newLine, comments);
        return {
            ast: ast,
            getSource: asSource.bind(null, code),
            deconstructProperty: deconstructProperty.bind(null, code),
            asLambda: asLambda.bind(null, code),
            getCommentsFor: getCommentsBefore.bind(null, code, commentLines),
            unIndent: unIndent.bind(null, code, newLine),
            newLine: newLine
        };
    }
    catch (ex) {
        var msg = '// Transpilation failure - ' + ((_a = ex === null || ex === void 0 ? void 0 : ex.message) !== null && _a !== void 0 ? _a : JSON.stringify(ex));
        if ((_b = ex.loc) === null || _b === void 0 ? void 0 : _b.line)
            msg += newLine + (code === null || code === void 0 ? void 0 : code.split(newLine).slice(ex.loc.line - 1, ex.loc.line));
        throw new Error(msg);
    }
}
exports.parseTS = parseTS;
function fixBrokenSourceRanges(ast) {
    // Repair buggy node source ranges (acorn-typescript bug?)
    applyRecursively(ast, function (n) {
        var _a, _b;
        if (n.end < n.start) {
            var locStart = ((_a = n.loc) === null || _a === void 0 ? void 0 : _a.start).index;
            var locEnd = ((_b = n.loc) === null || _b === void 0 ? void 0 : _b.end).index;
            if (locStart === n.start && locEnd >= locStart) {
                // console.debug(`Adjusted broken range (${n.start}-${n.end}) to (${n.start}-${locEnd}) for ${n.type} node in line ${n.loc?.start.line}`);
                n.end = locEnd;
            }
        }
    });
}
function getNewLine(code) {
    return code.includes('\x0d\x0a') ? '\x0d\x0a' : '\x0a';
}
exports.getNewLine = getNewLine;
function mapComments(code, newLine, comments) {
    var e_1, _a;
    var _b;
    comments.reverse();
    var lines = {};
    try {
        for (var _c = __values(comments.filter(function (x) { return x.value; })), _d = _c.next(); !_d.done; _d = _c.next()) {
            var c = _d.value;
            // Check if comment is on its own line
            var idx = c.start - 1;
            while (--idx > 0 && (code[idx] == ' ' || code[idx] == '\t'))
                ;
            var onSeparateLine = ['\n', '\r', ' '].includes(code[idx]);
            var line = c.loc.end.line;
            // If not on same line as code, move line # to next (code) line
            if (onSeparateLine)
                line++;
            // Comment was already found below; merge this one to its line
            if (lines[line + 1])
                line++;
            var prefix = c.type === 'Block' ? '/*' : '//';
            var suffix = c.type === 'Block' ? '*/' : '';
            lines[line] = "".concat(prefix).concat(c.value).concat(suffix).concat(newLine).concat((_b = lines[line]) !== null && _b !== void 0 ? _b : '');
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c["return"])) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return lines;
}
function getCommentsBefore(code, commentLines, node) {
    var _a, _b;
    var line = (_b = (_a = node === null || node === void 0 ? void 0 : node.loc) === null || _a === void 0 ? void 0 : _a.start) === null || _b === void 0 ? void 0 : _b.line;
    if (!line)
        return '';
    return commentLines[line];
}
function deconstructProperty(code, node) {
    var _a, _b, _c, _d, _e, _f, _g;
    var ta = (_a = node === null || node === void 0 ? void 0 : node.typeAnnotation) === null || _a === void 0 ? void 0 : _a.typeAnnotation;
    var typeStr = (_e = (_c = (_b = ta === null || ta === void 0 ? void 0 : ta.types) === null || _b === void 0 ? void 0 : _b.map(function (t) { return asSource(code, t); }).join(' | ')) !== null && _c !== void 0 ? _c : (_d = asSource(code, ta === null || ta === void 0 ? void 0 : ta.elementType)) === null || _d === void 0 ? void 0 : _d.concat('[]')) !== null && _e !== void 0 ? _e : asSource(code, (_f = ta === null || ta === void 0 ? void 0 : ta.typeName) !== null && _f !== void 0 ? _f : ta);
    return {
        id: identifier(code, node),
        typeStr: typeStr,
        node: node,
        async: node.type === 'MethodDefinition' ? Boolean((_g = node.value) === null || _g === void 0 ? void 0 : _g.async) : undefined
    };
}
var singleReturnFunc = /^\s*\{\s*return\s+([^;\{\}]+);?\s*\}/;
function asLambda(code, node) {
    var _a, _b, _c, _d;
    if (node.type === 'MethodDefinition' && ((_a = node.value) === null || _a === void 0 ? void 0 : _a.body)) {
        var params = (_c = (_b = node.value.params) === null || _b === void 0 ? void 0 : _b.map(function (p) { return asSource(code, p); }).join(', ')) !== null && _c !== void 0 ? _c : '';
        var retType = (_d = asSource(code, node.value.returnType)) !== null && _d !== void 0 ? _d : '';
        var body = asSource(code, node.value.body);
        if (body === null || body === void 0 ? void 0 : body.length) {
            var singleReturnBody = singleReturnFunc.exec(body);
            if ((singleReturnBody === null || singleReturnBody === void 0 ? void 0 : singleReturnBody.length) === 2)
                body = singleReturnBody[1];
        }
        return "".concat(node.value.async ? 'async ' : '', "(").concat(params, ")").concat(retType, " => ").concat(body);
    }
    throw new Error('Expecting a method definition');
}
function asSource(code, node) {
    return node ? code.substring(node.start, node.end) : null;
}
function identifier(code, node) {
    return code.substring(node.key.start, node.key.end);
}
// Generic node methods
function isDecorated(node) {
    var _a;
    return ((_a = node.decorators) === null || _a === void 0 ? void 0 : _a.length) > 0;
}
exports.isDecorated = isDecorated;
function isDecoratedWith(node, name) {
    var decorators = node.decorators;
    return (decorators === null || decorators === void 0 ? void 0 : decorators.length) > 0 && decorators.some(function (d) { var _a, _b; return ((_b = (_a = d.expression) === null || _a === void 0 ? void 0 : _a.callee) === null || _b === void 0 ? void 0 : _b.name) === name; });
}
exports.isDecoratedWith = isDecoratedWith;
function decorators(node) {
    var decorators = node.decorators;
    return (decorators === null || decorators === void 0 ? void 0 : decorators.length) > 0 ? decorators.map(function (d) { var _a, _b; return (_b = (_a = d.expression) === null || _a === void 0 ? void 0 : _a.callee) === null || _b === void 0 ? void 0 : _b.name; }).filter(function (x) { return x; }) : [];
}
exports.decorators = decorators;
function applyRecursively(node, method) {
    var e_2, _a;
    if (typeof (node === null || node === void 0 ? void 0 : node.type) !== 'string')
        return;
    method(node);
    try {
        for (var _b = __values(Object.entries(node)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), prop = _d[0], value = _d[1];
            if (prop === 'type')
                continue;
            if (Array.isArray(value))
                value.forEach(function (el) { return applyRecursively(el, method); });
            else
                applyRecursively(value, method);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
}
exports.applyRecursively = applyRecursively;
var indentRegex = /^([ \t]+)(?:[^\s]|$)/;
function unIndent(code, newLine, bodyText) {
    var e_3, _a;
    var _b;
    var lines = bodyText.split(newLine);
    if (lines.length > 1) {
        var minIndent_1 = null;
        try {
            for (var lines_1 = __values(lines), lines_1_1 = lines_1.next(); !lines_1_1.done; lines_1_1 = lines_1.next()) {
                var line = lines_1_1.value;
                var lineIndent = (_b = indentRegex.exec(line)) === null || _b === void 0 ? void 0 : _b[1];
                if ((lineIndent === null || lineIndent === void 0 ? void 0 : lineIndent.length) && (minIndent_1 == null || lineIndent.length < minIndent_1.length))
                    minIndent_1 = lineIndent;
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (lines_1_1 && !lines_1_1.done && (_a = lines_1["return"])) _a.call(lines_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        if (minIndent_1 === null || minIndent_1 === void 0 ? void 0 : minIndent_1.length)
            bodyText = lines.map(function (l) { return l.replace(minIndent_1, ''); }).join(newLine);
    }
    return bodyText;
}
exports.unIndent = unIndent;
