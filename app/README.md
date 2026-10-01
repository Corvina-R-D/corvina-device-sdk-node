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

Both packages are published to npm under the `@corvina` scope with [lerna](https://lerna.js.org/) in [independent mode](./lerna.json): each package has its own version, and the root `corvina-device-sdk` package is private and never published.

### Prerequisites

- An npm account with publish rights on the `@corvina` organization: run `npm login` and check it with `npm whoami`. If the account uses 2FA, npm asks for a one-time password (or pass `--otp <code>`).
- Push rights on the GitHub repository, because lerna pushes a commit and tags.
- A clean working tree and all the tags (`git fetch --tags`). lerna finds the changed packages by comparing with each package's latest `<package>@<version>` tag that is reachable from the current branch.

### Release workflow

`master` is protected and only accepts squash-merged pull requests, so the release is done from the development branch, as the last step before merging it:

1. Make sure the branch exists on GitHub and is up to date with it (lerna refuses to run otherwise):

   ```bash
   git push -u origin <branch>
   git pull
   ```

2. Publish from the branch as described below. lerna commits the new versions and pushes the commit and the tags to the same branch, so they become part of the pull request.
3. Squash-merge the pull request.
4. Move the release tags onto the squashed commit on `master`, so that the next release compares with it:

   ```bash
   git checkout master && git pull
   for tag in @corvina/device-client@<version> @corvina/device-example@<version>; do
       git tag -f "$tag" master && git push -f origin "refs/tags/$tag"
   done
   ```

   If you skip this step, nothing breaks, but lerna compares with an older release and may list packages as changed even when they aren't.

Publishing sends the branch's code to npm before the pull request is merged, so publish only once the pull request is approved, and don't push other changes to the branch afterwards.

### Publish

From this `app` directory (run `yarn lerna changed` first to see which packages would be released):

```bash
yarn run publish
```

The script builds every package (`lerna run build`), then runs `lerna publish --no-private`. **You don't need to edit the versions in `package.json` by hand: `lerna publish` bumps them for you.** It:

1. finds the packages changed since their last release tag;
2. asks you the new version of each one (patch, minor, major or a custom version). Packages that depend on a changed package are bumped too: a new `@corvina/device-client` also releases `@corvina/device-example`, with its dependency range updated;
3. writes the new versions in the `package.json` files, commits them with a `Publish` message and creates a `<package>@<version>` tag for each package;
4. pushes the commit and the tags to the git remote;
5. publishes the packages to npm.

To skip the prompts, pass the bump type: `yarn run publish patch` (or `minor`, `major`), optionally with `--yes`.

### If something goes wrong

- **`Branch '<branch>' doesn't exist in remote`** or **`Local branch '<branch>' is behind remote upstream`**: push or pull the branch (step 1 of the release workflow) and run the publish again.
- **The versions were pushed but the npm publish failed** (for example a wrong OTP): don't run `lerna publish` again, it would bump the versions a second time. Publish the versions already written in `package.json` instead:

  ```bash
  yarn run build && yarn lerna publish from-package --no-private
  ```

After publishing, check the new versions with `npm view @corvina/device-client version` and `npm view @corvina/device-example version`; `npx @corvina/device-example@latest` then runs the new release.
