<template>
	<div>
		<template v-if="!inline && inline !== ''" no-gutters>
			<v-combobox outlined v-if="predefValues" :label="description" v-model="value" @change="valueChange" :error="!!errors" :disabled="readOnly" :readonly="readOnly" 
				:error-messages="messages" :messages="infos" :class="errorClass" style="background-color: transparent !important;" :error-count="2" :suffix="unit" :prefix="prefix"
				:items="predefValues" return-object item-text="text" item-value="text">
				<template v-slot:append>
					<v-menu style="top: -12px" offset-y>
						<template v-slot:activator="{ on }">
							<v-btn icon v-on="on" :disabled="!showToggleAssumed" tabindex="-1" class="always-enabled combo-icon">
								<v-icon color="primary">more_horiz</v-icon>
							</v-btn>
						</template>
						<v-list min-width="150" v-if="showToggleAssumed">
							<v-list-item @click="toggleAssumed">
								<v-list-item-content>
									{{ isAssumed ? 'Mark as non-assumed' : 'Mark as assumed' }}
								</v-list-item-content>
							</v-list-item>
						</v-list>
					</v-menu>
				</template>
			</v-combobox>
			<v-text-field outlined v-else :label="description" v-model="value" @change="valueChange" :error="!!errors" :disabled="readOnly" :readonly="readOnly"
				:error-messages="messages" :messages="infos" style="background-color: transparent" :class="errorClass" :error-count="2" :suffix="unit" :prefix="prefix">

				<!-- dropdown -->
				<template v-slot:append>
					<v-menu style="top: -12px" offset-y>
						<template v-slot:activator="{ on }">
							<v-btn icon v-on="on" :disabled="!showMenu" tabindex="-1" class="text-field-icon">
								<v-icon color="primary">more_horiz</v-icon>
							</v-btn>
						</template>
						<v-list min-width="150">
							<template v-if="showMenu">
								<v-list-item v-if="target && commentField" @click="pulseEvent('createComment')" :class="commentField ? 'comment-field' : ''">
									<v-list-item-content class="comment-field">
										<v-btn dark>
											<span class="bw"><v-icon size="20px" class="ml-n2 mb-1">$comment</v-icon> Add comment</span>
										</v-btn>
									</v-list-item-content>
								</v-list-item>
								<v-list-item v-if="showToggleAssumed" @click="toggleAssumed">
									<v-list-item-content>
										{{ isAssumed ? 'Mark as non-assumed' : 'Mark as assumed' }}
									</v-list-item-content>
								</v-list-item>
								<v-subheader v-if="usableUnits.length > 0">Unit</v-subheader>
								<v-list-item v-for="unit of usableUnits" :key="unit.id" @click="unitChange(unit)">
									<v-list-item-content>
										<v-list-item-title v-text="unit.name"></v-list-item-title>
									</v-list-item-content>
									<v-list-item-action>
										<v-icon v-if="unitValue.currentUnit.name === unit.name">$checkMark</v-icon>
									</v-list-item-action>
								</v-list-item>
							</template>
						</v-list>
					</v-menu>
					<CommentIcon v-if="target && commentField" :target="target" :field="commentField" :show="createComment" type="Comment" class="mt-n2 mr-n1"/>
				</template>
			</v-text-field>
		</template>
		<template v-if="(inline || inline === '') && (value || errors) || show">
			<v-tooltip bottom :disabled="!errorClass" :color="errorClass" max-width="500" open-delay="500">
				<template v-slot:activator="{ on }">
					<div class="readonlyValue pb-2" v-on="on">
						{{ description }}:
						<transition name="change" mode="out-in">
							<b :key="baseUnitValue" :class="errorClass">{{ prefix }}{{ value === null ? 'N/A' : value }}&nbsp;{{ unit }}</b>
						</transition>
					</div>
				</template>
				<span>{{ messages && messages.join('\n') }}</span>
			</v-tooltip>
		</template>
	</div>
</template>

<style lang="scss" scoped>
	@import '@/sass/main.scss';

	.v-list-item:hover {
		background-color: $selection-lighten-1;
	}
	.change-enter-active {
		transition: background-color 5s;
	}
	.change-leave-active {
		transition: background-color 0.25s;
	}
	.change-enter, .change-leave-to {
		background-color: #ddf;
	}
	/* Remove default opaque background when warning/error/info classes are applied */
	.warning.v-input, .error.v-input, .info.v-input {
		background-color :transparent !important;
	}
	.comment-field {
		color: $secondary;
	}
	.comment-field:hover {
		background-color: $white !important;
	}
	.v-list-item--link.black {
		background-color: $primary;
	}
	.combo-icon {
		margin: -11px -5px 0 0px;
		border-radius: 3px;
	}
	.text-field-icon {
		margin: -2px -5px 0 0px;
		border-radius: 3px;
	}
	/* Force the menu to appear enabled for the v-combobox since it triggers the preselect dropdown */
	.theme--light.v-btn.v-btn--disabled.always-enabled .v-icon {
		color: rgba(0, 0, 0, 0.54) !important;
	}
</style>

<script lang="ts">
	import Vue from 'vue';
	import { Component, Prop, Watch } from 'vue-property-decorator';
	import { ParamValue } from '@/common/ParamValue';
	import { SelectValue } from 'types/dto/CalcServiceDomain';
	import UnitValue from '@/common/UnitValue';
	import CommentIcon from '@/components/CommentIcon.vue';
	import { tryToTranslate } from '@/i18n';

	interface Unit {
		id: string;
		name: string;
		factor: number;
		offset?: number;
		imperial?: boolean;
		base: string;
		group?: string;
	}

	@Component({
		components: {
			CommentIcon
		}
	})
	export default class UnitNumeric extends Vue {
		@Prop() public param: ParamValue;
		@Prop() public locked: boolean;
		@Prop() public readwrite: boolean;
		@Prop() public show: boolean;
		@Prop() public writable: boolean;
		@Prop() public customDescription: string;
		@Prop() public inline: string;
		@Prop() public onChange: (newValue: any) => void;
		@Prop() public target: string;
		@Prop() public minValue: number;
		@Prop() public maxValue: number;

		public createComment: boolean = false;
		public currentUnit: Unit = null;
		private enteredUnit: Unit = undefined;
		private enteredValue: string = undefined;

		public unitValue: UnitValue = null;
		public value: string | SelectValue | null = null;

		get usableUnits() {
			return this.unitValue?.usableUnits || [];
		}

		get description() {
			if (this.customDescription)
				return this.customDescription;
			const pdef = this.param?.definition;
			return pdef && (tryToTranslate(pdef.Name) || pdef.Description) || 'No title';
		}

		get prefix() {
			return this.isAssumed ? '≈ ' : '';
		}

		get unit() {
			return this.unitValue?.unitString;
		}

		get readOnly() {
			return !this.param || (this.param.definition?.ReadOnly && !this.writable) ||
				this.locked || (this.inline || this.inline === '') || false;
		}

		get messages() {
			return (this.warnings || this.errors) && (this.warnings || []).concat(this.errors || []);
		}

		get useImperial() {
			return this.param.useImperialUnits;
		}

		get baseUnitValue(): number {
			return this.unitValue?.baseUnitValue;
		}

		get predefValues(): SelectValue[] {
			const unit = this.currentUnit;
			if (!unit || !this.param)
				return null;

			const def = this.param?.definition;
			const values = (unit.imperial && def.ImperialValues || def.Values || []);
			if (!values || !values.length)
				return null;

			return values.map(x => {
				const value = new UnitValue(x.value, unit.id, def.Decimals, unit.imperial).valueString;
				const text = x.text && x.text !== value ? `${UnitValue.readableString(x.text)} (${value})` : value;
				return { text, value };
			});
		}

		get errorClass() {
			let classNames = this.isAssumed ? 'assumed ' : '';
			if (this.errors?.length)
				classNames += 'error';
			else if (this.warnings?.length)
				classNames += 'warning';
			else if (this.param.infos?.length) {
				// Not testing "full" this.infos since this would make "Using xx kg" blue
				classNames += 'info';
			}
			return classNames;
		}

		get staticErrors(): string {
			const def = this.param?.definition;
			if (!def || def.ReadOnly)
				return;

			if (def.Type === 'Number') {
				const rawVal = this.value as string;
				if (rawVal != null && rawVal.length && isNaN(parseFloat(rawVal.replace(',', '.'))))
					return 'Not a valid number';
			}

			const val = this.baseUnitValue;
			if (val != null) {
				const min = this.minValue ?? def.StaticMin;
				if (min != null && val < min)
					return 'Value is too small';
				const max = this.maxValue ?? def.StaticMax;
				if (max != null && val > max)
					return 'Value is too large';
			}
		}

		// Be sure to return undefined here instead of null, since v-text-field dies if @messages = null
		get errors() {
			if (this.staticErrors)
				return [this.staticErrors];
			const e = this.param?.errors;
			return e?.length && e.map(x => x.Message) || undefined;
		}

		get warnings() {
			const e = this.param?.warnings;
			return e?.length && e.map(x => x.Message) || undefined;
		}

		get infos() {
			if (!this.param)
				return undefined;
			let all: string[] = [];
			const usedMessage = this.usedMessage(this.param.usedValue);
			if (usedMessage)
				all.push(usedMessage);
			const infos = this.param.infos;
			if (infos?.length)
				all = all.concat(infos.map(x => x.Message));
			return all?.length ? all : undefined;
		}

		get commentField(): string {
			return this.param?.valueName;
		}

		get showMenu() {
			return !!(this.usableUnits.length > 0 || this.target && this.commentField || this.showToggleAssumed);
		}

		get showToggleAssumed() {
			return !this.readOnly && this.param?.canBeAssumed && (this.isAssumed || this.baseUnitValue != null);
		}

		public get isAssumed() {
			return this.param?.isAssumed;
		}

		public toggleAssumed() {
			this.param?.toggleAssumed();
		}

		private usedMessage(usedValue: string) {
			if (usedValue == null)
				return null;
			const unitId = this.unitValue?.unit?.id;
			if (!unitId)
				return null;
			const uv = new UnitValue(usedValue, unitId, this.param.definition.Decimals, this.useImperial);
			return 'Using ' + uv.toString();
		}

		public mounted() {
			if (!this.param)
				return;

			this.unitValue = this.param.getUnitValue(this.useImperial);
			this.currentUnit = this.unitValue.unit;
			this.loadValue(this.param.getValue());

			// Value is only updated from backend if explicitly specified or if it is read-only,
			// to avoid write -> update -> write infinite loops
			const readWrite = this.readwrite || (this.readwrite as any as string) === '';
			if (readWrite || this.param?.definition?.ReadOnly)
				this.$watch('backingValue', (x: any) => this.loadValue(x));
		}

		private get backingValue() {
			return this.param?.getValue();
		}

		private loadValue(value: any) {
			this.unitValue.setBaseUnitValue(value);
			this.value = this.selectedPreset(value) || this.unitValue.valueString;
		}

		private selectedPreset(value: string) {
			if (value != null && this.predefValues?.length) {
				const valueInCurrentUnit = this.unitValue?.valueString;
				// Try to match a unique predefined value if present (weak equality to match numbers against predef:ed strings)
				// tslint:disable-next-line: triple-equals
				const predefs = valueInCurrentUnit && this.predefValues.filter(x => (x as any).value == valueInCurrentUnit);
				if (predefs?.length === 1)
					return predefs[0];
			}
		}

		public unitChange(newUnit: Unit, baseUnitValue?: number) {
			this.unitValue.changeUnit(newUnit);

			const eu = this.enteredUnit;
			const ev = this.enteredValue;
			if (eu && ev && newUnit && eu.name === newUnit.name && ev !== this.value) {
				// Restore previously entered value when switching back to unit used when entering it
				this.value = this.enteredValue;
				this.unitValue.set(this.enteredValue);
			} else
				this.value = this.unitValue.valueString;
		}

		public valueChange() {
			let value = this.value as string;

			if (this.value && (this.value as SelectValue).value) {
				// A SelectValue was selected; set underlying value to current entries' value instead of its text
				value = (this.value as SelectValue).value;

				// Set current value to the _value_ instead of its text
				// This is delayed since the v-combobox does not update properly when setting `this.value` if the current
				// selected object has the same `item-value`. This is also the reason for both item-text and item-value
				// being set to `text` since the component requires item-value to be unique and removes those with the
				// same values otherwise.
				if (this.value !== value)
					this.$nextTick(() => this.value = this.selectedPreset(value) || value);
			}
			this.enteredValue = value;
			this.enteredUnit = this.unitValue.unit;
			if (this.unitValue.set(value)) {
				if (!this.readOnly && !this.staticErrors) {
					if (this.onChange)
						this.onChange(this.unitValue.baseUnitValue);
					else
						this.param.setValue(this.unitValue.baseUnitValue);
				}
			}
		}

		public pulseEvent(name: string) {
			(this as any)[name] = true;
			this.$nextTick(() => (this as any)[name] = false);
		}

		@Watch('useImperial')
		private onSOUChange(value: boolean) {
			if (!this.unitValue)
				return;
			const newUnit = this.unitValue.changeSystemOfUnits(value);
			if (newUnit) {
				this.unitChange(newUnit);
				this.currentUnit = newUnit;
			}
		}
	}
</script>