# Testing Patterns

## Test Environment

- Vitest + happy-dom + `@vue/test-utils`.
- Tests use `setActivePinia(createPinia())` in `beforeEach`.
- Test files live next to source files (`*.spec.ts`).

## General Testing Gotchas

- **`@iconify/vue` triggers real CDN fetches in happy-dom.** The `<Icon>` component lazily fetches icon JSON on first render; in happy-dom teardown these get aborted, producing `DOMException [AbortError]` noise. Global mock lives in `src/test/setup.ts` (`vi.mock('@iconify/vue', ...)`) - do not remove it.
- **happy-dom defaults `navigator.language` / `navigator.languages` to `en-US`.** Anything that reads them in `onMounted` (e.g. `useI18nSync` resolving `'system'` locale) will pull tests off the project default. `src/test/setup.ts` mocks both to `DEFAULT_LOCALE` and resets `i18n.global.locale` in `afterEach`; do not remove either guard, and prefer reading `navigator.languages` only inside composables (not module top-level) so the mock applies.
- **`useEditorShortcuts` dispatches actions asynchronously (microtask).** Keyboard event handlers resolve via `Promise.resolve().then(...)`, so assertions after dispatching a key event must use `await vi.waitFor(() => expect(...))`, not synchronous `expect` or `await Promise.resolve()`.
- **Composable tests that call `seekPlayback` / `togglePlayback` must init audio transport.** `_audioTransport` starts as `null`; `seekPlayback` is a no-op without it. Call `await store.importAudioFile(new File([], 'test.mp3'))` in `async beforeEach` to trigger `_ensureAudioTransport()`.
- **Run Vitest verification serially.** Running `pnpm test:run` concurrently with other `pnpm` tasks can produce `Vitest failed to find the current suite` from `src/test/setup.ts`; rerun tests by themselves before treating it as a code failure.
- **Pinia setup store closure variables are invisible to DevTools `evaluate_script`.** Internal `_audioTransport`, `_rafId`, `_isPlaying` are not in `$state` or any public API. To debug, add temporary `console.log` in source - HMR won't reload Pinia stores, so use a full page refresh.
- **Icon tests can inspect the Icon stub prop.** For controls rendered with `@iconify/vue`, prefer `findComponent({ name: 'Icon' }).props('icon')` when asserting which icon is shown.
- **Hidden file input tests:** assign `input.files` with `Object.defineProperty(..., { configurable: true, value: [new File(...)] })`, then dispatch a `change` event on the input; clicking the visible button only proves `.click()` was invoked.

## Store Testing

The editor store uses `__override*Factory` exports for dependency injection. In tests, override factories before mounting:

```ts
__overrideAudioTransportFactory(() => mockAudioTransport)
__overrideMetronomeFactory(() => mockMetronomeScheduler)
setActivePinia(createPinia())
```

Avoid `vi.spyOn(store, 'actionName')` - Pinia wraps actions, making spies unreliable. Test state changes directly instead.

## Composable Testing

Composables that need a Vue component context are tested via a harness component:

```ts
const wrapper = mount(
  defineComponent({
    setup() {
      return useProjectPersistence({ onError })
    },
    template: '<div />',
  }),
)
```

Use `setActivePinia(createPinia())` before mount and override platform factories as needed. Assert by calling methods on the returned composable object or checking store state changes.
