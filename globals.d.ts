/**
 * `global` for libraries that still reach for it.
 *
 * react-native-iap's source uses `global` in its debug helper, and TypeScript
 * type-checks that source because the package resolves to .ts rather than to
 * declarations. Our own code uses `globalThis`; this exists so one dependency
 * cannot fail the type check for the whole app.
 */
declare var global: typeof globalThis;
