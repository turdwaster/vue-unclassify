<template>
	<div>
		Current value: {{ counter }} (twice: {{ doubled }})
		<button @click="increment">More!</button>
		<button @click="sendEvent">Send event to parent component</button>
	</div>
</template>

<script lang="ts">
	import Vue from 'vue';
	import { Component, Watch } from 'vue-property-decorator';

	@Component export default class ExampleComponent extends Vue {
		public counter = 0;
		public get doubled() { return this.counter * 2; }

		public increment() {
			this.counter++;
		}

		public sendEvent() {
			this.$emit('change');
		}

		// This is a really stupid reason for adding a watch
		@Watch('counter')
		public onCounterChanged(newValue: number) {
			/*
				TODO: Do something better instead of this, as I
				point out in this huge comment block...
			*/
			ExampleComponent.randomStaticMethod();
			alert('Counter changed to ' + newValue);
		}

		private static randomStaticMethod() {
			console.log('TODO: implement');
		}
	}
</script>

<style>
	div { color: red; }
</style>
