# vue-unclassify

Generate Vue3 TypeScript composition SFC from Vue2/3 class-based single file TypeScript components. Can also be used to convert `vue-facing-decorator` classes to `<script setup>`.

This is very much an opinionated **alpha** version that only attempts to transform the `<script>` element of an SFC. There are surely heaps of bugs.

The resulting script is always reordered as
```html
<template>
    ... (unchanged as of now)
</template>
<script setup>
  // Static/non-class/non reactive code
  // Props
  // Emits
  // State (ref:s)
  // Computeds
  // Watches
  // Initialization (onMounted et al)
  // Functions (former member methods)
  // Exports (other than default Vue class)
</script>
<style>
   ... (as-is)
</style>
```

Usage: `vue-unclassify [-r/--replace] [file patterns...]`
...or run front end with interactive transpilation (WIP)

## Useful links
[AST explorer, many languages etc](https://astexplorer.net/)
[AST viewer for TypeScript (not ESTree format?)](https://ts-ast-viewer.com/)

## TODOs
[ ] Report that no files match input pattern

[ ] Transpile `$emit` in `template`

### Lower priority TODOs
[ ] `this.$refs.xyz.focus` -> `const xyz = ref(); ... xyz.value.focus();`

[ ] `computed(..., () => { \n* return y.value; \n* });` -> `computed(..., () => y.value);`

[ ] For readonly members (`public readonly CUT: LengthType = 'Custom';`) -> skip ref()

[ ] Multiple script/style sections?

[ ] Resolve import name clashes (rename all locals if an imported name matched)
```
    import gridMapperService from "@/services/gridMapperService";
    const gridMapperService = computed((): any => gridMapperService);
```

## Project setup
```
pnpm install
```

### Run frontend for development
```
pnpm run build-web
pnpm run dev
```

### Compile and minify CLI
```
pnpm run build
```

### Run unit tests
```
pnpm run test
```
