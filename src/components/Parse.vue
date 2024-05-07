<template>
	<div style="tab-size: 2em">
	<h1>Script</h1>
		<pre style="float: right; width: 48%; margin: 0; margin-top: -16px; padding: 0;">
			<code class="hljs" v-html="transformed" style="height: 75vh;"></code>
		</pre>
		<textarea v-model="scriptText" style="width: 48%; height: 75vh; margin: 0; padding: 8px" />
		<br clear="all" />
		<h1>Template</h1>
		<pre>{{ templateText }}</pre>
		<h1>Style</h1>
		<pre>{{ styleText }}</pre>
	</div>
</template>

<script setup lang="ts">
	import { ref, watch } from 'vue';
	import { transpile } from '../transpiler';
	import { splitSFC } from '../sfc';
	import hljs from 'highlight.js/lib/core';
	import typescript from 'highlight.js/lib/languages/typescript';
	import 'highlight.js/styles/atom-one-dark.min.css';
	
	hljs.registerLanguage('typescript', typescript);
	
	const templateText = ref();
	const styleText = ref();
	const scriptText = ref(localStorage.getItem('sfc') ?? '// Paste Vue2/3 class based SFC here');
	const transformed = ref('// &lt;script setup&gt; code appears here');

	watch(scriptText, data => {
		localStorage.setItem('sfc', data ?? '');
		const parts = splitSFC(data.replace(/scrpt/g, 'script'));
		templateText.value = parts.templateNode ?? '';
		styleText.value = parts.styleNode ?? '';
		try {
			const result = parts.scriptBody ? transpile(parts.scriptBody) : '';
			transformed.value = hljs.highlight(result, { language: 'typescript' }).value;
		} catch(ex: any) {
			transformed.value = ex?.message ?? JSON.stringify(ex);
		}
	}, { immediate: true });
</script>
