<template>
	<div style="tab-size: 2em">
		<div style="float: right; width: 48%">
			<h1>Transpiled script</h1>
			<pre style="margin: 0; margin-top: -16px; padding: 0;">
				<code class="hljs" v-html="transformed" style="height: 75vh;"></code>
			</pre>
		</div>
		<div>
			<h1>SFC</h1>
			<textarea v-model="scriptText" style="width: 48%; height: 75vh; margin: 0; padding: 8px" />
			<br clear="all" />
			<h1>Template</h1>
			<pre>{{ templateText }}</pre>
			<h1>Style</h1>
			<pre>{{ styleText }}</pre>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref, watch } from 'vue';
	import { transpileSFC } from '../sfc';
	import hljs from 'highlight.js/lib/core';
	import typescript from 'highlight.js/lib/languages/typescript';
	import 'highlight.js/styles/atom-one-dark.min.css';
	
	hljs.registerLanguage('typescript', typescript);
	
	const templateText = ref();
	const styleText = ref();
	const scriptText = ref(localStorage.getItem('sfc'));
	const transformed = ref('// &lt;script setup&gt; code appears here');

	if (!scriptText.value?.length)
		import('../exampleComponent').then(x => scriptText.value = x.default);

	watch(scriptText, data => {
		try {
			localStorage.setItem('sfc', data ?? '');
			const parts = transpileSFC(data ?? '');
			templateText.value = parts.templateNode ?? '';
			styleText.value = parts.styleNode ?? '';
			transformed.value = hljs.highlight(parts.scriptBody ?? '', { language: 'typescript' }).value;
		} catch(ex: any) {
			transformed.value = ex?.message ?? JSON.stringify(ex);
		}
	}, { immediate: true });
</script>
