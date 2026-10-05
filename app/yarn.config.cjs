// Yarn constraints (https://yarnpkg.com/features/constraints). Check with "yarn constraints", fix with "yarn constraints --fix".

/** @type {import('@yarnpkg/types')} */
const { defineConfig } = require("@yarnpkg/types");

// Dependencies allowed to have different versions across workspaces
const VERSION_EXCEPTIONS = new Set(["@types/node"]);

module.exports = defineConfig({
    async constraints({ Yarn }) {
        for (const dependency of Yarn.dependencies()) {
            if (dependency.type === "peerDependencies") continue;

            // A workspace MUST depend on the same version of a dependency as the other workspaces
            if (!VERSION_EXCEPTIONS.has(dependency.ident) && !dependency.range.startsWith("workspace:")) {
                for (const other of Yarn.dependencies({ ident: dependency.ident })) {
                    if (other.type === "peerDependencies" || other.range.startsWith("workspace:")) continue;
                    dependency.update(other.range);
                }
            }

            // A dependency must not appear in both `dependencies` and `devDependencies`
            if (dependency.type === "devDependencies") {
                const prod = Yarn.dependency({
                    workspace: dependency.workspace,
                    ident: dependency.ident,
                    type: "dependencies",
                });
                if (prod) dependency.delete();
            }
        }
    },
});
