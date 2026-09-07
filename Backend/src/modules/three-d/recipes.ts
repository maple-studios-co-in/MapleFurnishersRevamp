import { AppError } from '../../lib/errors';

// Workers resolve immutable recipe identity/version, then call registerVersion.
// No queued/running state is advertised until an actual worker adapter exists.
const recipes = [{
  id: 'manual-blender', version: 1, name: 'Manual Blender delivery',
  supportedInputs: ['manual', 'keeri'],
  stages: ['reference-review', 'model-and-materials', 'export-glb-and-views', 'human-review'],
}] as const;
export function availableRecipes() { return recipes.map(({ id, version, name }) => ({ id, version, name })); }
export function requireRecipe(id: string) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) throw new AppError(400, 'Unknown or unavailable 3D recipe');
  return recipe;
}
