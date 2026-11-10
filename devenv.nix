{ pkgs, ... }:
{
  name = "archify-react";

  # The node stack comes from devenv.stacks.nix (written by `base link`): it
  # maps fmt, lint, check, build and run to the package.json scripts.
  base.node.packageManager = "pnpm";
  # Browsers for `pnpm e2e` from nixpkgs. Keep @playwright/test in
  # package.json at the version the shell prints when they differ.
  base.node.playwright = true;

  # `git commit` runs these first, whatever made the change.
  base.preCommit = [ "lint" ];

  # The node stack gives nodejs-slim to a pnpm project, and it has no npx.
  packages = with pkgs; [ nodejs ];
}
