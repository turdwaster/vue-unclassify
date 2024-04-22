import fs from 'fs';
import path from "path";

export const vueFiles = ['Simple.vue', 'TextField.vue', 'SelectField.vue', 'UnitNumeric.vue'];
export const vueFilesWithoutStyle = ['SelectField.vue'];

export function readVueFile(name: string) {
  const absPath = path.join(__dirname, ".", "sfc", name);
  return fs.readFileSync(absPath, 'utf8');
}
