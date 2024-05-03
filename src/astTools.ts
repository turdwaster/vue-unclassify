import * as acorn from 'acorn';
import { tsPlugin } from 'acorn-typescript';

export function parseTS(code: string) {
    const parser = acorn.Parser.extend(tsPlugin() as any);
    try {
        const comments: acorn.Comment[] = [];
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

function mapComments(code: string, comments: acorn.Comment[]) {
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

function getCommentsBefore(code: string, commentLines: { [line: number] : string }, node: acorn.Node | null | undefined) {
    const line = node?.loc?.start?.line;
    if (!line)
        return '';
    return commentLines[line];
}

function deconstructProperty(code: string, node: acorn.PropertyDefinition | acorn.MethodDefinition) {
    const ta = (node as any)?.typeAnnotation?.typeAnnotation;
    const typeStr =
        ta?.types?.map((t: acorn.Node) => asSource(code, t)).join(' | ') ??
        asSource(code, ta?.elementType)?.concat('[]') ??
        asSource(code, ta?.typeName ?? ta);
    return {
        id: identifier(code, node),
        typeStr,
        node
    };
}

function asLambda(code: string, node: acorn.PropertyDefinition | acorn.MethodDefinition) {
    return asSource(code, node.value)?.replace(') {', ') => {');
}

function asSource(code: string, node: acorn.Node | null | undefined) {
    return node ? code.substring(node.start, node.end) : null;
}

function identifier(code: string, node: { key: acorn.Expression | acorn.PrivateIdentifier}) {
    return code.substring(node.key.start, node.key.end);
}

// Generic node methods

export function isDecorated(node: acorn.Node) {
    return (node as any).decorators?.length > 0;
}

export function isDecoratedWith(node: acorn.Node, name: string) {
    const decorators = (node as any).decorators as any[];
    return decorators?.length > 0 && decorators.some((d: any) => d.expression?.callee?.name === name);
}

export function decorators(node: acorn.Node) {
    const decorators = (node as any).decorators as any[];
    return decorators?.length > 0 ? decorators.map((d: any) => d.expression?.callee?.name as string).filter(x => x) : [];
}

export function applyRecursively(node: acorn.AnyNode, method: (node: acorn.AnyNode) => void) {
    if (typeof node?.type !== 'string')
        return;

    method(node);

    for (const [prop, value] of Object.entries(node)) {
        if (prop === 'type')
            continue;
        
        if (Array.isArray(value))
            (value as acorn.AnyNode[]).forEach(el => applyRecursively(el, method));
        else
            applyRecursively(value as acorn.AnyNode, method);
    }
}
