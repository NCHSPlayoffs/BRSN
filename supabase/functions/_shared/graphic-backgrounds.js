export const backgroundSports = {
  football: 'Football', baseball: 'Baseball', softball: 'Softball', volleyball: 'Volleyball',
  boys: 'Boys Basketball', girls: 'Girls Basketball', boys_soccer: 'Boys Soccer', girls_soccer: 'Girls Soccer'
};
export function validateBackground(sport, value, storageBase) {
  if (!Object.hasOwn(backgroundSports, sport)) throw new Error('Unknown sport');
  if (value === null) return null;
  if (!value || typeof value !== 'object') throw new Error('Invalid background settings');
  const result = {};
  for (const [key, min, max] of [['brightness', 50, 180], ['saturation', 0, 160], ['shadow', 0, 90]]) {
    if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max) throw new Error(`Invalid ${key}`);
    result[key] = value[key];
  }
  result.imageUrl = '';
  if (value.imageUrl) {
    const url = new URL(value.imageUrl);
    const base = new URL(storageBase);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname + sport + '/') || url.search || url.hash) throw new Error('Invalid background image URL');
    result.imageUrl = url.href;
  }
  return result;
}
