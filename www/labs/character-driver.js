/**
 * Shared adapter from animation channels to an articulated character.
 * Rig data is untrusted input: never allow a manifest to resolve paths outside its own directory.
 */
const finite = Number.isFinite;
export function applyClipToCharacter(character, channels={}) {
  if (!character?.definition || !character?.parts) return false;
  const definitions = new Map(character.definition.parts.map(part => [part.name, part]));
  for (const [name, node] of character.parts) {
    const part = definitions.get(name);
    if (!part) continue;
    const track = channels[name] ?? {};
    const val = (key, fallback) => finite(track[key]) ? track[key] : fallback;
    node.rotation = (part.rotation ?? 0) + val('rot',0);
    node.position.set(part.position[0] + val('x',0), part.position[1] + val('y',0));
    node.scale.set(val('scaleX',1), val('scaleY',1));
  }
  return true;
}
export function validateLayerManifest(rig) {
  if (!rig || !Array.isArray(rig.parts) || !rig.parts.length) throw Error('Empty rig');
  const names = new Set();
  for (const part of rig.parts) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(part.name) || names.has(part.name)) throw Error('Invalid bone name');
    names.add(part.name);
    if (!Array.isArray(part.position) || part.position.length !== 2 || !part.position.every(finite)) throw Error('Invalid position');
    if (typeof part.texture !== 'string' || !/^[A-Za-z0-9_-]+\.webp$/.test(part.texture)) throw Error('Invalid texture path');
    if (part.pivot && (!Array.isArray(part.pivot) || part.pivot.length !== 2 || !part.pivot.every(finite))) throw Error('Invalid pivot');
  }
  for (const part of rig.parts) {
    if (part.parent && !names.has(part.parent)) throw Error('Unknown parent');
    const visited = new Set([part.name]);
    let parent = part.parent;
    while (parent) {
      if (visited.has(parent)) throw Error('Cyclic skeleton');
      visited.add(parent);
      parent = rig.parts.find(p => p.name === parent)?.parent;
    }
  }
  return true;
}
export async function loadLayers(variant, stage, fetcher=fetch) {
  if (!['dragon','dragonne'].includes(variant) || !['baby','young','adult','legendary'].includes(stage)) throw Error('Invalid character');
  const prefix='../assets/layers/'+variant+'/'+stage+'/';
  const response=await fetcher(prefix+'rig.json');
  if (response.status===404) return null;
  if (!response.ok) throw Error('Rig HTTP '+response.status);
  const rig=await response.json();
  validateLayerManifest(rig);
  return {...rig,parts:rig.parts.map(part=>({...part,texture:prefix+part.texture}))};
}
