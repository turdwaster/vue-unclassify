# unclassify

Generate Vue3 composition SFC from Vue2 class-based SFC.

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

### Compiles and hot-reloads for development
```
pnpm run serve
```

### Compiles and minifies for production
```
pnpm run build
```

### Run your unit tests
```
pnpm run test:unit
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
