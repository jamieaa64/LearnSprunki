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

- Unit tests cover standard keyboard ranges, Auto sizing, safe expansion,
  extension manifests, API immutability and controller lifecycle.
- Integration tests validate the three core demos, every extension catalogue,
  all referenced MIDI/audio/image assets, game/character relationships and the
  production bundle.
- Architecture tests prevent Sprunki names or direct Learn Sprunki imports
  from leaking back into NeoKeys core.
- Browser regression checks should cover start-up, a core demo, a pitched
  Sprunki lesson, a rhythm lesson, Auto keyboard sizing and tablet layout.

When fixing a bug, first add the smallest test that reproduces it at the lowest
appropriate layer. Content failures should normally be expressed through the
validator rather than a browser test.
