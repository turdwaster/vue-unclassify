<template>
	<div>
		<template v-if="readOnly && value">
			<v-tooltip bottom :disabled="!errorClass" :color="errorClass" max-width="500" open-delay="500">
				<template v-slot:activator="{ on }">
					<div class="readonlyValue" v-on="on">
						{{ description }}:
						<transition name="change" mode="out-in">
							<b :key="value" v-text="value" :class="errorClass" />
						</transition>
					</div>
				</template>
				<span>{{ messages && messages.join('\n') }}</span>
			</v-tooltip>
		</template>
		<v-form v-if="!readOnly" v-model="valid" @submit.prevent>
			<v-text-field outlined v-if="!textArea" v-model="value" :label="description" @change="valueChange" :error="!!errors"
				:error-messages="messages" :class="errorClass" :error-count="2" :rules="fieldRules" maxlength="500" :hide-details="hideDetails" />
			<v-textarea outlined v-if="textArea" v-model="value" :label="description" @change="valueChange" :error="!!errors"
				:error-messages="messages" :class="errorClass" :error-count="2" :rules="fieldRules" maxlength="2000" :hide-details="hideDetails" />
		</v-form>
	</div>
</template>

<style lang="scss" scoped>
	@import '@/sass/_variables.scss';

	.change-enter-active {
		transition: background-color 5s;
	}
	.change-leave-active {
		transition: background-color 0.25s;
	}
	.change-enter, .change-leave-to {
		background-color: #ddf;
	}

	/* Hack warning color of text field when warning/error classes are applied */
	.warning.v-input, .error.v-input {
		background-color:transparent !important;
	}
	.warning.v-input, .warning.v-input .error--text * {
		color: $warning !important;
		caret-color: $warning !important;
	}
</style>

<script lang="ts">
	import Vue from 'vue';
	import { Component, Prop } from 'vue-property-decorator';
	import { ParamValue } from '@/common/ParamValue';
	import { tryToTranslate } from '@/i18n';

	@Component
	export default class TextField extends Vue {
		@Prop() public param: ParamValue;
		@Prop() public locked: boolean;
		@Prop() public textArea: boolean;
		@Prop() public rules: any;
		@Prop({default: false}) public hideDetails: boolean;

		private enteredValue: string = undefined;
		private value: string | null = null;
		private fieldRules: any = [true];
		private valid: boolean = true;

		get description() {
			const pdef = this.param?.definition;
			return pdef && (tryToTranslate(pdef.Name) || pdef.Description) || 'No title';
		}

		get readOnly() {
			return !this.param || this.param.definition?.ReadOnly || this.locked || false;
		}

		get messages() {
			return (this.warnings || this.errors) && (this.warnings || []).concat(this.errors || []);
		}

		get errorClass() {
			if ((this.errors || []).length > 0)
				return 'error';
			if ((this.warnings || []).length > 0)
				return 'warning';
			return '';
		}

		get errors() {
			const e = this.param?.errors;
			return e?.length && e.map(x => x.Message) || null;
		}

		get warnings() {
			const e = this.param?.warnings;
			return e?.length && e.map(x => x.Message) || null;
		}

		public mounted() {
			if (!this.param)
				return;
			if (this.rules)
				this.fieldRules = [this.rules];

			this.value = this.param.getValue();

			if (this.param?.definition?.ReadOnly)
				this.$watch('backingValue', (x: any) => this.value = x);
		}

		public valueChange() {
			if (!this.valid && this.rules != null)
				return;
			const _value = this.value as string;
			this.enteredValue = _value;
			if (!this.readOnly)
				this.param.setValue(this.enteredValue);
		}

		private get backingValue() {
			return this.param?.getValue();
		}
	}
</script>