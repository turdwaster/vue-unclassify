"use strict";
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
function getNewLine(code) {
    return code.includes('\x0d\x0a') ? '\x0d\x0a' : '\x0a';
}
exports.getNewLine = getNewLine;
function mapComments(code, newLine, comments) {
    var _a;
    comments.reverse();
    var lines = {};
    for (var _i = 0, _b = comments.filter(function (x) { return x.value; }); _i < _b.length; _i++) {
        var c = _b[_i];
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
        lines[line] = "".concat(prefix).concat(c.value).concat(suffix).concat(newLine).concat((_a = lines[line]) !== null && _a !== void 0 ? _a : '');
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
    var _a, _b, _c, _d, _e, _f;
    var ta = (_a = node === null || node === void 0 ? void 0 : node.typeAnnotation) === null || _a === void 0 ? void 0 : _a.typeAnnotation;
    var typeStr = (_e = (_c = (_b = ta === null || ta === void 0 ? void 0 : ta.types) === null || _b === void 0 ? void 0 : _b.map(function (t) { return asSource(code, t); }).join(' | ')) !== null && _c !== void 0 ? _c : (_d = asSource(code, ta === null || ta === void 0 ? void 0 : ta.elementType)) === null || _d === void 0 ? void 0 : _d.concat('[]')) !== null && _e !== void 0 ? _e : asSource(code, (_f = ta === null || ta === void 0 ? void 0 : ta.typeName) !== null && _f !== void 0 ? _f : ta);
    return {
        id: identifier(code, node),
        typeStr: typeStr,
        node: node
    };
}
function asLambda(code, node) {
    var _a;
    return (_a = asSource(code, node === null || node === void 0 ? void 0 : node.value)) === null || _a === void 0 ? void 0 : _a.replace(') {', ') => {');
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
    if (typeof (node === null || node === void 0 ? void 0 : node.type) !== 'string')
        return;
    method(node);
    for (var _i = 0, _a = Object.entries(node); _i < _a.length; _i++) {
        var _b = _a[_i], prop = _b[0], value = _b[1];
        if (prop === 'type')
            continue;
        if (Array.isArray(value))
            value.forEach(function (el) { return applyRecursively(el, method); });
        else
            applyRecursively(value, method);
    }
}
exports.applyRecursively = applyRecursively;
var indentRegex = /^([ \t]+)(?:[^\s]|$)/;
function unIndent(code, newLine, bodyText) {
    var _a;
    var lines = bodyText.split(newLine);
    if (lines.length > 1) {
        var minIndent_1 = null;
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var lineIndent = (_a = indentRegex.exec(line)) === null || _a === void 0 ? void 0 : _a[1];
            if ((lineIndent === null || lineIndent === void 0 ? void 0 : lineIndent.length) && (minIndent_1 == null || lineIndent.length < minIndent_1.length))
                minIndent_1 = lineIndent;
        }
        if (minIndent_1 === null || minIndent_1 === void 0 ? void 0 : minIndent_1.length)
            bodyText = lines.map(function (l) { return l.replace(minIndent_1, ''); }).join(newLine);
    }
    return bodyText;
}
exports.unIndent = unIndent;
