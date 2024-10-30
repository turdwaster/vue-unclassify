import { Parser } from 'acorn';
import { tsPlugin } from 'acorn-typescript';
export function parseTS(code) {
    var _a, _b;
    const newLine = getNewLine(code);
    const parser = Parser.extend(tsPlugin());
    try {
        const comments = [];
        const ast = parser.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            onComment: comments,
            locations: true // Required for acorn-typescript
        });
        fixBrokenSourceRanges(ast);
        const commentLines = mapComments(code, newLine, comments);
        return {
            ast,
            getSource: asSource.bind(null, code),
            deconstructProperty: deconstructProperty.bind(null, code),
            asLambda: asLambda.bind(null, code),
            getCommentsFor: getCommentsBefore.bind(null, code, commentLines),
            unIndent: unIndent.bind(null, code, newLine),
            newLine
        };
    }
    catch (ex) {
        let msg = '// Transpilation failure - ' + ((_a = ex === null || ex === void 0 ? void 0 : ex.message) !== null && _a !== void 0 ? _a : JSON.stringify(ex));
        if ((_b = ex.loc) === null || _b === void 0 ? void 0 : _b.line)
            msg += newLine + (code === null || code === void 0 ? void 0 : code.split(newLine).slice(ex.loc.line - 1, ex.loc.line));
        throw new Error(msg);
    }
}
function fixBrokenSourceRanges(ast) {
    // Repair buggy node source ranges (acorn-typescript bug?)
    applyRecursively(ast, n => {
        var _a, _b;
        if (n.end < n.start) {
            const locStart = ((_a = n.loc) === null || _a === void 0 ? void 0 : _a.start).index;
            const locEnd = ((_b = n.loc) === null || _b === void 0 ? void 0 : _b.end).index;
            if (locStart === n.start && locEnd >= locStart) {
                // console.debug(`Adjusted broken range (${n.start}-${n.end}) to (${n.start}-${locEnd}) for ${n.type} node in line ${n.loc?.start.line}`);
                n.end = locEnd;
            }
        }
    });
}
export function getNewLine(code) {
    return code.includes('\x0d\x0a') ? '\x0d\x0a' : '\x0a';
}
function mapComments(code, newLine, comments) {
    var _a;
    comments.reverse();
    const lines = {};
    for (const c of comments.filter(x => x.value)) {
        // Check if comment is on its own line
        let idx = c.start - 1;
        while (--idx > 0 && (code[idx] == ' ' || code[idx] == '\t'))
            ;
        const onSeparateLine = ['\n', '\r', ' '].includes(code[idx]);
        let line = c.loc.end.line;
        // If not on same line as code, move line # to next (code) line
        if (onSeparateLine)
            line++;
        // Comment was already found below; merge this one to its line
        if (lines[line + 1])
            line++;
        const prefix = c.type === 'Block' ? '/*' : '//';
        const suffix = c.type === 'Block' ? '*/' : '';
        lines[line] = `${prefix}${c.value}${suffix}${newLine}${(_a = lines[line]) !== null && _a !== void 0 ? _a : ''}`;
    }
    return lines;
}
function getCommentsBefore(code, commentLines, node) {
    var _a, _b;
    const line = (_b = (_a = node === null || node === void 0 ? void 0 : node.loc) === null || _a === void 0 ? void 0 : _a.start) === null || _b === void 0 ? void 0 : _b.line;
    if (!line)
        return '';
    return commentLines[line];
}
function deconstructProperty(code, node) {
    var _a, _b, _c, _d, _e, _f, _g;
    const ta = (_a = node === null || node === void 0 ? void 0 : node.typeAnnotation) === null || _a === void 0 ? void 0 : _a.typeAnnotation;
    const typeStr = (_e = (_c = (_b = ta === null || ta === void 0 ? void 0 : ta.types) === null || _b === void 0 ? void 0 : _b.map((t) => asSource(code, t)).join(' | ')) !== null && _c !== void 0 ? _c : (_d = asSource(code, ta === null || ta === void 0 ? void 0 : ta.elementType)) === null || _d === void 0 ? void 0 : _d.concat('[]')) !== null && _e !== void 0 ? _e : asSource(code, (_f = ta === null || ta === void 0 ? void 0 : ta.typeName) !== null && _f !== void 0 ? _f : ta);
    return {
        id: identifier(code, node),
        typeStr,
        node,
        async: node.type === 'MethodDefinition' ? Boolean((_g = node.value) === null || _g === void 0 ? void 0 : _g.async) : undefined
    };
}
const singleReturnFunc = /^\s*\{\s*return\s+([^;\{\}]+);?\s*\}/;
function asLambda(code, node) {
    var _a, _b, _c, _d;
    if (node.type === 'MethodDefinition' && ((_a = node.value) === null || _a === void 0 ? void 0 : _a.body)) {
        const params = (_c = (_b = node.value.params) === null || _b === void 0 ? void 0 : _b.map(p => asSource(code, p)).join(', ')) !== null && _c !== void 0 ? _c : '';
        const retType = (_d = asSource(code, node.value.returnType)) !== null && _d !== void 0 ? _d : '';
        let body = asSource(code, node.value.body);
        if (body === null || body === void 0 ? void 0 : body.length) {
            const singleReturnBody = singleReturnFunc.exec(body);
            if ((singleReturnBody === null || singleReturnBody === void 0 ? void 0 : singleReturnBody.length) === 2)
                body = singleReturnBody[1];
        }
        return `${node.value.async ? 'async ' : ''}(${params})${retType} => ${body}`;
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
export function isDecorated(node) {
    var _a;
    return ((_a = node.decorators) === null || _a === void 0 ? void 0 : _a.length) > 0;
}
export function isDecoratedWith(node, name) {
    const decorators = node.decorators;
    return (decorators === null || decorators === void 0 ? void 0 : decorators.length) > 0 && decorators.some((d) => { var _a, _b; return ((_b = (_a = d.expression) === null || _a === void 0 ? void 0 : _a.callee) === null || _b === void 0 ? void 0 : _b.name) === name; });
}
export function decorators(node) {
    const decorators = node.decorators;
    return (decorators === null || decorators === void 0 ? void 0 : decorators.length) > 0 ? decorators.map((d) => { var _a, _b; return (_b = (_a = d.expression) === null || _a === void 0 ? void 0 : _a.callee) === null || _b === void 0 ? void 0 : _b.name; }).filter(x => x) : [];
}
export function applyRecursively(node, method) {
    if (typeof (node === null || node === void 0 ? void 0 : node.type) !== 'string')
        return;
    method(node);
    for (const [prop, value] of Object.entries(node)) {
        if (prop === 'type')
            continue;
        if (Array.isArray(value))
            value.forEach(el => applyRecursively(el, method));
        else
            applyRecursively(value, method);
    }
}
const indentRegex = /^([ \t]+)(?:[^\s]|$)/;
export function unIndent(code, newLine, bodyText) {
    var _a;
    let lines = bodyText.split(newLine);
    if (lines.length > 1) {
        let minIndent = null;
        for (const line of lines) {
            const lineIndent = (_a = indentRegex.exec(line)) === null || _a === void 0 ? void 0 : _a[1];
            if ((lineIndent === null || lineIndent === void 0 ? void 0 : lineIndent.length) && (minIndent == null || lineIndent.length < minIndent.length))
                minIndent = lineIndent;
        }
        if (minIndent === null || minIndent === void 0 ? void 0 : minIndent.length)
            bodyText = lines.map(l => l.replace(minIndent, '')).join(newLine);
    }
    return bodyText;
}
