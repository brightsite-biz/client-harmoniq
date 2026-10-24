import client from '../data/client.json';
const paths = ['/', '/privacy', '/accessibility']; // noindex pages (404, thanks) are left out on purpose
export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    paths.map((p) => `  <url><loc>${new URL(p, client.url).href}</loc></url>`).join('\n') + `\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
