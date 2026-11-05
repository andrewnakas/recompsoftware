# Blender scenes for the store's shirt art: beige retro hardware with glowing green CRT screens, transparent background.
# Run: /Applications/Blender-4.5.12.app/Contents/MacOS/Blender -b -P scripts/store/scene/scene.py -- battlestation|crtwall [samples]
import bpy, math, os, sys, random
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCENE = args[0] if args else 'battlestation'
SAMPLES = int(args[1]) if len(args) > 1 else 128
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def mat(name, color, rough=0.5, metal=0.0, emit=None, strength=4.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1); bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:  # CRT face: mostly pure emission (black stays black), a faint glossy sheen for the glass
        out = nt.nodes['Material Output']; nt.nodes.remove(bsdf)
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(os.path.join(HERE, emit))
        em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = strength
        gl = nt.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.18
        mix = nt.nodes.new('ShaderNodeMixShader'); mix.inputs['Fac'].default_value = 0.05
        nt.links.new(tex.outputs['Color'], em.inputs['Color'])
        nt.links.new(em.outputs[0], mix.inputs[1]); nt.links.new(gl.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m

BEIGE = mat('beige', (0.62, 0.58, 0.48), 0.45)
BEIGE2 = mat('beige_dark', (0.45, 0.42, 0.34), 0.5)
SLATE = mat('slate', (0.035, 0.04, 0.038), 0.4)
BEZEL = mat('bezel', (0.02, 0.022, 0.02), 0.6)
METAL = mat('metal', (0.55, 0.57, 0.56), 0.3, 1.0)
DESK = mat('desk', (0.09, 0.06, 0.045), 0.55)
LED = mat('led', (0.1, 0.9, 0.55), 0.3); LED.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (0.2, 1, 0.6, 1)
LED.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 8

def box(loc, size, m, bevel=0.02, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object; o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 4; b.limit_method = 'ANGLE'
    o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = True
    return o

def plane(loc, size, m, rot=(math.pi / 2, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(location=loc, rotation=rot)
    o = bpy.context.object; o.scale = (size[0] / 2, size[1] / 2, 1); o.data.materials.append(m); return o

def parent(objs, loc, rz):
    e = bpy.data.objects.new('grp', None); sc.collection.objects.link(e)
    for o in objs: o.parent = e
    e.location = loc; e.rotation_euler = (0, 0, rz); return e

def crt(screen, loc=(0, 0, 0), rz=0.0, s=1.0, strength=4.0):
    """Beige CRT on its base: front shell, tapered tube housing, recessed glowing screen. Front faces -Y."""
    o = []
    o.append(box((0, 0, 0.62 * s), (1.12 * s, 0.34 * s, 0.92 * s), BEIGE, 0.05 * s))           # front shell
    o.append(box((0, 0.42 * s, 0.6 * s), (0.86 * s, 0.6 * s, 0.74 * s), BEIGE, 0.12 * s))     # tube housing
    o.append(box((0, 0.78 * s, 0.6 * s), (0.5 * s, 0.24 * s, 0.44 * s), BEIGE2, 0.06 * s))   # neck
    o.append(plane((0, -0.172 * s, 0.66 * s), (0.9 * s, 0.7 * s), BEZEL))                      # recess
    scr = plane((0, -0.175 * s, 0.66 * s), (0.8 * s, 0.6 * s), mat(f'screen_{screen}_{random.random()}', (0, 0, 0), emit=screen, strength=strength))
    m = scr.modifiers.new('sub', 'SUBSURF'); m.levels = 3; m.subdivision_type = 'SIMPLE'
    c = scr.modifiers.new('bulge', 'CAST'); c.factor = 0.08; c.cast_type = 'SPHERE'                # slight CRT curvature
    o.append(scr)
    o.append(box((0.42 * s, -0.172 * s, 0.24 * s), (0.04 * s, 0.01 * s, 0.04 * s), LED, 0))     # power LED
    o.append(box((0, 0.1 * s, 0.1 * s), (0.6 * s, 0.5 * s, 0.12 * s), BEIGE2, 0.03 * s))      # swivel base
    o.append(box((0, 0.1 * s, 0.02 * s), (0.78 * s, 0.6 * s, 0.04 * s), BEIGE, 0.015 * s))
    return parent(o, loc, rz)

def keyboard(loc, rz=0.0):
    o = [box((0, 0, 0.035), (1.5, 0.5, 0.07), BEIGE, 0.02)]
    for r in range(5):
        for k in range(15):
            if r == 4 and 3 < k < 11:
                if k == 4: o.append(box((-0.1, -0.17 + r * 0.085, 0.085), (0.6, 0.07, 0.035), BEIGE2, 0.008))
                continue
            o.append(box((-0.63 + k * 0.09, -0.17 + r * 0.085, 0.085), (0.075, 0.07, 0.035), BEIGE2 if (k + r) % 7 else BEIGE, 0.008))
    return parent(o, loc, rz)

def tower(loc, rz=0.0):
    o = [box((0, 0, 0.75), (0.5, 0.9, 1.5), BEIGE, 0.03)]
    for k, z in enumerate((1.3, 1.12, 0.94)): o.append(box((0, -0.451, z), (0.38, 0.01, 0.12), SLATE if k else BEZEL, 0.005))
    o.append(box((0.12, -0.451, 0.75), (0.1, 0.01, 0.03), SLATE, 0))
    o.append(box((-0.12, -0.452, 0.5), (0.05, 0.01, 0.05), LED, 0))
    return parent(o, loc, rz)

def floppy(loc, rz=0.0):
    o = [box((0, 0, 0.0035), (0.36, 0.37, 0.007), SLATE, 0.004), box((0, 0.1, 0.0075), (0.2, 0.15, 0.002), METAL, 0)]
    o.append(box((0, -0.06, 0.0075), (0.28, 0.2, 0.002), mat('label', (0.85, 0.86, 0.8), 0.7), 0)); return parent(o, loc, rz)

def mouse(loc, rz=0.0):
    bpy.ops.mesh.primitive_uv_sphere_add(location=(0, 0, 0.04)); o = bpy.context.object
    o.scale = (0.11, 0.17, 0.06); o.data.materials.append(BEIGE); bpy.ops.object.shade_smooth()
    return parent([o], loc, rz)

def speaker(loc, rz=0.0):  # beige desktop speaker with a dark grille
    o = [box((0, 0, 0.3), (0.32, 0.3, 0.6), BEIGE, 0.03), box((0, -0.152, 0.36), (0.24, 0.01, 0.4), SLATE, 0.01)]
    bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.01, location=(0, -0.158, 0.12), rotation=(math.pi / 2, 0, 0))
    c = bpy.context.object; c.data.materials.append(BEZEL); o.append(c)
    return parent(o, loc, rz)

def light(kind, loc, energy, color, size=2.0, target=(0, 0, 0.6)):
    d = bpy.data.lights.new(kind, 'AREA'); d.energy = energy; d.color = color; d.size = size
    o = bpy.data.objects.new(kind, d); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

def camera(loc, target, lens=50):
    c = bpy.data.cameras.new('cam'); c.lens = lens; o = bpy.data.objects.new('cam', c); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); sc.camera = o

if SCENE == 'battlestation':
    box((0.05, 0.3, -0.04), (4.3, 1.9, 0.08), DESK, 0.01)
    crt('scr-lockup.png', (-0.55, 0.5, 0), 0.12, 1.15)
    crt('scr-terminal.png', (0.75, 0.45, 0), -0.28, 0.95)
    tower((1.85, 0.55, 0), -0.25)
    keyboard((-0.3, -0.42, 0), 0.04)
    mouse((0.78, -0.45, 0), -0.2)
    for k in range(3): floppy((-1.75 + k * 0.03, -0.35 + k * 0.02, k * 0.009), 0.3 + k * 0.15)
    speaker((-1.55, 0.55, 0), 0.25)
    camera((0.35, -6.6, 2.9), (0.05, 0.3, 0.5), 46)
    light('key', (-3, -3, 4), 600, (1, 0.9, 0.78), 3)
    light('rim', (3.5, 2.5, 2.5), 450, (0.4, 1, 0.75), 2.5)
    light('fill', (0.5, -4, 0.6), 90, (0.8, 0.85, 1), 4)
else:  # crtwall: a pile of CRTs, every screen different
    rows = [[('scr-asm.png', -1.25), ('scr-lockup.png', 0.0), ('scr-terminal.png', 1.25)],
            [('scr-match.png', -0.62), ('scr-terminal.png', 0.62)],
            [('scr-lockup.png', 0.0)]]
    for r, row in enumerate(rows):
        for img, x in row:
            crt(img, (x + random.uniform(-0.04, 0.04), random.uniform(-0.05, 0.05), r * 0.98), random.uniform(-0.12, 0.12), 1.05, 5.0)
    camera((0.3, -6.2, 1.6), (0, 0, 1.45), 50)
    light('key', (-3, -3.5, 4.5), 700, (1, 0.9, 0.78), 3)
    light('rim', (3, 3, 3), 500, (0.4, 1, 0.75), 3)
    light('fill', (0, -5, 0.5), 120, (0.8, 0.85, 1), 5)

world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.012, 0.011, 1)
sc.render.engine = 'CYCLES'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e: print('GPU unavailable:', e)
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 2400
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'Medium High Contrast'
# phosphor glow: compositor fog glare on the bright screen pixels
sc.use_nodes = True; ct = sc.node_tree
rl = ct.nodes.get('Render Layers') or ct.nodes.new('CompositorNodeRLayers')
comp = ct.nodes.get('Composite') or ct.nodes.new('CompositorNodeComposite')
glare = ct.nodes.new('CompositorNodeGlare'); glare.glare_type = 'FOG_GLOW'; glare.quality = 'HIGH'
try: glare.threshold = 0.9; glare.size = 7
except Exception: pass
ct.links.new(rl.outputs['Image'], glare.inputs['Image']); ct.links.new(glare.outputs['Image'], comp.inputs['Image'])
sc.render.filepath = os.path.join(HERE, f'render-{SCENE}.png')
bpy.ops.render.render(write_still=True)
print('wrote', sc.render.filepath)
