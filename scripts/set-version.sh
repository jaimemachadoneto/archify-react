#!/usr/bin/env bash
# Write the version of a release into package.json. `deploy` runs this before
# it makes the tag, so the tag, the file and the tarball name agree.
set -euo pipefail

version="${1:?usage: set-version.sh X.Y.Z}"
node -e '
  const fs = require("node:fs");
  const file = "package.json";
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  pkg.version = process.argv[1];
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
' "$version"
