/**
 * Test stub for the `server-only` package.
 *
 * The real package throws on import unless the bundler has already substituted
 * it, which is exactly the guard that stops a server module being pulled into a
 * client bundle. Under vitest there is no client bundle -- the modules under test
 * really are running on a server -- so the guard is mapped here instead of being
 * deleted from the source, where it still does its job.
 */
export {};
