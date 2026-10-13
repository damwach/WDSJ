"""Plot the exported hill profile with equal physical scale on both axes."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator

model=json.loads(Path('artifacts/hs140-profile.json').read_text())
points=model['points']
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'svg.fonttype':'none'})
fig,ax=plt.subplots(figsize=(15,6.2),layout='constrained')
fig.patch.set_facecolor('#f4f7f9');ax.set_facecolor('#f4f7f9')
for key,color,label in [('inrun','#1a4565','Najazd: 35° → 11°, R₁ = 90 m'),('landing','#c54439','Rekonstrukcja zeskoku i wybiegu')]:
 rows=model[key]
 ax.plot([r['x'] for r in rows],[r['y'] for r in rows],color=color,lw=2.4,label=label)
labels={'A':'A · najwyższy start','B':'B · najniższy start','P':'P 109','K':'K 125','L':'L · HS 140','U':'U · −89,11 m','T':'T · próg','E1':'E₁'}
offsets={'A':(-38,12),'B':(-24,13),'E1':(-25,16),'T':(-4,16),'P':(-40,20),'K':(-10,25),'L':(20,-12),'U':(4,18)}
for key,offset in offsets.items():
 point=points[key]
 ax.scatter(point['x'],point['y'],s=23,c='#132e43',zorder=5)
 ax.annotate(labels[key],(point['x'],point['y']),xytext=offset,textcoords='offset points',fontsize=9,color='#132e43',arrowprops={'arrowstyle':'-','color':'#8396a4','lw':.7})
ax.plot([0,points['K']['x']],[points['K']['y'],points['K']['y']],ls=':',c='#7f96a6',lw=1)
ax.plot([points['K']['x'],points['K']['x']],[0,points['K']['y']],ls=':',c='#7f96a6',lw=1)
ax.annotate('n = 107,76 m',(46,-62.37),xytext=(0,-16),textcoords='offset points',color='#456274',fontsize=9)
ax.annotate('h = 62,37 m',(107.76,-26),xytext=(7,0),textcoords='offset points',color='#456274',fontsize=9)
ax.annotate('',(points['U']['x'],-95),(points['outrunEnd']['x'],-95),arrowprops={'arrowstyle':'<->','lw':1,'color':'#456274'})
ax.text((points['U']['x']+points['outrunEnd']['x'])/2,-98,'a = 103 m (poziomo) · wybieg pod górę 17°',ha='center',va='top',fontsize=9,color='#456274')
ax.text(225,36,'Obie osie w metrach\nNajazd A–T: 97,80 m\nPróg: 6,50 m · wysokość 3,13 m\nb₁ = 2,65 m · bK = 25 m · bU = 27,50 m',fontsize=9.5,color='#132e43',bbox={'facecolor':'white','edgecolor':'#d3dfe6','boxstyle':'round,pad=.8'})
ax.set_title('Wielka Krokiew · K 125 / HS 140 — rekonstrukcja z certyfikatu FIS 105 / POL 1 (09.12.2022)',loc='left',fontweight='bold',fontsize=14,pad=14)
ax.set_xlabel('Odległość pozioma od progu x [m]');ax.set_ylabel('Wysokość względem progu y [m]')
ax.set_aspect('equal',adjustable='box');ax.set_xlim(points['A']['x']-12,points['outrunEnd']['x']+12);ax.set_ylim(-108,61)
ax.xaxis.set_major_locator(MultipleLocator(50));ax.yaxis.set_major_locator(MultipleLocator(25));ax.grid(alpha=.18,color='#658296')
for spine in ax.spines.values():spine.set_color('#bacad4')
ax.legend(loc='lower left',frameon=False,fontsize=9)
for suffix in ['svg','png']:
 fig.savefig(f'artifacts/hs140-profile.{suffix}',dpi=145,bbox_inches='tight')
print('Saved metric profile plot (SVG/PNG).')
