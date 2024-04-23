import { splitSFC, transpile } from '@/transpiler';
import { toMatchFile } from 'jest-file-snapshot';
import { readVueFile, vueFiles } from './testUtils';

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

describe('transpiled', () => {
    vueFiles.forEach(name =>
        it(name, () => {
            const { scriptBody } = splitSFC(readVueFile(name));
            const code = transpile(scriptBody!);
            expect(code).toMatchFile();
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
