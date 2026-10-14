"""Original SKYLIFT athlete. Blender 4.3, metres; no third-party meshes/textures.
Authored cross-section cage -> welded voxel surface -> smooth -> weighted armature.
The saved .blend contains the editable final skin, armature and construction cage.
Run: blender -b --python assets/athlete/build.py
"""
import bpy, math, os, json
from mathutils import Vector
from math import sin, cos, pi
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def cv(p):return (p[0],-p[2],p[1])
def gc(p):return (p.x,p.z,-p.y)
def mat(name,color,rough=.65,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
 return m
navy=mat('Midnight technical fabric',(.018,.042,.065));red=mat('Vermilion panels',(.67,.055,.025));white=mat('Ivory race bib',(.89,.91,.86));skin=mat('Face',(.48,.27,.18),.83);rubber=mat('Gloves and trim',(.009,.018,.025));lens=mat('Amber mirrored lens',(.025,.23,.32),.16,.65);seam=mat('Silver seams',(.25,.35,.4));
# Profiles are (height, forward centre, lateral centre, depth radius, width radius).
def surface(name,rows,material,n=24,cap=True):
 vs=[];fs=[]
 for y,x,z,rx,rz in rows:
  for i in range(n):
   a=2*pi*i/n;vs.append(cv((x+rx*cos(a),y,z+rz*sin(a))))
 for j in range(len(rows)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
 if cap:fs.extend([tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))])
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 for p in mesh.polygons:p.use_smooth=True
 return o
parts=[]
parts.append(surface('Torso tailoring cage',[
 (-.13,-.006,0,.065,.085),(-.075,-.012,0,.108,.145),(0,-.008,0,.105,.148),(.09,0,0,.09,.128),(.19,.003,0,.095,.132),(.30,.002,0,.112,.16),(.39,-.003,0,.107,.181),(.44,-.008,0,.09,.184),(.48,-.012,0,.073,.145),(.51,-.008,0,.055,.085),(.54,0,0,.043,.049),(.575,.008,0,.041,.047)],navy))
for side in [-1,1]:
 parts.append(surface('Leg tailoring cage',[(y,x,side*z,rx,rz) for y,x,z,rx,rz in [
 (.015,-.006,.105,.077,.081),(-.09,-.004,.109,.085,.087),(-.19,.003,.107,.077,.08),(-.30,.007,.105,.064,.065),(-.39,.006,.105,.055,.057),(-.44,.004,.105,.053,.055),(-.49,-.005,.105,.054,.054),(-.57,-.014,.105,.059,.057),(-.65,-.014,.105,.054,.052),(-.75,-.007,.105,.044,.043),(-.85,0,.105,.036,.038),(-.885,0,.105,.035,.037)]],navy))
 rows=[]
 for d,rx,rz in [(-.025,.038,.04),(0,.054,.057),(.07,.056,.057),(.16,.047,.048),(.245,.034,.036),(.29,.031,.033),(.335,.034,.035),(.40,.031,.033),(.48,.025,.027),(.54,.023,.025),(.555,.023,.025)]:
  rows.append((.437-d*cos(.42),-.005,side*(.173+d*sin(.42)),rx,rz))
 parts.append(surface('Sleeve tailoring cage',rows,navy))
# Preserve construction meshes as an editable hidden collection, outside export.
cage=bpy.data.collections.new('Construction - authored profiles');bpy.context.scene.collection.children.link(cage)
for p in parts:
 c=p.copy();c.data=p.data.copy();cage.objects.link(c);c.hide_render=True;c.hide_set(True)
cage.hide_render=True;cage.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for p in parts:p.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();body=parts[0];body.name='AthleteSuit'
rem=body.modifiers.new('Weld continuous shoulder hip knee topology','REMESH');rem.mode='VOXEL';rem.voxel_size=.008;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
s=body.modifiers.new('Relax tailored surface','SMOOTH');s.factor=.65;s.iterations=5;bpy.ops.object.modifier_apply(modifier=s.name)
# Consistent normals after union.
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
# Vertex colours keep bib/panel boundaries continuous across welded triangles.
def ease(a,b,v):
 t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
body.data.materials.clear()
fabric=mat('Tailored race suit', (1,1,1))
node=fabric.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='SuitColour'
fabric.node_tree.links.new(node.outputs['Color'],fabric.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
body.data.materials.append(fabric)
colour=body.data.color_attributes.new(name='SuitColour',type='FLOAT_COLOR',domain='POINT')
for v in body.data.vertices:
 x,y,z=gc(v.co);az=abs(z)
 base=(.018,.042,.065);accent=(.67,.055,.025);bib=(.89,.91,.86)
 side=ease(.12,.13,az)*(1-ease(.05,.12,y))
 sleeve=ease(.19,.205,az)*ease(.03,.08,y)
 panel=max(side,sleeve)
 c=[base[i]*(1-panel)+accent[i]*panel for i in range(3)]
 front=ease(.047,.055,abs(x))*(1-ease(.129,.14,az))*ease(.145,.154,y)*(1-ease(.433,.442,y))
 c=[c[i]*(1-front)+bib[i]*front for i in range(3)]
 # Fine outside seam and cuff piping, baked as vertex colour, no added shells.
 outer=1-ease(.003,.010,abs(abs(x)-.018))
 stripe=outer*ease(.15,.18,az)*(1-ease(.04,.12,y))*.65
 c=[c[i]*(1-stripe)+(.35,.42,.44)[i]*stripe for i in range(3)]
 colour.data[v.index].color=(*c,1)
# Actual skeleton in neutral A-pose. Blender bones have anatomical heads/tails.
armdata=bpy.data.armatures.new('AthleteArmature');rig=bpy.data.objects.new('AthleteArmature',armdata);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);body.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
bones={};spec=[]
def bone(name,head,tail,parent=None,target=None,angle=0):
 b=armdata.edit_bones.new(name);b.head=cv(head);b.tail=cv(tail)
 if parent:b.parent=bones[parent]
 bones[name]=b;spec.append({'name':name,'target':target or name,'joint':head,'angle':angle})
bone('pelvis',(0,0,0),(0,.09,0))
bone('spine',(0,.09,0),(0,.28,0),'pelvis','torso')
bone('chest',(0,.28,0),(0,.48,0),'spine','torso')
bone('neck',(0,.51,0),(.006,.558,0),'chest','torso')
bone('head',(.006,.558,0),(.006,.77,0),'neck')
for side,suffix in [(-1,'L'),(1,'R')]:
 z=side*.105;bone('thigh_'+suffix,(0,0,z),(0,-.44,z),'pelvis','hip_'+suffix);bone('shin_'+suffix,(0,-.44,z),(0,-.87,z),'thigh_'+suffix,'knee_'+suffix);bone('ankle_'+suffix,(0,-.87,z),(.12,-.87,z),'shin_'+suffix,'ankle_'+suffix)
 shoulder=(-.005,.437,side*.173);elbow=(-.005,.437-.29*cos(.42),side*(.173+.29*sin(.42)));wrist=(-.005,.437-.54*cos(.42),side*(.173+.54*sin(.42)))
 bone('clavicle_'+suffix,(0,.437,side*.07),shoulder,'chest','torso')
 bone('arm_'+suffix,shoulder,elbow,'clavicle_'+suffix,'arm_'+suffix,-side*.42)
 bone('forearm_'+suffix,elbow,wrist,'arm_'+suffix,'elbow_'+suffix,-side*.42)
 bone('wrist_'+suffix,wrist,(wrist[0],wrist[1]-.09,wrist[2]),'forearm_'+suffix,'wrist_'+suffix,-side*.42)
bpy.ops.object.mode_set(mode='OBJECT')
def smooth(a,b,v):t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
def bind(o,weights):
 for b in bones:o.vertex_groups.new(name=b)
 for v in o.data.vertices:
  w=weights(*gc(v.co));total=sum(w.values())
  for k,val in w.items():
   if val>1e-6:o.vertex_groups[k].add([v.index],val/total,'REPLACE')
 o.parent=rig;mod=o.modifiers.new('Armature deformation','ARMATURE');mod.object=rig
 for p in o.data.polygons:p.use_smooth=True
 return o
def bodyweights(x,y,z):
 side='L' if z<0 else 'R';az=abs(z)
 if az>max(.165,.19+(.34-y)*.30) and y>.437-.57*cos(.42):
  d=(.437-y)/cos(.42)
  arm=smooth(.14,.215,az)
  elbow=smooth(.24,.34,d);wrist=smooth(.49,.56,d)
  return {'chest':1-arm,'arm_'+side:arm*(1-elbow),'forearm_'+side:arm*elbow*(1-wrist),'wrist_'+side:arm*elbow*wrist}
 if y<.035:
  thigh=1-smooth(-.10,.035,y);shin=1-smooth(-.49,-.39,y);ankle=1-smooth(-.89,-.82,y)
  return {'pelvis':1-thigh,'thigh_'+side:thigh*(1-shin),'shin_'+side:thigh*shin*(1-ankle),'ankle_'+side:thigh*shin*ankle}
 spine=smooth(.015,.14,y);chest=smooth(.18,.34,y);neck=smooth(.48,.55,y)
 return {'pelvis':1-spine,'spine':spine*(1-chest),'chest':spine*chest*(1-neck),'neck':spine*chest*neck}
bind(body,bodyweights)
# Face: shaped jaw, cheeks, brow, crown, with a restrained nose and mouth.
face=surface('Face',[(.56,.02,0,.026,.03),(.585,.038,0,.034,.038),(.61,.04,0,.043,.052),(.65,.025,0,.063,.065),(.69,.012,0,.074,.072),(.735,0,0,.074,.07),(.77,-.008,0,.052,.054),(.79,-.01,0,.008,.01)],skin,32)
bind(face,lambda *p:{'head':1})
nose=surface('Nose',[(.638,.087,0,.007,.009),(.65,.096,0,.012,.013),(.67,.088,0,.009,.01),(.685,.082,0,.003,.004)],skin,16);bind(nose,lambda *p:{'head':1})
helmet=surface('helmet-shell',[(.66,-.016,0,.075,.077),(.695,-.009,0,.094,.086),(.73,-.012,0,.099,.087),(.766,-.020,0,.091,.08),(.797,-.03,0,.062,.06),(.817,-.03,0,.025,.027),(.821,-.03,0,.001,.001)],white,40);bind(helmet,lambda *p:{'head':1})
# Curved lens front patch, not a full wraparound ball.
def patch(name,ys,material):
 vs=[];fs=[];n=32
 for y,rx,rz in ys:
  for i in range(n+1):a=-1.37+2.74*i/n;vs.append(cv((.017+rx*cos(a),y,rz*sin(a))))
 for j in range(len(ys)-1):
  for i in range(n):a=j*(n+1)+i;fs.append((a+n+1,a+n+2,a+1,a))
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(material);bind(o,lambda *p:{'head':1});return o
patch('Goggle frame',[(.665,.083,.077),(.684,.089,.083),(.717,.084,.082)],rubber)
patch('continuous-goggle-lens',[(.669,.086,.077),(.688,.092,.083),(.713,.087,.082)],lens)
# A narrow original lip contour and chinstrap give scale to the exposed jaw.
mouth=surface('Mouth',[(.612,.080,0,.001,.018),(.615,.081,0,.001,.02),(.618,.080,0,.001,.017)],rubber,20);bind(mouth,lambda *p:{'head':1})
strap=patch('Helmet chin strap',[(.589,.033,.037),(.595,.035,.039)],rubber)
# Gloves: flattened palm and distinct finger tips, all weighted to wrist.
for side,suf in [(-1,'L'),(1,'R')]:
 wy=.437-.54*cos(.42);wz=side*(.173+.54*sin(.42))
 glove=surface('Glove_'+suf,[(wy+.01,-.005,wz,.023,.025),(wy-.025,-.004,wz+side*.012,.022,.035),(wy-.065,-.006,wz+side*.024,.017,.034),(wy-.085,-.008,wz+side*.032,.012,.027)],rubber,20);bind(glove,lambda *p,suf=suf:{'wrist_'+suf:1})
 for i in range(4):
  z=wz+side*.029+(i-1.5)*.015;end=wy-.12+abs(i-1.4)*.007
  finger=surface('Finger_'+suf+str(i),[(wy-.06,-.005,z,.014,.008),(end,-.008,z+side*.016,.011,.007),(end-.006,-.008,z+side*.016,.003,.003)],rubber,12);bind(finger,lambda *p,suf=suf:{'wrist_'+suf:1})
 thumb=surface('Thumb_'+suf,[(wy-.02,.003,wz-side*.021,.014,.013),(wy-.05,.015,wz-side*.035,.012,.012),(wy-.075,.019,wz-side*.035,.006,.007)],rubber,12);bind(thumb,lambda *p,suf=suf:{'wrist_'+suf:1})
# Race number is original vector geometry; photographs are never textures.
for sign in [1,-1]:
 bpy.ops.object.text_add();o=bpy.context.object;o.name='Race number 24';o.data.body='24';o.data.align_x='CENTER';o.data.size=.135;o.data.extrude=.00025
 # Text local XY -> game lateral/up, normal forward.
 from mathutils import Matrix
 o.matrix_world=Matrix(((0,0,sign,sign*.114),(sign,0,0,0),(0,1,0,.235),(0,0,0,1)))
 o.data.materials.append(navy);bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);bind(o,lambda *p:{'chest':1})
# Recalculate all closed equipment/face surfaces; keep open lens winding.
for o in list(rig.children):
 if o.type!='MESH':continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 if o.name not in ['Goggle frame','continuous-goggle-lens']:
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
 if o.name in ['Face','helmet-shell','Nose']:
  sub=o.modifiers.new('Polished contour','SUBSURF');sub.levels=1
  bpy.ops.object.modifier_move_up(modifier=sub.name);bpy.ops.object.modifier_apply(modifier=sub.name)
# Compact neck: move head accessories 12 mm down in their bind pose.
for o in list(rig.children):
 if o.type=='MESH' and o.vertex_groups.get('head'):
  g=o.vertex_groups['head'].index
  if all(any(w.group==g and w.weight>.99 for w in v.groups) for v in o.data.vertices):
   for v in o.data.vertices:v.co.z-=.012
rig['authorship']='Original SKYLIFT asset; reference photographs for visual analysis only.'
rig['units']='metres; Blender Z-up; exported glTF Y-up'
# Joint frames for the runtime retargeter (actual model bind pose, not animation).
with open(os.path.join(ROOT,'src/athlete/assets/bind-frames.json'),'w') as f:json.dump(spec,f,indent=2)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in rig.children:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/athlete/athlete.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'src/athlete/assets/athlete.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_skins=True,export_apply=False)
print('EXPORTED',len(body.data.vertices),'suit vertices',len(bones),'bones')
