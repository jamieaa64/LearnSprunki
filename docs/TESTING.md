# Testing

The player uses Node's built-in `node:test` framework. It has no test-only
runtime dependency and runs the same way locally and in CI.

From `apps/player`:

```bash
npm test                  # all automated tests
npm run test:unit         # pure keyboard and extension-host behaviour
npm run test:integration  # catalogues, assets and production bundle
npm run test:architecture # core/extension separation rules
npm run validate:content  # complete content graph validation
npm run check             # validation, all tests and production build
```

## Test layers

- Unit tests cover standard keyboard ranges, automatic sizing, safe expansion,
  extension manifests, API immutability and controller lifecycle.
- Integration tests validate core demos, every registered extension catalogue,
  referenced assets and the production bundle.
- Architecture tests ensure core source and generic documentation do not
  acquire dependencies on installed extensions.
- Browser regression checks should cover start-up, a core demo, at least one
  track from each enabled extension, automatic keyboard sizing and tablet
  layout.

When fixing a bug, first add the smallest test that reproduces it at the lowest
appropriate layer. Content failures should normally be expressed through the
validator rather than a browser test.
