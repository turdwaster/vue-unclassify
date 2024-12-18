# vue-unclassify

Generate Vue3 TypeScript `<script setup>` SFCs directly from Vue2/3 class-based single file TypeScript components. Can also be used to convert `vue-facing-decorator` classes to `<script setup>`.

This is very much an opinionated **alpha** version that only attempts to transform the `<script>` element of an SFC. There are surely heaps of bugs.

The resulting script is always reordered as
```html
<template>
    ... (minor replacements only as of now)
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

## Usage
`vue-unclassify [-r/--replace] [file patterns...]`
...or run front end with interactive transpilation (WIP)

## Features
* AST-based transpilation (90%) using `acorn` - a lot less fragile than existing RegEx tools
* Direct conversion to `<script setup>`
* Attempts to attach comments to original code

## Useful links
[Interactive online version](https://turdwaster.github.io/linden_dev/)
[AST explorer, many languages etc](https://astexplorer.net/)

## TODOs
[ ] Bug: Don't generate invalid uninitialized consts from static members; do `static` -> `let`, `static readonly` -> `const`

[ ] Propagate errors to stdout instead of dumping them in the script tag

[ ] Transpile `$router`

[ ] Improve method body extraction for created() (.substring hack)

Function shadowed by local

		const text = text(initialValue);


ReportCreation.vue

  public curveSettings: Partial<ReportInputs> = null;
  private bags: Record<string, ParamBag>;

blev

  const curveSettings = ref<Partial>(null);
  let bags: Record;
  
beforeDestroy -> onBeforeUnmount

// False positives för shadowing (skippa props):
const allParams = computed(() => {
	const filter = props.filter;
});

False positives i ProjectFilterPanel

// * Failed to interpret $emit call (script section, row 154)

### Lower priority TODOs
[ ] `this.$refs.xyz.focus` -> `const xyz = ref(); ... xyz.value.focus();`

[ ] For readonly members (`public readonly CUT: LengthType = 'Custom';`) -> skip the `ref()`

[ ] Handle multiple script/style sections (passthrough)

[ ] Refactor to allow custom section ordering/templates instead of hardcoded tag/script order

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
