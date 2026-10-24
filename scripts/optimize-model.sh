#!/usr/bin/env bash
# Usage: npm run model:optimize -- models/source/thing.glb
# Writes public/models/<name>.desktop.glb and <name>.mobile.glb using glTF-Transform (downloaded by npx on first use).
set -euo pipefail
in="${1:?Usage: npm run model:optimize -- path/to/model.glb}"
name="$(basename "${in%.*}")"
out="public/models"
mkdir -p "$out"
GT="npx --yes @gltf-transform/cli@4"

# Desktop and tablet: clean up, resize textures to 2048, WebP, meshopt compression.
$GT optimize "$in" "$out/$name.desktop.glb" --compress meshopt --texture-compress webp --texture-size 2048

# Phones: same, but simplify the mesh to about 35% and use 1024 textures.
$GT optimize "$in" "$out/$name.mobile.glb" --compress meshopt --texture-compress webp --texture-size 1024 --simplify true --simplify-ratio 0.35 --simplify-error 0.01

ls -l "$out/$name.desktop.glb" "$out/$name.mobile.glb"
