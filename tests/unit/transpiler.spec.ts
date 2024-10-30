import { transpile, transpileTemplate } from '@/transpiler';
import { transpileSFC } from '@/sfc';
import { toMatchFile } from 'jest-file-snapshot';
import { readVueFile, vueFiles } from './testUtils';

expect.extend({ toMatchFile });

function makeClass(body: string) {
    return `
        import Vue from 'vue';
        import { Component } from 'vue-property-decorator';

        @Component({ components: { } })
        export default class ComponentClass extends Vue {
            ${body}
        }`;
}

describe('transpiled', () => {
    vueFiles.forEach(name =>
        it(name, () => {
            const { scriptBody } = transpileSFC(readVueFile(name));
            expect(scriptBody).toMatchFile();
        })
    );
});

describe('transpiler', () => {
    it(`updates imports`, () => {
        const src = `
            import Vue from 'vue';
            import { Component } from 'vue-property-decorator';
            import { Beirut } from '@/x/y/zyzz';

            @Component({ components: { } })
            export default class SelectField extends Vue { }`;
        const res = transpile(src);
        expect(res).toContain('from \'vue\'');
        expect(res).not.toContain('Vue');
        expect(res).not.toContain('vue-property-decorator')
        expect(res).toContain('zyzz');
    });

    it(`keeps comments`, () => {
        const src = `
            import Vue from 'vue';
            import { Component } from 'vue-property-decorator';

            // Boy, what a great class!
            @Component
            export default class SelectField extends Vue {
                // Best member ever!
                public a = 2;

                // Two lines (1)
                // Two lines (2)
                public b = 2;

                /* Block comment #1
                   Block comment #2 */
                private x: any;

                private c: any; // Same line comment
            }`;

        const res = transpile(src);
        for (const comment of ['Boy, what a great class!', 'Best member ever!', 'Two lines (1)', 'Two lines (2)',
            'Block comment #1', 'Block comment #2', 'Same line comment']) {
            expect(res).toContain(comment);    
            expect(res.indexOf(comment)).toEqual(res.lastIndexOf(comment));
        }
    });

    it(`handles interface before @Component`, () => {
        const src = `
            import Vue from 'vue';
            import { Component } from 'vue-property-decorator';

            interface SelectValue { text: string; }

            @Component({ components: { } })
            export default class SelectField extends Vue { }`;
        const res = transpile(src);
        expect(res).toContain('interface SelectValue');
    });

    it(`includes code outside default class`, () => {
        const src = `
            import Vue from 'vue';
            import { Component } from 'vue-property-decorator';

            interface SelectValue { text: string; }
            const extVar = 2;

            @Component({ components: { } })
            export default class SelectField extends Vue { }`;
        const res = transpile(src);
        expect(res).toContain('interface SelectValue');
        expect(res).toContain('const extVar');
    });

    it(`resolves ref.value`, () => {
        const src = makeClass(`
            public obs = 'a';
            public get getA() { return this.obs; }
        `);
        const res = transpile(src);
        expect(res).toContain('obs.value');
        expect(res).not.toContain('this');
    });

    it(`resolves computed.value`, () => {
        const src = makeClass(`
            public get getA() { return 123; }
            public get getB() { return this.getA; }
        `);
        const res = transpile(src);
        expect(res).toContain('getB =');
        expect(res).toContain('getA.value');
        expect(res).not.toContain('this');
    });

    it(`handles explicit computed return type`, () => {
        const src = makeClass(`
            get dirty(): boolean { return true; }
            get showPrice(): boolean | undefined { return this.model?.showPrice; }
            get tooltip(): string {
                if (this.dirty) {
                    return "Save changes";
                }
            }    
        `);
        const res = transpile(src);
        expect(res).toContain('showPrice = computed((): boolean | undefined => {');
        expect(res).toContain('tooltip = computed((): string => {');
        expect(res).toContain('if (dirty.value)');
        expect(res).not.toContain('this');
    });

    it(`handles implicit ref() type`, () => {
        const src = makeClass(`
            public typeLess1 = [1,2,3];
            public typeLess2 = { a: 123 };
            public typeLess3 = 9;
        `);
        const res = transpile(src);
        expect(res).not.toContain('ref<');
        expect(res).toContain('typeLess1 = ref([');
        expect(res).toContain('typeLess2 = ref({');
        expect(res).toContain('typeLess3 = ref(9');
    });

    it(`handles shadowed non-refs`, () => {
        const src = makeClass(`
        pumpGridTab = 'a';
        gridApi: GridApi | undefined;
    
        setGridTab(autoSizeColumns = true): void {
            if (!this.pumpGridTab || !this.gridApi)
                return;
            const gridApi = this.gridApi;
            gridApi.deselectAll();
        }
    
        get selectedLineItems() {
            return store.getters["selectedItemsIds"] as string[];
        }
        
        @Watch("selectedLineItems")
        onSelectedItemsChange() {
            if (this.selectedLineItems && this.selectedLineItems.length == 0 && this.gridApi) {
                this.gridApi.deselectAll();
            }
        }`);

        const res = transpile(src);
        expect(res).not.toContain('this.selectedLineItems');
        expect(res).not.toContain('= this.gridApi');
        expect(res).not.toContain('gridApi.value');
        expect(res).not.toContain('selectedLineItems &&');
        expect(res).not.toContain('selectedLineItems.length');
        expect(res).toContain('gridApi = gridApi');
        expect(res).toContain('selectedLineItems.value');
        expect(res).toContain('selectedLineItems = computed');
    });

    it(`transpiles static class member refs`, () => {
        const src = `
        import Vue from 'vue';
        import { ParamBag } from '@/common/ParamBag';

        @Component
        export default class ComponentClass extends Vue {
            private static staticMember: string[];
            private static staticMethod() { return 5; }

            public created() {
                if (!ComponentClass.staticMember)
                    ComponentClass.staticMember = ParamBag.aggregatedValueNames;
                ComponentClass.staticMethod();
            }
            
            public get aGetter() {
                ComponentClass.staticMethod();
                return ComponentClass.staticMember * ParamBag.aggregatedValueNames;
            }
        }`;
    
        const res = transpile(src);
        expect(res).not.toContain('ComponentClass');
        expect(res).toContain('staticMethod()');
        expect(res).toContain('staticMember');
        expect(res).toContain('ParamBag.aggregatedValueNames');
    });

    it(`transpiles $watch statements`, () => {
        const src = makeClass(`
        public saveTrigger = 123;

		public async created () {
			this.$watch('saveTrigger', () => this.saveModule()); 
		}

		mounted() {
			this.$watch('saveTrigger', (val) => {
				if (true || this.saveTrigger > 5)
					this.deleteModule();
			});
		}`);

        const res = transpile(src);
        expect(res).toContain('watch(() => saveTrigger.value, () =>');
        expect(res).toContain('watch(() => saveTrigger.value, (val) =>');
        expect(res).not.toContain('$watch');
        expect(res).not.toContain('this');
    });

    it(`transpiles $emit statements`, () => {
        const src = makeClass(`
    	@Watch("filterJson")
        public onFilterChange() {
            this.$emit("filter", this.filter);
        }
        filter() { alert("Hit!"); }`);

        const res = transpile(src);
        expect(res).toContain('emit("filter", filter)');
        expect(res).toContain('const emit = defineEmits([\'filter\']);');
        expect(res).not.toContain('$emit');
        expect(res).not.toContain('this');
    });

    it(`transpiles $nextTick statements`, () => {
        const src = makeClass(`public pulseEvent(name: string) { this.$nextTick(() => (this as any)[name] = false); }`);
        const res = transpile(src);
        expect(res).toContain('nextTick(() => (this as any)[name] = false');
        expect(res).not.toContain('$nextTick');
        expect(res).not.toContain('this.');
    });

    it(`transpiles out-of-order computed references`, () => {
        const src = makeClass(`
            public get totW() { return this.totAxleW - this.minX; }
            public get totAxleW() { return this.axleX + 123; }
            public get minX() { return Math.min(22, 33); }
            public get axleX() { return this.minX + 2; }`);

        const res = transpile(src);
        expect(res).toContain('totAxleW.value - minX.value');
        expect(res).toContain('axleX.value + 123');
        expect(res).toContain('minX.value + 2');
        expect(res).not.toContain('this.');
    });

    it(`transpiles prop references in computeds`, () => {
        const src = makeClass(`
            @Prop() public id: string;
            @Watch('id')
            public async onBAchange(newId: string) {}
        `);

        const res = transpile(src);
        expect(res).toContain('props.id');
        expect(res).not.toContain('id.value');
        expect(res).not.toContain('this.');
    });

    it(`detects member-shadowing locals`, () => {
        const src = `import Vue from 'vue';
        @Component
        export default class ComponentClass extends Vue {
            public shadowed = 'text';

            public created() {
                const shadowed = this.shadowed;
                const notShadowed = this.notShadowed('An argument');
            }

            public notShadowed(x: string) {
                return x;
            }
        }`;
    
        const res = transpile(src);
        expect(res).toContain('Local \'shadowed\'');
        expect(res).not.toContain('Local \'notShadowed\'');
    });

    it(`handles vue-facing-decorator style`, () => {
        const src = `
        <script>
            const randomExport = 2;

            class HideSwitch extends Vue {
                get filterByStatus(): boolean {
                    return store.getters["\${StoreModule.quotationLineItem}/filterByStatus"] as boolean;
                }

                get hideOrShow(): boolean | undefined { return this.filterByStatus; } 

                set hideOrShow(value: boolean | undefined) {
                    store.dispatch("\${StoreModule.quotationLineItem}/\${QuotationLineItemAction.setFilterByStatus}",value);
                }
            }
            export default toNative(HideSwitch)
            export { HideSwitch }
        </script>`;
    });

    it(`transpiles $emit in template`, () => {
        const src = `<template>
            <v-btn x-small @click="$emit('change', 1)"><b>+</b></v-btn>
            <br />
            <v-btn x-small @click="$emit('change', -1)"><b>-</b></v-btn>
        </template>`;
        const res = transpileTemplate(src);
        expect(res).toContain('emit(\'change\'');
        expect(res).not.toContain('$emit');
    });

    it(`handles broken source ranges`, () => {
        const src = `export default class ParamList extends Vue { // Newline needed here to trigger
            @Watch('deepStuff') private onDeepChange(val: string) {}
        	public deepStuff = { deep: { val: 123 } };}`;
        const res = transpile(src);
        expect(res).toContain('watch(() => deepStuff.value, (val: string) =>');
        expect(res).not.toContain('omponent');
        expect(res).not.toContain('this');
        expect(res).not.toContain('ent');
    });
});
