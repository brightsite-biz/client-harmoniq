// Cloudflare Pages Function: POST /api/contact
// The logic lives in functions/_lib/contact.js. Environment variables are listed there.
import { handleContact } from '../_lib/contact.js';
export const onRequestPost = ({ request, env }) => handleContact(request, env);
