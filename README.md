# unclassify

## TODOs
[ ] Add everything outside class (types, consts etc)
```
    const namespace = StoreModule.quotationLineItem;
    const notSelectedCell = {
        rowIndex: -1,
        columnName: "",
    };
    const PERFORMANCE_MAX_ROWS = 25;
    interface xyzzy { a: number[] }
    function nicety(a: number) { return a+5; }
    const nicety2 = (a: number) => a+7;
```

[ ] Only transpile ThisExpressions not to clobber locals: `const gridApi = this.gridApi;`

[ ] Proper transpilation of functions:
```
    const quotationLineItemCollection = computed((): QuotationLineItemCollection | undefined => {
        if (inHistoryMode.value === true) {
            return revisionQuotationLineItemCollection.value;
        }
        return latestQuotationLineItemCollection.value;
    });
``` 
currently becomes
```
const quotationLineItemCollection = computed((): QuotationLineItemCollection | undefined {
        if (inHistoryMode.value === true) => {
            return revisionQuotationLineItemCollection.value;
        }
        return latestQuotationLineItemCollection.value;
    });
```

[ ] Handle toNative:
```
<script lang="ts">
    import { Component, Vue, toNative } from "vue-facing-decorator";

    @Component class QuotationListView extends Vue { }
    export default toNative(QuotationListView)
    export { QuotationListView }
</script>
```

### More expensive TODOs
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
