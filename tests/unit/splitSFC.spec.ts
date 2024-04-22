import { splitSFC } from '@/transpiler';
import { toMatchFile } from 'jest-file-snapshot';
import { readVueFile, vueFiles, vueFilesWithoutStyle } from './testUtils';
 
expect.extend({ toMatchFile });

describe('splitSFC', () => {
  vueFiles.forEach(name => 
    it(`can split ${name} into parts`, () => {
      const src = readVueFile(name);
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
      const { styleNode } = splitSFC(readVueFile(name));
      expect(styleNode).toMatchFile();
    })
  );
});

describe('splitSFC-template', () => {
  vueFiles.forEach(name => 
    it(name, () => {
      const src = readVueFile(name);
      const { templateNode } = splitSFC(readVueFile(name));
      expect(templateNode).toMatchFile();
    })
  );
});

describe('splitSFC-scriptBody', () => {
  vueFiles.forEach(name => 
    it(name, () => {
      const src = readVueFile(name);
      const { scriptBody } = splitSFC(readVueFile(name));
      expect(scriptBody).toMatchFile();
    })
  );
});
