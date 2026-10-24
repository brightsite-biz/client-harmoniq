// Cloudflare Pages Function: POST /api/contact
// Needs these environment variables set in the Cloudflare project (never in the repo):
//   TURNSTILE_SECRET   Cloudflare Turnstile secret key
//   RESEND_API_KEY     API key for the email service that delivers the message
//   CONTACT_TO         the client's address that receives messages
//   CONTACT_FROM       a verified sender address on the client's domain
// UNTESTED in this template: run a real test submission and confirm it arrives before launch.
export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  if (form.get('website')) return Response.redirect(new URL('/thanks', request.url), 303); // honeypot

  const name = String(form.get('name') || '').trim().slice(0, 120);
  const email = String(form.get('email') || '').trim().slice(0, 200);
  const message = String(form.get('message') || '').trim().slice(0, 4000);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !message) {
    return new Response('Please fill in your name, a valid email and a message.', { status: 400 });
  }

  if (env.TURNSTILE_SECRET) {
    const token = String(form.get('cf-turnstile-response') || '');
    const ok = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: request.headers.get('CF-Connecting-IP') || '' }),
    }).then((r) => r.json()).catch(() => ({ success: false }));
    if (!ok.success) return new Response('Spam check failed. Please try again.', { status: 400 });
  }

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.CONTACT_FROM, to: env.CONTACT_TO, reply_to: email, subject: `Website message from ${name}`, text: `${message}\n\nFrom: ${name} <${email}>` }),
  });
  if (!send.ok) return new Response('Sorry, your message could not be sent. Please call us instead.', { status: 502 });
  return Response.redirect(new URL('/thanks', request.url), 303);
}
