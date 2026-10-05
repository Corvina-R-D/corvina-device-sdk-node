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

Both packages are published to npm under the `@corvina` scope, each with its own version ([lerna independent mode](./lerna.json)). The root `corvina-device-sdk` package is private and never published.

Releasing has two steps:

1. `lerna version` bumps the versions, commits them and creates and pushes the tags.
2. `npm publish` uploads each package to npm.

We don't use `lerna publish`. It can only take a 6-digit one-time password, so it gets stuck on accounts that use a security key or passkey for 2FA. `npm publish` asks you to approve with the security key in the browser instead, so you don't need an access token.

### Prerequisites

- An npm account with publish rights on the `@corvina` organization: run `npm login` and check it with `npm whoami`.
- Push rights on the GitHub repository, because lerna pushes a commit and tags.
- A clean working tree and all the tags (`git fetch --tags`). lerna finds the changed packages by comparing each one with its latest `<package>@<version>` tag that is reachable from the current branch.

### Release workflow

`master` is protected and only accepts squash-merged pull requests, so you release from the development branch, as the last step before merging it:

1. Make sure the branch exists on GitHub and is up to date with it (lerna refuses to run otherwise):

   ```bash
   git push -u origin <branch>
   git pull
   ```

2. Bump the versions and publish from the branch as described below. lerna commits the new versions and pushes the commit and the tags to the same branch, so they become part of the pull request.
3. Squash-merge the pull request.
4. Move the release tags onto the squashed commit on `master`, so that the next release compares with it:

   ```bash
   git checkout master && git pull
   for tag in @corvina/device-client@<version> @corvina/device-example@<version>; do
       git tag -f "$tag" master && git push -f origin "refs/tags/$tag"
   done
   ```

   If you skip this step, nothing breaks, but lerna compares with an older release and may list packages as changed even when they aren't.

Publishing sends the branch's code to npm before the pull request is merged. Publish only once the pull request is approved, and don't push other changes to the branch afterwards.

### 1. Bump the versions

From this `app` directory, run `yarn lerna changed` first to see which packages would be released, then:

```bash
yarn lerna version --no-private
```

**You don't need to edit the versions in `package.json` by hand.** `lerna version`:

1. finds the packages changed since their last release tag;
2. asks you the new version of each one (patch, minor, major or a custom version). It also bumps the packages that depend on a changed package: a new `@corvina/device-client` also releases `@corvina/device-example`, with its dependency range updated;
3. writes the new versions in the `package.json` files, commits them with a `Publish` message and creates a `<package>@<version>` tag for each package;
4. pushes the commit and the tags to the git remote.

To skip the prompts, pass the bump type: `yarn lerna version patch --no-private` (or `minor`, `major`), optionally with `--yes`.

### 2. Publish to npm

Publish `@corvina/device-client` first, because `@corvina/device-example` depends on it. npm asks you to confirm each publish with your 2FA (security key in the browser, or a one-time password).

```bash
cd libs/device-client
npm pack --dry-run   # optional: check the files that will be published
npm publish          # the prepare script builds the package

cd apps/example
yarn build           # no prepare script here, build it first
npm pack --dry-run
npm publish
```

If only one package changed, publish only that one.

### If something goes wrong

- **`Branch '<branch>' doesn't exist in remote`** or **`Local branch '<branch>' is behind remote upstream`**: push or pull the branch (step 1 of the release workflow) and run `lerna version` again.
- **`npm publish` failed after `lerna version`**: don't run `lerna version` again, because it would bump the versions a second time. Fix the problem and run `npm publish` again in the package directory. It publishes the version already written in `package.json`.
- **Modified `package.json` files with only a `gitHead` change**: lerna leaves these behind. Discard them with `git checkout -- '*/package.json'`.

After publishing, check the new versions with `npm view @corvina/device-client version` and `npm view @corvina/device-example version`. `npx @corvina/device-example@latest` then runs the new release.
