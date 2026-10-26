# Corvina simulated device example

This is a monorepo containing the core device client library `@corvina/device-client` and an example `@corvina/device-example`.

To install the dependencies for development, run `yarn install` in this `app` directory.  
Then, remember to `yarn workspaces focus` in the respective package when working on it.

## Running the tests

Run the tests from the package directory, so that jest uses the package's `ts-jest` configuration:

```bash
cd libs/device-client
yarn test
```

`yarn test` in this `app` directory runs the tests of every package through lerna.

## Publishing new versions

Both packages are published to npm under the `@corvina` scope, always together and at the same version. The root `corvina-device-sdk` package is private and never published.

Create a GitHub release with tag `X.Y.Z` (or `X.Y.Z-beta.N` marked as pre-release, published under the `beta` dist-tag). The [Publish](../.github/workflows/publish.yaml) workflow:

1. runs the tests and builds both packages;
2. publishes `@corvina/device-client`, then `@corvina/device-example` with its dependency on the client set to `^X.Y.Z`;
3. bumps the versions in `package.json`, `lerna.json` and `yarn.lock` on `master` through an automatically merged pull request.

You don't need to edit the versions by hand. A re-run of a failed workflow skips the packages already published.

After publishing, `npx @corvina/device-example@latest` runs the new release.
