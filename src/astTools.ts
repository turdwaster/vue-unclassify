import { AnyNode, Comment, Expression, MethodDefinition, Parser, PrivateIdentifier, Program, PropertyDefinition } from 'acorn';
import { tsPlugin } from 'acorn-typescript';

export interface ParsedCode {
    ast: Program;
    getSource: (node: AnyNode | null | undefined) => string | null;
    deconstructProperty: (node: MethodDefinition | PropertyDefinition) => DeconstructedProperty;
    asLambda: (node: MethodDefinition) => string | undefined;
    getCommentsFor: (node: AnyNode | null | undefined) => string;
    unIndent: (text: string) => string;
    readonly newLine: string;
}

export interface DeconstructedProperty {
    id: string;
    typeStr: any;
    node: MethodDefinition | PropertyDefinition;
}

export function parseTS(code: string): ParsedCode {
    const newLine = getNewLine(code);
    const parser = Parser.extend(tsPlugin() as any);
    try {
        const comments: Comment[] = [];
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
    } catch (ex: any) {
        let msg = '// Transpilation failure - ' + (ex?.message ?? JSON.stringify(ex));
        if (ex.loc?.line)
            msg += newLine + code?.split(newLine).slice(ex.loc.line - 1, ex.loc.line);
        throw new Error(msg);
    }
}

function fixBrokenSourceRanges(ast: Program) {
    // Repair buggy node source ranges (acorn-typescript bug?)
    applyRecursively(ast, n => {
        if (n.end < n.start) {
            const locStart = (n.loc?.start as any).index;
            const locEnd = (n.loc?.end as any).index;
            if (locStart === n.start && locEnd >= locStart) {
                // console.debug(`Adjusted broken range (${n.start}-${n.end}) to (${n.start}-${locEnd}) for ${n.type} node in line ${n.loc?.start.line}`);
                n.end = locEnd;
            }
        }
    });
}

export function getNewLine(code: string) {
    return code.includes('\x0d\x0a') ? '\x0d\x0a' : '\x0a';
}

function mapComments(code: string, newLine: string, comments: Comment[]) {
    comments.reverse();
    const lines: { [line: number] : string } = {};

    for (const c of comments.filter(x => x.value)) {
        // Check if comment is on its own line
        let idx = c.start - 1;
        while (--idx > 0 && (code[idx] == ' ' || code[idx] == '\t'));

        const onSeparateLine = ['\n', '\r', ' '].includes(code[idx]);
        let line = c.loc!.end.line;

        // If not on same line as code, move line # to next (code) line
        if (onSeparateLine)
            line++;

        // Comment was already found below; merge this one to its line
        if (lines[line + 1])
            line++;

        const prefix = c.type === 'Block' ? '/*' : '//';
        const suffix = c.type === 'Block' ? '*/' : '';
        lines[line] = `${prefix}${c.value}${suffix}${newLine}${lines[line] ?? ''}`;
    }
    return lines;
}

function getCommentsBefore(code: string, commentLines: { [line: number] : string }, node: AnyNode | null | undefined) {
    const line = node?.loc?.start?.line;
    if (!line)
        return '';
    return commentLines[line];
}

function deconstructProperty(code: string, node: PropertyDefinition | MethodDefinition) {
    const ta = (node as any)?.typeAnnotation?.typeAnnotation;
    const typeStr =
        ta?.types?.map((t: AnyNode) => asSource(code, t)).join(' | ') ??
        asSource(code, ta?.elementType)?.concat('[]') ??
        asSource(code, ta?.typeName ?? ta);
    return {
        id: identifier(code, node),
        typeStr,
        node
    };
}

function asLambda(code: string, node: MethodDefinition) {
    if (node.type === 'MethodDefinition' && node.value?.body) {
        const params = node.value.params?.map(p => asSource(code, p)).join(', ') ?? '';
        const retType  = asSource(code, (node.value as any).returnType) ?? '';
        return '(' + params + ')' + retType + ' => ' + asSource(code, node.value.body);
    }
    throw new Error('Expecting a method definition');
}

function asSource(code: string, node: AnyNode | null | undefined) {
    return node ? code.substring(node.start, node.end) : null;
}

function identifier(code: string, node: { key: Expression | PrivateIdentifier}) {
    return code.substring(node.key.start, node.key.end);
}

// Generic node methods

export function isDecorated(node: AnyNode) {
    return (node as any).decorators?.length > 0;
}

export function isDecoratedWith(node: AnyNode, name: string) {
    const decorators = (node as any).decorators as any[];
    return decorators?.length > 0 && decorators.some((d: any) => d.expression?.callee?.name === name);
}

export function decorators(node: AnyNode) {
    const decorators = (node as any).decorators as any[];
    return decorators?.length > 0 ? decorators.map((d: any) => d.expression?.callee?.name as string).filter(x => x) : [];
}

export function applyRecursively(node: AnyNode, method: (node: AnyNode) => void) {
    if (typeof node?.type !== 'string')
        return;

    method(node);

    for (const [prop, value] of Object.entries(node)) {
        if (prop === 'type')
            continue;
        
        if (Array.isArray(value))
            (value as AnyNode[]).forEach(el => applyRecursively(el, method));
        else
            applyRecursively(value as AnyNode, method);
    }
}

const indentRegex = /^([ \t]+)(?:[^\s]|$)/;

export function unIndent(code: string, newLine: string, bodyText: string) {
    let lines = bodyText.split(newLine);
    if (lines.length > 1) {
        let minIndent: string | null = null;
        for (const line of lines) {
            const lineIndent = indentRegex.exec(line)?.[1];
            if (lineIndent?.length && (minIndent == null || lineIndent.length < minIndent.length))
                minIndent = lineIndent;
        }

        if (minIndent?.length)
            bodyText = lines.map(l => l.replace(minIndent!, '')).join(newLine);
    }
    return bodyText;
}
