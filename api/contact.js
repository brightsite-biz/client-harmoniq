// Vercel Function: POST /api/contact (used for the Vercel test deployment)
// The logic lives in functions/_lib/contact.js. Environment variables are listed there.
import { handleContact } from '../functions/_lib/contact.js';
export async function POST(request) { return handleContact(request, process.env); }
