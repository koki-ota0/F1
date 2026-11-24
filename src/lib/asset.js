/**
 * Build-time asset root, always absolute from the host.
 *
 * `import.meta.env.BASE_URL` may be './' (relative) or '/F1/' (project site).
 * A relative value resolves against the current route, so a deep link such as
 * /drivers/max-verstappen would request /drivers/images/... and 404. Normalising
 * to an absolute root keeps portraits working on every route and every host.
 */
const ROOT = (import.meta.env.BASE_URL || '/')
  .replace(/^\.\/?/, '/')
  .replace(/\/$/, '')

/** Absolute URL for a bundled asset, e.g. assetUrl('images/drivers/norris.jpg') */
export const assetUrl = (path) => `${ROOT}/${String(path || '').replace(/^\//, '')}`
