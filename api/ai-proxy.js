// Vercel Serverless Function — proxy gọi AI để giấu API key.
// Mini-app gọi: POST /api/ai-proxy với { prompt }
//   header: Authorization: Bearer {token}, X-Workspace-Id: {workspaceId}
//
// Set env ở Vercel:
//   GEMINI_API_KEY  (AI provider — secret thật, KHÔNG cho vào mushy.config.json)
//
// _verify.js dùng anon + user JWT (không cần service_role). URL + anon key
// đọc từ mushy.config.json đã committed.

import { verifyRequest } from './_verify.js';
import {
  buildCatalogPayload,
  parseRoleSuggestionText,
  validateRoleSuggestionPayload,
} from '../src/lib/app/role-suggestions.js';
import { STANDARD_SKILLS } from '../src/lib/app/skill-catalog.js';

const GEMINI_FLASH_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const MAX_ROLE_TEXT_LENGTH = 160;
const MAX_ROLE_PROMPT_LENGTH = 12000;

export function buildRoleSuggestionPrompt({ roleText, catalog, maxSuggestions }) {
  const catalogJson = JSON.stringify(catalog, null, 2);

  return [
    'You suggest skills for a professional role using only the supplied catalog.',
    `Role: ${roleText}`,
    `Return up to ${maxSuggestions} suggestions.`,
    'Each suggestion must use a catalog_key from the catalog exactly.',
    'Return JSON only with this shape:',
    '{"role":"Role name","suggestions":[{"catalog_key":"catalog.key","reason":"short reason"}]}',
    'Catalog:',
    catalogJson,
  ].join('\n');
}

export async function handleRoleSuggestionRequest({ body, apiKey, fetchImpl = fetch }) {
  const rawRoleText = String(body?.roleText || '');
  if (rawRoleText.length > MAX_ROLE_TEXT_LENGTH) {
    return { status: 400, body: { error: 'prompt_too_large' } };
  }

  const roleText = rawRoleText.trim().slice(0, 80);
  if (!roleText) {
    return { status: 400, body: { error: 'role_text_required' } };
  }

  const catalog = sanitizeCatalog(body?.catalog);
  if (!catalog.length) {
    return { status: 400, body: { error: 'catalog_required' } };
  }

  if (!apiKey) {
    return { status: 500, body: { error: 'missing_gemini_api_key' } };
  }

  const maxSuggestions = clampInteger(body?.maxSuggestions, 1, 12);
  const prompt = buildRoleSuggestionPrompt({ roleText, catalog, maxSuggestions });
  if (prompt.length > MAX_ROLE_PROMPT_LENGTH) {
    return { status: 400, body: { error: 'prompt_too_large' } };
  }

  let response;
  try {
    response = await fetchImpl(`${GEMINI_FLASH_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
  } catch {
    return { status: 502, body: { error: 'upstream_fetch_failed' } };
  }

  if (!response.ok) {
    const detail = await response.text();
    return { status: 502, body: { error: 'upstream', detail } };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { status: 502, body: { error: 'upstream_json_invalid' } };
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  let payload;
  try {
    payload = parseRoleSuggestionText(text);
  } catch (error) {
    if (error?.code === 'invalid_json') {
      return { status: 502, body: { error: 'invalid_ai_json' } };
    }
    throw error;
  }

  const catalogKeys = catalog.map((skill) => skill.key);
  const validated = validateRoleSuggestionPayload({ payload, catalogKeys, maxSuggestions });
  return { status: 200, body: validated };
}

export async function handleGenericPromptRequest({ body, apiKey, fetchImpl = fetch }) {
  const { prompt } = body || {};
  if (!prompt || typeof prompt !== 'string') {
    return { status: 400, body: { error: 'prompt required' } };
  }

  if (!apiKey) {
    return { status: 500, body: { error: 'GEMINI_API_KEY chưa set' } };
  }

  const response = await fetchImpl(
    `${GEMINI_FLASH_ENDPOINT}?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    return { status: 502, body: { error: 'upstream', detail: text } };
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return { status: 200, body: { text } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ctx = await verifyRequest(req);
  if (!ctx) return res.status(401).json({ error: 'unauthorized' });

  if (req.body?.action === 'suggest_role_skills') {
    const response = await handleRoleSuggestionRequest({
      body: req.body,
      apiKey: process.env.GEMINI_API_KEY,
      fetchImpl: fetch,
    });
    return res.status(response.status).json(response.body);
  }

  const response = await handleGenericPromptRequest({
    body: req.body,
    apiKey: process.env.GEMINI_API_KEY,
    fetchImpl: fetch,
  });
  return res.status(response.status).json({
    ...response.body,
    ...(response.status === 200 ? { workspaceId: ctx.workspaceId } : {}),
  });
}

function sanitizeCatalog(catalog) {
  if (!Array.isArray(catalog)) return [];

  const serverCatalogByKey = new Map(buildCatalogPayload(STANDARD_SKILLS).map((skill) => [skill.key, skill]));
  const seen = new Set();
  const sanitized = [];

  for (const skill of catalog) {
    const key = String(skill?.key || '').trim();
    if (!key || seen.has(key)) continue;

    const serverSkill = serverCatalogByKey.get(key);
    if (!serverSkill) continue;

    seen.add(key);
    sanitized.push(serverSkill);
  }

  return sanitized;
}

function clampInteger(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
