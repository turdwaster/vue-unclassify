import { splitSFC, transpile } from '@/transpiler';
import { toMatchFile } from 'jest-file-snapshot';
import { readVueFile } from './testUtils';

expect.extend({ toMatchFile });

function transpileFile(name: string) {
    const { scriptBody } = splitSFC(readVueFile(name));
    return transpile(scriptBody!);
}

function makeClass(body: string) {
    return `
        import Vue from 'vue';
        import { Component } from 'vue-property-decorator';

        @Component({ components: { } })
        export default class ComponentClass extends Vue {
            ${body}
        }`;
}

describe('transpile', () => {
    it(`updates imports`, () => {
        const src = `
            import Vue from 'vue';
            import { Component } from 'vue-property-decorator';

            @Component({ components: { } })
            export default class SelectField extends Vue { }`;
        const res = transpile(src);
        expect(res).toContain('from \'vue\'');
        expect(res).not.toContain('Vue');
    });

    it(`handles interface before @Component`, () => {
        const src = `
            import Vue from 'vue';
            import { Component } from 'vue-property-decorator';

            interface SelectValue { text: string; }

            @Component({ components: { } })
            export default class SelectField extends Vue { }`;
        transpile(src);
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
});
