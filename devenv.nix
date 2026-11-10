{ pkgs, ... }:
{
  name = "archify-react";

  # The node stack comes from devenv.stacks.nix (written by `base link`): it
  # maps fmt, lint, check, build and run to the package.json scripts.
  base.node.packageManager = "pnpm";
  # Browsers for `pnpm e2e` from nixpkgs. Keep @playwright/test at the version the shell prints.
  base.node.playwright = true;

  # `git commit` runs these first, whatever made the change.
  base.preCommit = [ "lint" ];

  # `deploy patch|minor|major` writes the version, tags `main` and pushes the tag.
  # The release workflow then packs the library and creates the GitHub release.
  base.release.enable = true;

  # The node stack gives nodejs-slim to a pnpm project, and it has no npx.
  packages = with pkgs; [ nodejs ];
}
