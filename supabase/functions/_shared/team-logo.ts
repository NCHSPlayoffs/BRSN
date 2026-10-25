const hosts = new Set([
  "nchslogos.com", "www.nchslogos.com", "iili.io", "lh3.googleusercontent.com",
  "drive.google.com", "drive.usercontent.google.com",
]);

export function allowedTeamLogoUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !hosts.has(url.hostname) || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Unsupported logo host");
  }
  return url;
}

export async function fetchTeamLogo(value: string, corsHeaders: Record<string, string>, useImageCache = false) {
  let url = allowedTeamLogoUrl(value);
  if (useImageCache) url = new URL("https://images.weserv.nl/?url=" + encodeURIComponent(url.href));
  const signal = AbortSignal.timeout(15000);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const response = await fetch(url, { redirect: "manual", signal });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Logo redirect unavailable");
      url = allowedTeamLogoUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) throw new Error("Logo request failed: " + response.status);
    const type = response.headers.get("content-type") || "";
    if (!type.startsWith("image/")) throw new Error("Logo response is not an image");
    const limit = 8 * 1024 * 1024;
    if (Number(response.headers.get("content-length")) > limit) throw new Error("Logo too large");
    const chunks: Uint8Array[] = [];
    let length = 0;
    const reader = response.body!.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) throw new Error("Logo too large");
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return new Response(bytes, {
      headers: { ...corsHeaders, "Content-Type": type, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  }
  throw new Error("Too many logo redirects");
}
