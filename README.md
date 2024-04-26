# unclassify

Generate Vue3 composition SFC from Vue2 class-based SFC.

## Useful links
[AST explorer, many languages etc](https://astexplorer.net/)
[AST viewer for TypeScript (not ESTree format?)](https://ts-ast-viewer.com/)

## TODOs
[ ] Newline between functions

[ ] Function indentation - align block start/end

[ ] `computed(..., () => { \n* return y.value; \n* });` -> `computed(..., () => y.value);`

[ ] Handle toNative:
```
<script lang="ts">
    import { Component, Vue, toNative } from "vue-facing-decorator";

    @Component class QuotationListView extends Vue { }
    export default toNative(QuotationListView)
    export { QuotationListView }
</script>
```

### Lower priority TODOs
[ ] For readonly members (`public readonly CUT: LengthType = 'Custom';`) -> skip ref()

[ ] Fix up `$watch` (et al)

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
