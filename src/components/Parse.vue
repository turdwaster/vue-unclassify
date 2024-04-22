<template>
	<h1>Script</h1>
	<pre style="float: right; width: 48%">{{ transformed }}</pre>
	<textarea v-model="scriptText" style="width: 48%; height: 75vh; margin-left: 0; padding-left: 0" />
	<br clear="all" />
	<h1>Template</h1>
	<pre>{{ templateText }}</pre>
	<h1>Style</h1>
	<pre>{{ styleText }}</pre>
</template>

<script setup lang="ts">
	import { ref, watch } from 'vue';
	import { splitSFC, transpile } from '../transpiler';

	const templateText = ref();
	const styleText = ref();
	const scriptText = ref('');
	const transformed = ref('');

	watch(scriptText, data => {
		const parts = splitSFC(data.replace(/scrpt/g, 'script'));
		templateText.value = parts.templateNode ?? '';
		styleText.value = parts.styleNode ?? '';
		try {
			transformed.value = parts.scriptBody ? transpile(parts.scriptBody) : '';
		} catch(ex: any) {
			transformed.value = ex?.message ?? JSON.stringify(ex);
		}
	});
</script>
