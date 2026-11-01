import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Read-only source audit. Expressions are preserved, not evaluated as Lua.
const root = process.argv[2] || 'C:/Program Files (x86)/Steam/steamapps/common/Avorion';
const output = path.resolve('docs/turret-animation-evidence.json');
const sources = new Map();
function read(relative) {
  const bytes = fs.readFileSync(path.join(root, relative));
  sources.set(relative, {path: relative, sha256: crypto.createHash('sha256').update(bytes).digest('hex')});
  return bytes.toString('utf8').split(/\r?\n/);
}
function functions(relative, owner) {
  const lines = read(relative), result = {};
  const starts = lines.flatMap((text, i) => text.startsWith(`function ${owner}.`) ? [i] : []);
  for (const [j, start] of starts.entries()) {
    const end = starts[j + 1] ?? lines.length;
    const name = lines[start].match(/function (\w+\.\w+)/)[1];
    result[name] = {path: relative, line: start + 1, lines: lines.slice(start, end).map((text, i) => ({line: start + i + 1, text}))};
  }
  return {lines, result};
}
const weapon = functions('data/scripts/lib/weapongenerator.lua', 'WeaponGenerator');
const turret = functions('data/scripts/lib/turretgenerator.lua', 'TurretGenerator');
function mapping(lines) {
  return Object.fromEntries(lines.flatMap(text => {
    const m = text.match(/generatorFunction\[WeaponType\.(\w+)\s*\]\s*=\s*(\w+\.\w+)/);
    return m ? [[m[1], m[2]]] : [];
  }));
}
const wm = mapping(weapon.lines), tm = mapping(turret.lines);
const select = block => ({path: block.path, line: block.line, statements: block.lines.filter(({text}) => /weapon\.|weapon:|local (fireDelay|reach|damage|speed|velocity|maximumTime|existingTime|hue|color|shots|numWeapons|weapons|shootingTime|coolingTime|rechargeTime)|TurretGenerator\.(scale|create|attach)|result\.|if |elseif |else$|end$/.test(text))});
const families = Object.keys(wm).map(type => ({type, weapon: select(weapon.result[wm[type]]), turret: select(turret.result[tm[type]])}));
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}
const soundFiles = walk('data/scripts/weaponsounds').filter(p => p.endsWith('.lua'));
const sounds = soundFiles.map(p => ({path: p, lines: read(p).map((text, i) => ({line: i + 1, text}))}));
const pattern = /(?:\.(?:banimation\w*|bshape\w*|bwidth|bauraWidth|binnerColor|bouterColor|blength|continuousBeam|fireDelay|fireRate|shotsFired|simultaneousShooting|turningSpeed|recoil|pshape|psize|pcolor|pvelocity|pmaximumTime|pangularVelocity|seeker|impactParticles|impactExplosion|deathExplosion|timedDeath|explosionRadius|shotCreationPosition)\s*=)|Weapon\(\)/;
const overrides = [];
const scriptFiles = walk('data/scripts').filter(p => p.endsWith('.lua'));
for (const p of scriptFiles) {
  if (p.endsWith('/weapongenerator.lua') || p.endsWith('/turretgenerator.lua')) continue;
  const lines = fs.readFileSync(path.join(root, p), 'utf8').split(/\r?\n/);
  const hits = lines.flatMap((text, i) => pattern.test(text) ? [{line: i + 1, text, context: lines.slice(Math.max(0, i - 2), i + 3)}] : []);
  if (hits.length) {read(p); overrides.push({path: p, hits});}
}
for (const p of ['data/scripts/lib/weapontype.lua', 'data/shaders/turret.vert', 'data/shaders/turret.frag', 'data/shaders/weapon.frag', ...['Weapon','Turret','TurretTemplate','TurretDesign','TurretDesignPart','Enums'].map(n => `Documentation/${n}.html`)]) read(p);
const evidence = {
  formatVersion: 1, sourceRoot: root, collectedAt: new Date().toISOString(), scriptsScanned: scriptFiles.length,
  caveat: 'Static Lua statements, not resolved weapon instances. Branches, native defaults, RNG, setters, and later mutations must be evaluated in game. Override search includes non-turret objects; inspect context before applying.',
  families,
  sharedRules: ['attachWeapons','createWeaponPlaces','createStandardCooling','createBatteryChargeCooling','scale','getScale','addSpecialties'].map(n => turret.result[`TurretGenerator.${n}`]),
  sounds, overrides, sources: [...sources.values()]
};
if (families.length !== 19 || families.some(f => !f.weapon || !f.turret)) throw new Error('Incomplete standard family coverage');
fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({output, families: families.length, scriptsScanned: scriptFiles.length, soundProfiles: sounds.length, overrideFiles: overrides.length, hashedSources: sources.size}));
