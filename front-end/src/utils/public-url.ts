const apiUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3333';
const serverOrigin = apiUrl.replace(/\/api\/?$/, '');

/** URL absoluta para arquivo em `uploads/...` servido pelo back-end. */
export function receiptAbsoluteUrl(imgPath: string | null): string | null {
  if (!imgPath) return null;
  const path = imgPath.startsWith('/') ? imgPath.slice(1) : imgPath;
  return `${serverOrigin}/${path}`;
}
