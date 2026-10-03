# Vendored — do not edit

Copied verbatim from the Claude Design package:

    Google Drive: core-x-design-system/Code Platformer/_ds/
                  kbllr-core-x-design-system-019e2ee5-e27d-7f24-97f5-d9d9805f8a1a

These files are the design authority for colour, type, material, motion and
ecosystem accents. They are vendored rather than retyped so the token values
cannot drift from the design, and rather than imported from Drive so the app
builds from a fresh clone with no Drive mount.

Only the CSS token layers are vendored. The package's `_ds_bundle.js` is a
bundled JSX component library; this house renders vanilla template literals, so
the component chrome is reproduced in `src/ui/corex/primitives.js` against
these same tokens instead of pulling React in.

To update: re-copy from the design package and bump the `?v=` cache-busters in
`styles.css`.
