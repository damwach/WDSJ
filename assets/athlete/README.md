# Original SKYLIFT athlete source

Open `athlete.blend` in Blender 4.3+. The final weighted suit, armature, head and accessories are editable. The hidden Construction collection contains the authored section cages. Rebuild from the repository root with:

```sh
blender -b --python assets/athlete/build.py
```

This writes the `.blend`, GLB and `src/athlete/assets/bind-frames.json`. Commit all three after editing. The section script is the repeatable authoring source; the `.blend` is the direct sculpt/weight-editing source. No third-party model or photographic texture was used. Source photographs retain their own licences in `references/athlete/README.md` and are excluded from the GLB.

The export is embedded by Vite so standalone HTML continues working offline. GLTFLoader parses it once; SkeletonUtils clones each character's armature. Skin weights deform the mesh on the GPU. No geometry is generated in the frame loop. Bind frames are in game metres (+X forward, +Y up); the exporter converts Blender Z-up.
