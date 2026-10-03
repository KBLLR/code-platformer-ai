# Canonical checkout topology

This house does not build from a standalone clone. It declares a workspace
sibling:

```json
"@corex/warehouse-client": "file:../../warehouse/client"
```

so `pnpm install` resolves `../../warehouse/client` relative to this directory.
A clone of `code-platformer-ai` on its own therefore fails with:

```
ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND  Could not install from ".../warehouse/client"
```

That is the declared dependency doing its job, not a defect in the install.

## Required layout

```
<core-x-root>/
├── warehouse/
│   └── client/          ← the @corex/warehouse-client package
└── houses/
    └── code-platformer-AI/   ← this repository
```

`warehouse/` must be a real sibling directory. Symlinks happen to work, but the
supported arrangement is the monorepo checkout; nothing in the build depends on
a symlink, and no developer-specific path is committed.

## Verifying a clean install

From `<core-x-root>/houses/code-platformer-AI`:

```bash
pnpm install --frozen-lockfile
pnpm run validate:contracts
pnpm run validate:roster
pnpm run test:smoke
pnpm run build
```

`--frozen-lockfile` is the determinism check: it fails if `pnpm-lock.yaml` does
not already satisfy `package.json`. The lockfile previously omitted
`@corex/warehouse-client` and `@pmndrs/viverse` even though both were declared,
so a frozen install could not succeed; both are now resolved in the lockfile's
`importers` block.

## Why zod is pinned

`package.json` carries:

```json
"pnpm": { "overrides": { "zod": "3.24.2" } }
```

`@corex/warehouse-client` depends on `zod ^3.24.2`, which floats up to 3.25.x.
zod **3.25.76 ships a broken ESM build**: `v3/external.js` imports
`./helpers/typeAliases.js`, and the published package contains only
`typeAliases.d.cts` and `typeAliases.d.ts` — no runtime `.js`. Any Node ESM
import of the warehouse client then dies with `ERR_MODULE_NOT_FOUND`, which
takes out `validate:roster` and anything else that loads the client outside the
bundler.

Reproduce without any of this house's code:

```bash
node --input-type=module -e "import('zod')"   # ERR_MODULE_NOT_FOUND on 3.25.76
```

The pin is a determinism fix, not a version preference. Remove it once the
upstream ESM build is repaired and the import above succeeds on the floated
version.
