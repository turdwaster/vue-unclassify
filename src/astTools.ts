import { AnyNode, Comment, Expression, MethodDefinition, Parser, PrivateIdentifier, Program, PropertyDefinition } from 'acorn';
import { tsPlugin } from 'acorn-typescript';

export interface ParsedCode {
    ast: Program;
    getSource: (node: AnyNode | null | undefined) => string | null;
    deconstructProperty: (node: MethodDefinition | PropertyDefinition) => DeconstructedProperty;
    asLambda: (node: MethodDefinition | PropertyDefinition) => string | undefined;
    getCommentsFor: (node: AnyNode | null | undefined) => string;
}

export interface DeconstructedProperty {
    id: string;
    typeStr: any;
    node: MethodDefinition | PropertyDefinition;
}

export function parseTS(code: string): ParsedCode {
    const parser = Parser.extend(tsPlugin() as any);
    try {
        const comments: Comment[] = [];
        const ast = parser.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            onComment: comments,
            locations: true // Required for acorn-typescript
        });

        const commentLines = mapComments(code, comments);
        return {
            ast,
            getSource: asSource.bind(null, code),
            deconstructProperty: deconstructProperty.bind(null, code),
            asLambda: asLambda.bind(null, code),
            getCommentsFor: getCommentsBefore.bind(null, code, commentLines)
        };        
    } catch (ex: any) {
        let msg = '// Transpilation failure - ' + (ex?.message ?? JSON.stringify(ex));
        if (ex.loc?.line)
            msg += '\n' + code?.split('\n').slice(ex.loc.line - 1, ex.loc.line);
        throw new Error(msg);
    }
}

function mapComments(code: string, comments: Comment[]) {
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
        const suffix = c.type === 'Block' ? '*/\n' : '\n';
        lines[line] = prefix + c.value + suffix + (lines[line] ?? '');
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

function asLambda(code: string, node: PropertyDefinition | MethodDefinition) {
    return asSource(code, node?.value)?.replace(') {', ') => {');
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

export function unIndent(bodyText: string) {
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
