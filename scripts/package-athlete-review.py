from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
paths=[Path('assets/athlete/athlete.blend'),Path('assets/athlete/build.py'),Path('assets/athlete/README.md'),Path('src/athlete/assets/athlete.glb'),Path('src/athlete/assets/bind-frames.json'),Path('docs/ATHLETE-ART-DIRECTION.md'),Path('docs/ATHLETE-VALIDATION.md'),Path('artifacts/SKYLIFT-athlete-review.html')]
paths+=list(Path('references/athlete').glob('*'))
paths+=list(Path('artifacts/athlete-review').rglob('*'))
with ZipFile('artifacts/athlete-review-package.zip','w',ZIP_DEFLATED) as z:
 for p in paths:
  if p.is_file():z.write(p,p.as_posix())
 z.writestr('START.txt','SKYLIFT — przegląd nowego zawodnika GLB\n\nGra offline: artifacts/SKYLIFT-athlete-review.html\nGaleria: artifacts/athlete-review/index.html\nModel: src/athlete/assets/athlete.glb\nŹródło Blender: assets/athlete/athlete.blend\nRaport: docs/ATHLETE-VALIDATION.md\nKod: https://github.com/damwach/WDSJ/tree/feature/skinned-athlete\n\nZdjęcia są wyłącznie referencjami. Autorzy i licencje: references/athlete/README.md\n')
print('artifacts/athlete-review-package.zip')
