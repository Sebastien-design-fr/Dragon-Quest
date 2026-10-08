export function applyClipToCharacter(character, channels={}) {
  if (!character?.definition || !character?.parts) return false;
  const definitions = new Map(character.definition.parts.map(part => [part.name, part]));
  for (const [name, node] of character.parts) {
    const part = definitions.get(name);
    if (!part) continue;
    const track = channels[name] ?? {};
    node.rotation = (part.rotation ?? 0) + (track.rot ?? 0);
    node.position.set(part.position[0] + (track.x ?? 0), part.position[1] + (track.y ?? 0));
    node.scale.set(track.scaleX ?? 1, track.scaleY ?? 1);
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
  if (!Array.isArray(rig.parts) || !rig.parts.length) throw Error('Empty rig');
  return {...rig,parts:rig.parts.map(part=>({...part,texture:prefix+part.texture}))};
}
