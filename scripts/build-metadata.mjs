import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

// Conservative compatibility: a changed solver, pose or hill source requires
// a new replay fingerprint even if its numerical behaviour stayed unchanged.
const hill = ['src/world/certificate.ts', 'src/world/hill.ts'];
const physics = [...hill, 'src/physics/aerodynamics.ts',
  'src/physics/biomechanics.ts', 'src/physics/simulation.ts',
  'src/athlete/pose.ts', 'src/input/gesture.ts'];
const fingerprint = files => {
  const hash = createHash('sha256');
  for (const file of files) hash.update(file + '\0').update(readFileSync(file)).update('\0');
  return hash.digest('hex');
};

export function buildMetadata() {
  let commit = 'unavailable';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
    const changed = execFileSync('git', ['status', '--porcelain', '--', 'src',
      'scripts/build-metadata.mjs', 'vite.config.ts', 'vitest.config.ts'], {encoding: 'utf8'});
    if (changed.trim()) commit += '-dirty';
  } catch { /* A source archive can still identify physics by its SHA256. */ }
  return {
    __BUILD_COMMIT__: JSON.stringify(commit),
    __PHYSICS_FINGERPRINT__: JSON.stringify(fingerprint(physics)),
    __HILL_FINGERPRINT__: JSON.stringify(fingerprint(hill)),
  };
}
