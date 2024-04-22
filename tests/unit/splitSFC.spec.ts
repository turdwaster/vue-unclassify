import { splitSFC } from '@/transpiler';
import { toMatchFile } from 'jest-file-snapshot';
import { getVueFile } from './getVueFile';
 
expect.extend({ toMatchFile });

const vueFiles = ['Simple.vue', 'TextField.vue', 'SelectField.vue', 'UnitNumeric.vue'];
const vueFilesWithoutStyle = ['SelectField.vue'];

describe('splitSFC', () => {
  vueFiles.forEach(name => 
    it(`can split ${name} into parts`, () => {
      const src = getVueFile(name);
      const parts = splitSFC(src);
      expect(typeof(parts.scriptNode)).toBe('string');
      expect(typeof(parts.templateNode)).toBe('string');
      expect(typeof(parts.scriptBody)).toBe('string');
    })
  );
});

describe('splitSFC-style', () => {
  vueFiles.filter(x => !vueFilesWithoutStyle.includes(x)).forEach(name => 
    it(name, () => {
      const { styleNode } = splitSFC(getVueFile(name));
      expect(styleNode).toMatchFile();
    })
  );
});

describe('splitSFC-template', () => {
  vueFiles.forEach(name => 
    it(name, () => {
      const src = getVueFile(name);
      const { templateNode } = splitSFC(getVueFile(name));
      expect(templateNode).toMatchFile();
    })
  );
});

describe('splitSFC-scriptBody', () => {
  vueFiles.forEach(name => 
    it(name, () => {
      const src = getVueFile(name);
      const { scriptBody } = splitSFC(getVueFile(name));
      expect(scriptBody).toMatchFile();
    })
  );
});
