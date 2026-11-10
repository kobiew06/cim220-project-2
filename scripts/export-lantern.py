"""Run with Blender: blender --background --python scripts/export-lantern.py."""
from pathlib import Path

import bpy

project = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(project / "assets" / "lantern.blend"))
for image in bpy.data.images:
    if image.name == "images.jpeg":
        image.filepath = str(project / "assets" / "textures" / "images.jpeg")
        image.reload()
bpy.ops.export_scene.gltf(
    filepath=str(project / "assets" / "lantern.glb"),
    export_format="GLB",
    export_apply=True,
    export_cameras=False,
    export_lights=False,
)
