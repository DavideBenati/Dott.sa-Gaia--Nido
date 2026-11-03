/** Workers stores one header rule per exact path; later duplicate paths replace
 * earlier rules. Merge our generated blocks before handing the file to it. */
export function mergeHeaderBlocks(input) {
  const paths = new Map();
  let headers;
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      if (!line.startsWith("/") && !line.startsWith("https://"))
        throw new Error(`Invalid Cloudflare header path: ${line}`);
      if (!paths.has(line)) paths.set(line, new Map());
      headers = paths.get(line);
      continue;
    }
    const pair = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+):\s*(.+)$/.exec(line);
    if (!headers || !pair)
      throw new Error(`Invalid Cloudflare header line: ${line}`);
    const [, name, value] = pair;
    const key = name.toLowerCase();
    const previous = headers.get(key);
    if (previous && previous.value !== value)
      throw new Error(`Conflicting values for Cloudflare header ${name}.`);
    if (!previous) headers.set(key, { name, value });
  }
  return Array.from(paths, ([path, values]) => {
    if (!values.size) throw new Error(`No Cloudflare headers for ${path}.`);
    return `${path}\n${Array.from(values.values(), ({ name, value }) => `  ${name}: ${value}\n`).join("")}`;
  }).join("");
}

export function cloudflareHeaders(metadata, pwaHeaders) {
  return mergeHeaderBlocks(
    "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/newsletter*\n  Referrer-Policy: no-referrer\n" +
      "/\n  Cache-Control: no-store\n/*.html\n  Cache-Control: no-store\n" +
      Object.keys(metadata)
        .filter((path) => path !== "/")
        .map((path) => `${path}*\n  Cache-Control: no-store\n`)
        .join("") +
      // Keep the private tab alias protected with older metadata snapshots too.
      "/documenti*\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n" +
      pwaHeaders +
      Object.entries(metadata)
        .filter(([, page]) => !page.index)
        .map(([path]) => `${path}*\n  X-Robots-Tag: noindex, nofollow\n`)
        .join(""),
  );
}
