"""Blender BVH checks on decoded output, independent of exporter topology checks.
Run: blender -b --factory-startup --python tests/export-surface.check.py
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

directory = Path.cwd() / 'test-results/tachi-corrected'
def load(name):
    data = json.loads((directory / (name + '.json')).read_text())
    p = data['positions']; vertices = [p[i:i+3] for i in range(0, len(p), 3)]
    t = data.get('indices', list(range(len(vertices))))
    faces = [t[i:i+3] for i in range(0, len(t), 3)]
    return vertices, faces, BVHTree.FromPolygons(vertices, faces, all_triangles=True)

reference = load('reference'); candidates = {name: load(name) for name in ['stl','3mf','obj','glb','gltf']}
views = [(170,180,-220),(-170,180,-220),(170,-180,220),(-170,-180,220),(100,20,0),(0,20,-100)]
results = []
for view in views:
    direction = -Vector(view).normalized(); right = direction.cross(Vector((0,1,0))).normalized(); up = right.cross(direction).normalized()
    camera = -direction * 500
    probes = []
    for y in range(220):
        for x in range(300):
            origin = camera + right * ((x / 299 - .5) * 235) + up * ((y / 219 - .5) * 160)
            probes.append((origin, reference[2].ray_cast(origin, direction, 1000)))
    for name, (_, _, tree) in candidates.items():
        missing = extra = differing = 0; maximum = 0; normal_differences = 0
        for origin, expected in probes:
            actual = tree.ray_cast(origin, direction, 1000)
            if expected[0] is None:
                extra += actual[0] is not None
            elif actual[0] is None: missing += 1
            else:
                delta = abs(actual[3] - expected[3]); maximum = max(maximum, delta)
                differing += delta > .005
                normal_differences += abs(actual[1].dot(expected[1])) < math.cos(math.radians(1))
        result = dict(format=name,view=view,missing=missing,extra=extra,differing=differing,maxDistanceMm=maximum,normalDifferencesOver1Degree=normal_differences)
        results.append(result); print(json.dumps(result))
(directory/'surface-results.json').write_text(json.dumps(results,indent=2))
assert all(r['missing']==0 and r['extra']==0 and r['differing']==0 for r in results), 'Export changed the visible hull'

# Render the reference and corrected output with the same camera and studio light.
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene; scene.render.engine='BLENDER_WORKBENCH'
scene.render.resolution_x=1500; scene.render.resolution_y=1050; scene.render.resolution_percentage=100
shading=scene.display.shading; shading.light='STUDIO'; shading.color_type='SINGLE'; shading.single_color=(.55,.55,.55)
shading.show_cavity=True; shading.cavity_type='BOTH'; shading.show_shadows=True; shading.background_type='WORLD'; scene.world.color=(.075,.075,.075)
camdata=bpy.data.cameras.new('Comparison'); cam=bpy.data.objects.new('Comparison',camdata); scene.collection.objects.link(cam); scene.camera=cam
cam.location=(-170,180,-220); direction=-cam.location.normalized(); right=direction.cross(Vector((0,1,0))).normalized(); up=right.cross(direction).normalized()
cam.rotation_euler=Matrix((right,up,-direction)).transposed().to_quaternion().to_euler(); camdata.type='ORTHO'; camdata.ortho_scale=225; camdata.clip_end=2000
for name,data in [('source',reference),('corrected',candidates['3mf'])]:
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(data[0],[],data[1]); mesh.update()
    obj=bpy.data.objects.new(name,mesh); scene.collection.objects.link(obj)
    scene.render.filepath=str(directory/(name+'.png')); bpy.ops.render.render(write_still=True); obj.hide_render=True
print('PASS: all five serialized formats preserve sampled surfaces from six directions.')
