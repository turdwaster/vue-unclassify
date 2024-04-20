<template>
	<h1>Script</h1>
	<pre style="float: right; width: 48%">{{ transformed }}</pre>
	<textarea v-model="scriptText" style="width: 48%; height: 75vh; margin-left: 0; padding-left: 0" />
	<br clear="all" />
	<h1>Template</h1>
	<pre>{{ templateText }}</pre>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import * as acorn from 'acorn';
	import tsPlugin from 'acorn-typescript';

	const data = `<template>
	<div>
		<ul v-if="compact" v-bind:class="{ inline: inline != null && inline !== false }">
			<li v-for="item of allParams" v-bind:key="'c' + item.key" :class="{ columns: columns != null && columns !== false }">
				<template v-if="titlesOnly">{{ item.title }}</template>
				<template v-else>
					<span class="thin align"> {{ notitles ? '' : item.title + ':' }} 	</span> 
					<DutyPointValue :param="params.getParam(item.key)" :sizingId="sizingId || params.sizingId" :fullWidth="inline != null && inline !== false"
						:mode="mode" :assumed="item.assumed" />			
				</template>
			</li>
		</ul>
		<v-list v-else dense tile expand class="sharp-edges pt-0">
			<v-list-group v-for="group of allParamsGrouped" :key="group.group" v-model="group.expanded" class="param-list">
			  <template #appendIcon>
			<v-icon>$plus</v-icon>
		  </template>
				<template v-slot:activator>
					<v-list-item-content>
						<v-list-item-title class="param-section" v-text="group.title" />
					</v-list-item-content>
				</template>
				<v-list-item v-for="item of group.params" :key="'d' + item.key" class="pt-0">
					<v-list-item-title v-text="item.title" v-if="!notitles"></v-list-item-title>
					<v-list-item-action-text>
						<DutyPointValue :param="params.getParam(item.key)" :sizingId="sizingId || params.sizingId"
							:mode="mode" :assumed="item.assumed" />
					</v-list-item-action-text>
				</v-list-item>
			</v-list-group>
		</v-list>
	</div>
</template>

<style lang="scss" scoped>
	@import '@/sass/_variables.scss';
	// readonly mode
	ul {
		list-style-type: none;
		padding-left: 0;
		&.inline li {
			display: inline-block;
			margin-right: 8px;
			&:last-child {
				margin-right: 0;
			}
		}
		li {
			line-height: 150%;
		}
	}
	.param-section {
		color: #000;
		text-transform: uppercase;
	}

	span.align {
		line-height: 1.1;
		vertical-align: text-bottom;
	}

	// sidebar mode, extra dense
	div.v-list div.v-list-group div.v-list-group__header {
		// TODO: doesn't seem to apply properly
		min-height: 18px;
	}
	.v-list--dense .v-list-item .v-list-item__content,
	.v-list-item--dense .v-list-item__content {
		padding: 0;
	}
	.v-list-item--dense,
	.v-list--dense .v-list-item {
		min-height: 18px;
	}
	.v-list-item__title {
		font-weight: normal !important;
	}
	li.columns {
		display: inline-block;
		margin-right: 12px;
	}
	.v-list-item--active .v-icon {
		color: $grey;
	}
</style>

<scrpt lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { ParameterDef } from 'types/dto/CalcServiceDomain';
import { ParamBag } from '@/common/ParamBag';
import DutyPointValue from '@/components/DutyPointValue.vue';
import { tryToTranslate } from '@/i18n';

@Component({
	components: {
		DutyPointValue
	}
})
export default class ParamList extends Vue {
	@Prop() public sizingId: string;
	@Prop() public params: ParamBag;
	@Prop() public names: string[];
	@Prop() public inline: boolean;
	@Prop() public filter: 'All' | 'UserDefined' | 'Basic' | 'Problematic';

	private static readonly killGroups = [ 'Pipe', 'Inlet.Pipes', 'Outlet.Pipes' ];

	private static readonly redirectGroups: { [type: string]: string } = {
		Frame: 'Build',
		Flange: 'Build',
		Drive: 'Build'
	};

	private static aggregatedParams: string[];

	public reactive: ParamBag = null;

	public created() {
		if (!ParamList.aggregatedParams)
			ParamList.aggregatedParams = ParamBag.aggregatedValueNames;
	}

	public mounted() {
		if (!this.fixedPump)
			this.showingAlternatives = true;

		if (this.fixedPump)
			this.expandPump(this.fixedPump);
		else
			this.searchPumps();
	}

	public get compact() {
		return this.names != null && this.reactive != null;
	}

	private get groupMap() {
		const map = {} as { [key: string]: ParameterDef };
		ParamBag.groups.forEach(g => map[g.Name] = g);
		return map;
	}

	private hasProblem(valueName: string) {
		return this.params.hasProblem(valueName);
	}

	@Watch('reloadTrigger')
	private onDataChange(val: string) {
		if (val)
			this.reload.trigger();
	}

	@Watch('deepStuff', { deep: true, immediate: true })
	private onDeepChange(val: string) {
		if (val)
			this.reload.trigger();
	}

	private static staticUtilityMethod() {
		console.debug('Niiice');
	}
}
</scrpt>`;

	const parser = acorn.Parser.extend(tsPlugin() as any)

	const templateText = ref();
	const styleText = ref();
	const scriptText = ref();
	const transformed = ref('');

	const asHtml = document.createElement('pre');
	asHtml.innerHTML = data;
	templateText.value = asHtml.getElementsByTagName('template').item(0)!.outerHTML.trim().replaceAll('=""', '');

	const start = data.indexOf('<scrpt lang="ts">') + 17;
	const code = data.slice(start, data.indexOf('</scrpt>'));
	scriptText.value = code;

	const ast = parser.parse(code, {
		ecmaVersion: 'latest',
		sourceType: 'module',
		locations: true // Required for acorn-typescript
	});

	let xformed = '';

	function emitLine(node: acorn.Node | string) {
		if (typeof node === 'string') {
			xformed += node;
			xformed += '\n';
			return;
		}
		const nodeCode = code.substring(node.start, node.end);
		if (nodeCode?.trim()?.length) {
			xformed += nodeCode;
			xformed += '\n';
		}
	}

	function getSource(node: acorn.Node | null | undefined) {
		return node ? code.substring(node.start, node.end) : '';
	}

	function identifier(node: { key: acorn.Expression | acorn.PrivateIdentifier}) {
		return code.substring(node.key.start, node.key.end);
	}

	function isDecorated(node: acorn.Node) {
		return (node as any).decorators?.length > 0;
	}

	function isDecoratedWith(node: acorn.Node, name: string) {
		const decorators = (node as any).decorators as any[];
		return decorators?.length > 0 && decorators.some((d: any) => d.expression?.callee?.name === name);
	}

	function decorators(node: acorn.Node) {
		const decorators = (node as any).decorators as any[];
		return decorators?.length > 0 ? decorators.map((d: any) => d.expression?.callee?.name as string).filter(x => x) : [];
	}

	function deconstructProperty<T>(node: T & { key: acorn.Expression | acorn.PrivateIdentifier }) {
		const ta = (node as any)?.typeAnnotation?.typeAnnotation;
		const typeStr = getSource(ta?.typeName) ?? ta.types?.map(getSource).join(' | ') ?? getSource(ta) ?? (getSource(ta.elementType) + '[]');
		return {
			id: identifier(node),
			typeStr,
			node
		};
	}

	function asLambda(node: acorn.MethodDefinition) {
		return getSource(node.value).replace(') {', ') => {');
	}

	function applyRecursively(node: acorn.Node, method: (node: acorn.Node) => void) {
		if (typeof node?.type !== 'string')
			return;

		method(node);

		for (const [prop, value] of Object.entries(node)) {
			if (prop === 'type')
				continue;
			else if (Array.isArray(value))
				(value as acorn.Node[]).forEach(el => applyRecursively(el, method));
			else
				applyRecursively(value as acorn.Node, method);
		}
	}

	// Imports
	ast.body.filter(x => x.type === 'ImportDeclaration')
		.map(getSource)
		.filter(x => !x.includes('vue-property-decorator'))
		.map(x => x.includes('import Vue from') ? 'import { computed, ref, watch } from \'vue\';' : x)
		.map(emitLine);

	const expDefNode = ast.body.find(x => x.type === 'ExportDefaultDeclaration') as acorn.ExportDefaultDeclaration;
	const classNode = expDefNode.declaration as acorn.ClassDeclaration;

	if (classNode) {
		const memberNodes = classNode.body.body;
		const properties = memberNodes.filter(x => x.type === 'PropertyDefinition') as acorn.PropertyDefinition[];

		const staticMembers = properties.filter(x => x.static).map(deconstructProperty);
		if (staticMembers?.length) {
			emitLine('\n// Static data');
			for (const { id, typeStr, node } of staticMembers) {
				console.debug(node);
				emitLine(`const ${id}${typeStr ? ': ' + typeStr : ''}${node.value != null ? ' = ' + getSource(node.value) : ''};`);
			}
		}

		const props = properties.filter(x => isDecoratedWith(x, 'Prop')).map(deconstructProperty);
		const propIdentifiers: { [id: string] : acorn.Node } = {};
		if (props?.length) {
			emitLine('\n// Properties\nconst props = defineProps({');
			for (const { id, typeStr, node } of props) {
				propIdentifiers[id] = node;
				emitLine(`\t${id}${typeStr ? ': ' + typeStr : ''}${node.value != null ? ' = ' + getSource(node.value) : ''},`);
			}
			emitLine('});');
		}

		console.debug(JSON.stringify(propIdentifiers));

		const refs = properties.filter(x => !x.static && !isDecorated(x) && x.value != null).map(deconstructProperty);
		const refIdentifiers: { [id: string] : acorn.Node } = {};
		if (refs?.length) {
			emitLine('\n// State');
			for (const { id, typeStr, node } of refs) {
				refIdentifiers[id] = node;
				emitLine(`const ${id} = ref<${typeStr}>(${getSource(node.value)});`);
			}
		}

		const methods = memberNodes.filter(x => x.type === 'MethodDefinition') as acorn.MethodDefinition[];

		// --------------------

		function replaceThisExpr(code: string, member: string, prefix?: string, suffix?: string) {
			const regex = new RegExp(`this\\.${member}([^a-zA-Z])`, 'g');
			return code.replaceAll(regex, `${prefix ?? ''}${member}${suffix ?? ''}$1`)
		}

		function emitTranspiled(code: string) {
			for (const prop of Object.keys(propIdentifiers))
				code = replaceThisExpr(code, prop, 'props.');
			for (const prop of Object.keys(refIdentifiers))
				code = replaceThisExpr(code, prop, '', '.value');
			emitLine(code);
		}


		const watches = methods.filter(x => isDecoratedWith(x, 'Watch')).map(deconstructProperty);
		if (watches?.length) {
			emitLine('\n// Watches');
			for (const { id, node } of watches) {
				const deco = (node as any).decorators[0].expression as acorn.CallExpression;
				const decoArg = (deco.arguments[0] as acorn.Literal).value;
				const decoArg1 = (deco.arguments?.length > 1 ? deco.arguments[1] : null) as acorn.Expression;
				console.debug(deco.arguments);
				emitTranspiled(`const ${id} = watch(() => ${decoArg}.value, ${asLambda(node)}${decoArg1 ? (', ' + getSource(decoArg1)) : ''});`);
			}
		}

		const computeds = methods.filter(x => !isDecorated(x) && x.kind == 'get').map(deconstructProperty);
		if (computeds?.length) {
			emitLine('\n// Computeds');
			for (const { id, node } of computeds)
				emitTranspiled(`const ${id} = computed(${asLambda(node)});`);
		}

		const plainMethods = methods.filter(x => !isDecorated(x) && x.kind == 'method').map(deconstructProperty)

		const specialMethods = ['created','mounted'];
		const specialFunctions = plainMethods.filter(({ id }) => specialMethods.includes(id));
		if (specialFunctions?.length) {
			emitLine('\n// Init');
			for (const { id, node } of specialFunctions) {
				if (id == 'created')
					emitTranspiled(getSource(node.value.body).slice(2, -5) + ';\n');
				else if (id == 'mounted')
					emitTranspiled(`onMounted(${asLambda(node)});`);
			}
		}

		const functions = plainMethods.filter(({ id }) => !specialMethods.includes(id));
		if (functions?.length) {
			emitLine('\n// Functions');
			for (const { id, node } of functions) {
				emitTranspiled(`function ${id}${getSource(node.value)}`);

				// Replace 'this.[prop]', 'props.[prop]', 'this.', ''
			}
		}

		//const statics = memberNodes.filter(x => x.type === 'StaticBlock');
		// applyRecursively(classNode, node => {
		// 	if (node.type !== 'MemberExpression')
		// 		return;
			
		// 	// Find root object reference (i.e. this.a.b.c -> this)
		// 	let me = node as acorn.MemberExpression;
		// 	let thisParent = node;
		// 	while (me.object.type === 'MemberExpression') {
		// 		thisParent = me.object;
		// 		me = me.object as acorn.MemberExpression;
		// 	}

		// 	if (me.object?.type !== 'ThisExpression') {
		// 		console.debug('skip ' + getSource(node) + ': ' + me.object.type);
		// 		return;
		// 	}

		// 	console.debug('     ' + getSource(node));

		// 	const memberName = me.property.type === 'PrivateIdentifier' ? me.property.name : (me.property as acorn.Expression)
		// 	console.debug('-->  ' + getSource(me.property));
		// 	//console.debug(JSON.stringify(node));
		// 	console.debug('');
		// });

		// for (const member of memberNodes) {
		//     const memberCode = code.substring(member.start, member.end);
		//     emitLine('// ' + member.type! + ' member\n' + memberCode);

		//     switch (member.type) {
		//         case 'MethodDefinition':
		//             emitLine('--> TODO: method (getter or regular); key = ' + code.substring(member.key.start, member.key.end));
		//             break;
		//         case 'PropertyDefinition':
		//             emitLine('--> TODO: prop (@Prop = prop, initialized = ref or uninitialized = let/const; key = ' +
		//                 code.substring(member.key.start, member.key.end));
		//             break;
		//         case 'StaticBlock':
		//             emitLine('--> TODO: static block - emit function?');
		//             break;
		//     }
		// }
	}

	// for (const node of ast.body) {
	//     const nodeCode = code.substring(node.start, node.end);
	//     let output: string | null = null;
	//     switch (node.type) {
	//         case 'ImportDeclaration':
	//             output = nodeCode;
	//             break;

	//         case 'ExportDefaultDeclaration':
	//             const cls = ((node as acorn.ExportDefaultDeclaration).declaration) as acorn.ClassDeclaration;
	//             output = '';
	//             for (const member of cls.body.body) {
	//                 const memberCode = code.substring(member.start, member.end);
	//                 output += '// ' + node.type! + ' member\n' + memberCode! + '\n';
	//             }
	//         break;
		
	//         default:
	//             output = '// ' + node.type + ' node\n' + nodeCode;
	//             break;
	//     }
	//     if (output) {
	//         xformed += output;
	//         xformed += '\n'
	//     }
	// }
		
	transformed.value = xformed;
	//console.debug(ast.body[0].end);
</script>
