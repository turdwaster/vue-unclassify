import fs from 'fs';
import path from "path";

export function getVueFile(name: string) {
  const absPath = path.join(__dirname, ".", "sfc", name);
  return fs.readFileSync(absPath, 'utf8');
}
