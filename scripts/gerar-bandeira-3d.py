"""Render local: blender -b --factory-startup --python scripts/gerar-bandeira-3d.py."""
from pathlib import Path
import math
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache' / 'marca' / 'tecido-3d'
OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
scene.gravity = (0, -.08, 0)
scene.render.resolution_x = 256
scene.render.resolution_y = 200
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.fps = 30
scene.frame_end = 48
scene.view_settings.view_transform = 'Standard'
if hasattr(scene, 'eevee') and hasattr(scene.eevee, 'taa_render_samples'):
    scene.eevee.taa_render_samples = 16

nx, ny = 48, 32
verts = [(3.2 * (x / nx - .5), 2.2 * (y / ny - .5), .012 * math.sin(x * .7 + y * .9))
         for y in range(ny + 1) for x in range(nx + 1)]
faces = [(y * (nx + 1) + x, y * (nx + 1) + x + 1,
          (y + 1) * (nx + 1) + x + 1, (y + 1) * (nx + 1) + x)
         for y in range(ny) for x in range(nx)]
mesh = bpy.data.meshes.new('TecidoSimulado')
mesh.from_pydata(verts, [], faces)
mesh.update()
def pose_tecido(phase):
    # Integra a direção das fibras: a dobra vira em profundidade sem esticar a arte.
    # As fases inteiras fecham o ciclo sem apagar o movimento dos quadros.
    u = np.linspace(0, 1, nx + 1)
    rows = []
    for row in range(ny + 1):
        v = row / ny
        angle = (.8 * np.sin(2 * np.pi * 1.15 * u - phase + .15 * np.sin(np.pi * v))
                 + .20 * np.sin(4 * np.pi * u - 2 * phase + .9 * v)
                 + .07 * np.sin(6 * np.pi * u + 2 * v - 3 * phase))
        angle *= .65 + .35 * u
        step = 3.2 / nx
        x = np.r_[0, np.cumsum((np.cos(angle[:-1]) + np.cos(angle[1:])) * step / 2)]
        z = np.r_[0, np.cumsum((np.sin(angle[:-1]) + np.sin(angle[1:])) * step / 2)]
        z += .12 * np.sin(phase + .6 * v)
        y = np.full(nx + 1, 2.2 * (v - .5))
        y += .055 * np.sin(2 * np.pi * u - phase + .3 * v)
        rows.append(np.column_stack((x, y, z)))
    result = np.vstack(rows)
    result -= result.mean(axis=0)
    return result

assert np.allclose(pose_tecido(0), pose_tecido(2 * math.pi)), 'Ciclo contínuo'
motion = np.sqrt(np.mean((pose_tecido(0) - pose_tecido(math.pi / 2)) ** 2))
assert motion > .12, 'As dobras precisam mudar de posição, não ficar congeladas'
print(f'PASSOU: ciclo contínuo; deslocamento das dobras={motion:.3f}m', flush=True)
render_mesh = mesh
flag = bpy.data.objects.new('BandeiraRender', render_mesh)
scene.collection.objects.link(flag)
uv = render_mesh.uv_layers.new(name='Arte')
for polygon in render_mesh.polygons:
    polygon.use_smooth = True
    for loop_index in polygon.loop_indices:
        vertex = render_mesh.loops[loop_index].vertex_index
        uv.data[loop_index].uv = ((vertex % (nx + 1)) / nx, (vertex // (nx + 1)) / ny)
smooth = flag.modifiers.new('DobrasSuaves', 'SUBSURF')
smooth.levels = smooth.render_levels = 1

material = bpy.data.materials.new('AlgodaoImpresso')
material.use_nodes = True
shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
shader.inputs['Roughness'].default_value = .85
shader.inputs['Specular IOR Level'].default_value = .2
shader.inputs['Sheen Weight'].default_value = .18
texture = material.node_tree.nodes.new('ShaderNodeTexImage')
texture.image = bpy.data.images.load(str(ROOT / 'public' / 'marca' / 'bandeira-base.webp'))
material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
material.node_tree.links.new(texture.outputs['Alpha'], shader.inputs['Alpha'])
flag.data.materials.append(material)

camera_data = bpy.data.cameras.new('CameraBandeira')
camera = bpy.data.objects.new('CameraBandeira', camera_data)
scene.collection.objects.link(camera)
camera.location = (0, -.3, 8)
camera.rotation_euler = (-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 3.65
scene.camera = camera
for name, location, energy, size in [('Principal', (-3, 4, 3), 500, 3), ('Preenchimento', (3, -1, 4), 90, 5), ('Verso', (0, 2, -3), 100, 4)]:
    light_data = bpy.data.lights.new(name, 'AREA')
    light_data.energy = energy
    light_data.shape = 'DISK'
    light_data.size = size
    light = bpy.data.objects.new(name, light_data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()

for index in range(48):
    t = index / 48
    pose = pose_tecido(t * 2 * math.pi)
    render_mesh.vertices.foreach_set('co', pose.ravel())
    render_mesh.update()
    flag.rotation_euler = (.07 * math.sin(2 * math.pi * t), .16 * math.sin(2 * math.pi * t + .6), .08 * math.sin(2 * math.pi * t))
    flag.location = (.045 * math.sin(2 * math.pi * t), .045 * math.cos(2 * math.pi * t), 0)
    scene.render.filepath = str(OUT / f'quadro-{index:02}.png')
    bpy.ops.render.render(write_still=True)
    print(f'RENDER {index + 1}/48', flush=True)
print('CONCLUIDO: 48 quadros de tecido animado em 3D.', flush=True)
