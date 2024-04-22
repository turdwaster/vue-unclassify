import * as acorn from 'acorn';
import { tsPlugin } from 'acorn-typescript';

export function parseTS(code: string) {
    const parser = acorn.Parser.extend(tsPlugin() as any);

    try {
        const ast = parser.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            locations: true // Required for acorn-typescript
        });

        return {
            ast,
            getSource: asSource.bind(null, code),
            deconstructProperty: deconstructProperty.bind(null, code),
            asLambda: asLambda.bind(null, code)
        };        
    } catch (ex: any) {
        let msg = '// Transpilation failure - ' + (ex?.message ?? JSON.stringify(ex));
        if (ex.loc?.line)
            msg += '\n' + code?.split('\n').slice(ex.loc.line - 1, ex.loc.line);
        throw new Error(msg);
    }
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

export function applyRecursively(node: acorn.Node, method: (node: acorn.Node) => void) {
    if (typeof node?.type !== 'string')
        return;

    method(node);

    for (const [prop, value] of Object.entries(node)) {
        if (prop === 'type')
            continue;
        
        if (Array.isArray(value))
            (value as acorn.Node[]).forEach(el => applyRecursively(el, method));
        else
            applyRecursively(value as acorn.Node, method);
    }
}
