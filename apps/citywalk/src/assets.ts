// Loading model files that the game ships next to the page.

/**
 * The .glb file, or the same bytes as base64 text next to it (`<name>.glb.b64.txt`) for hosts that
 * only serve text, such as the shared preview page.
 */
export async function fetchModel(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (res.ok && !(res.headers.get('content-type') ?? '').includes('text/html'))
    return res.arrayBuffer();
  const text = await fetch(`${url}.b64.txt`).then((r) => {
    if (!r.ok) throw new Error(`model not found: ${url}`);
    return r.text();
  });
  const bin = atob(text.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
