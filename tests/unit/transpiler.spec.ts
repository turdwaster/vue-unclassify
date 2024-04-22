import { splitSFC, transpile } from '@/transpiler';
import { toMatchFile } from 'jest-file-snapshot';
import { readVueFile } from './testUtils';
 
expect.extend({ toMatchFile });
 
function transpileFile(name: string) {
    const { scriptBody } = splitSFC(readVueFile(name));
    return transpile(scriptBody!);
}

describe('transpile', () => {
    it(`handles interface before @Component`, () => {
      const src = `
        <script lang="ts">
            import Vue from 'vue';
            import { Component } from 'vue-property-decorator';

            interface SelectValue { text: string; }

            @Component({ components: { } })
            export default class SelectField extends Vue { }
        </script>`;
      transpile(src);
    })
});
