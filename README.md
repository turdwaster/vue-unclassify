# vue-unclassify

Generate Vue3 composition SFC from Vue2/3 class-based single file components.

Usage: `vue-unclassify [-r/--replace] [file patterns...]`
...or run front end with interactive transpilation (WIP)

## Useful links
[AST explorer, many languages etc](https://astexplorer.net/)
[AST viewer for TypeScript (not ESTree format?)](https://ts-ast-viewer.com/)

## TODOs

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
