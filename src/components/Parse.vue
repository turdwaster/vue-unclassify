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
	import { transpile } from '../transpiler';

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
	public nonReactive: boolean;

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

	const templateText = ref();
	const styleText = ref();
	const scriptText = ref();
	const transformed = ref('');

	const asHtml = document.createElement('pre');
	asHtml.innerHTML = data;
	const html = asHtml.getElementsByTagName('template').item(0)!.outerHTML.trim();
	templateText.value = html.replace(/=""/g, '');

	const start = data.indexOf('<scrpt lang="ts">') + 17;
	const codeText = data.slice(start, data.indexOf('</scrpt>'));
	scriptText.value = codeText;
	transformed.value = transpile(codeText);
</script>
