// Shared handler for the Harmoniq installer request form. Used by the Cloudflare Pages Function
// (functions/api/contact.js) and the Vercel function (api/contact.js), so both behave the same.
// Needs these environment variables set in the Cloudflare project (never in the repo):
//   TURNSTILE_SECRET   Cloudflare Turnstile secret key (optional until Turnstile is added to the page)
//   RESEND_API_KEY     API key for the email service that delivers the message
//   CONTACT_TO         the address that receives requests
//   CONTACT_FROM       a verified sender address on Harmoniq's domain
// UNTESTED: run a real test submission and confirm it arrives before launch.
const clean = (v, n) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);

export async function handleContact(request, env) {
  const form = await request.formData();
  if (form.get('website')) return Response.redirect(new URL('/thanks', request.url), 303); // honeypot

  const name = clean(form.get('name'), 120);
  const email = clean(form.get('email'), 200);
  const zip = clean(form.get('zip'), 5);
  const tvsize = clean(form.get('tvsize'), 3);
  const build = clean(form.get('build'), 300);
  const message = String(form.get('message') || '').trim().slice(0, 4000);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^\d{5}$/.test(zip)) {
    return new Response('Please fill in your name, a valid email and a five-digit ZIP code.', { status: 400 });
  }
  if (!env.RESEND_API_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) {
    return new Response('This form is not set up yet. Please try again soon.', { status: 503 });
  }

  if (env.TURNSTILE_SECRET) {
    const token = String(form.get('cf-turnstile-response') || '');
    const ok = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: request.headers.get('CF-Connecting-IP') || '' }),
    }).then((r) => r.json()).catch(() => ({ success: false }));
    if (!ok.success) return new Response('Spam check failed. Please try again.', { status: 400 });
  }

  const text = [
    `Installer request from ${name} <${email}>`,
    `ZIP code: ${zip}`,
    `TV size: ${tvsize ? tvsize + '-inch' : 'not sure yet'}`,
    build ? `Build: ${build}` : '',
    message ? `\nMessage:\n${message}` : '',
  ].filter(Boolean).join('\n');

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.CONTACT_FROM, to: env.CONTACT_TO, reply_to: email, subject: `Harmoniq installer request, ZIP ${zip}`, text }),
  });
  if (!send.ok) return new Response('Sorry, your request could not be sent. Please try again later.', { status: 502 });
  return Response.redirect(new URL('/thanks', request.url), 303);
}
