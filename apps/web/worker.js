// Store API for recompsoftware.com. Everything else is static assets (run_worker_first only covers /api/*).
// POST /api/store/checkout  {items:[{product, variant, qty}], region}  -> {url} of a Stripe Checkout session
// Items are keyed by product slug + variant id: products made from the same blank share Printify variant ids.
// POST /api/store/webhook   Stripe checkout.session.completed -> Printify order (live mode: sent to production; test mode: left as a draft)
// Secrets (npx wrangler@4 secret put NAME): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRINTIFY_TOKEN. Var: PRINTIFY_SHOP_ID.
// Prices, variants and shipping come only from data/store.json (bundled at deploy), never from the browser.
import store from '../../data/store.json';

const SITE = 'https://recompsoftware.com';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const key = (slug, id) => `${slug}:${id}`;
const variants = new Map(store.products.flatMap((p) => p.variants.map((v) => [key(p.slug, v.id), { product: p, variant: v }])));

async function stripe(env, path, form) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: form ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(form && { 'content-type': 'application/x-www-form-urlencoded' }) },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`stripe ${path}: ${j.error?.message ?? r.status}`);
  return j;
}

async function printify(env, path, body) {
  const r = await fetch(`https://api.printify.com/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${env.PRINTIFY_TOKEN}`, 'content-type': 'application/json', 'User-Agent': 'recompsoftware-store' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`printify ${path}: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function checkout(req, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const region = store.shipping[body?.region];
  if (!region) return json({ error: 'pick a shipping region' }, 400);
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 20)
    .map((i) => ({ hit: variants.get(key(i?.product, i?.variant)), qty: Math.min(10, Math.max(1, Math.floor(Number(i?.qty) || 0))) }))
    .filter((i) => i.hit && i.hit.variant.available !== false);
  if (!items.length) return json({ error: 'cart is empty' }, 400);

  const form = {
    mode: 'payment',
    success_url: `${SITE}/store/thanks/?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/store/`,
    'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
    'shipping_options[0][shipping_rate_data][display_name]': region.label,
    'shipping_options[0][shipping_rate_data][fixed_amount][amount]': String(region.cents),
    'shipping_options[0][shipping_rate_data][fixed_amount][currency]': store.currency,
    'phone_number_collection[enabled]': 'true',
    // compact cart for the webhook: "slug:variantId:qty,..." (metadata values max 500 chars)
    'metadata[cart]': items.map((i) => `${key(i.hit.product.slug, i.hit.variant.id)}:${i.qty}`).join(','),
    'metadata[region]': body.region,
  };
  region.countries.forEach((c, k) => { form[`shipping_address_collection[allowed_countries][${k}]`] = c; });
  items.forEach((i, k) => {
    form[`line_items[${k}][quantity]`] = String(i.qty);
    form[`line_items[${k}][price_data][currency]`] = store.currency;
    form[`line_items[${k}][price_data][unit_amount]`] = String(i.hit.product.cents);
    form[`line_items[${k}][price_data][product_data][name]`] = `${i.hit.product.name} (${i.hit.variant.title})`;
    if (i.hit.product.image) form[`line_items[${k}][price_data][product_data][images][0]`] = SITE + i.hit.product.image;
  });
  try {
    const s = await stripe(env, 'checkout/sessions', form);
    return json({ url: s.url });
  } catch (e) {
    console.error(String(e));
    return json({ error: 'checkout is unavailable right now' }, 502);
  }
}

// Stripe-Signature: t=..., v1=... ; HMAC-SHA256 of `${t}.${payload}` with the endpoint secret, 5 minute tolerance.
async function verify(payload, header, secret) {
  const parts = Object.fromEntries((header ?? '').split(',').map((kv) => kv.split('=')).filter((p) => p.length === 2));
  const sigs = (header ?? '').split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  if (!parts.t || !sigs.length || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`${parts.t}.${payload}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

async function webhook(req, env) {
  const payload = await req.text();
  if (!(await verify(payload, req.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) return json({ error: 'bad signature' }, 400);
  const event = JSON.parse(payload);
  if (event.type !== 'checkout.session.completed') return json({ ignored: event.type });
  const s = event.data.object;
  if (s.payment_status !== 'paid') return json({ ignored: 'unpaid' });

  const ship = s.collected_information?.shipping_details ?? s.shipping_details;
  const a = ship?.address ?? {};
  const [first, ...rest] = (ship?.name ?? s.customer_details?.name ?? '').trim().split(/\s+/);
  const line_items = String(s.metadata?.cart ?? '').split(',').filter(Boolean).map((pair) => {
    const [slug, id, qty] = pair.split(':');
    const hit = variants.get(key(slug, id));
    return hit && { product_id: hit.product.printifyId, variant_id: hit.variant.id, quantity: Number(qty) };
  }).filter(Boolean);
  if (!line_items.length) return json({ error: 'no items' }, 422);

  const order = {
    external_id: s.id,
    label: `recompsoftware ${s.id.slice(-8)}`,
    line_items,
    shipping_method: 1,
    send_shipping_notification: true,
    address_to: {
      first_name: first || 'Customer', last_name: rest.join(' ') || '-',
      email: s.customer_details?.email ?? '', phone: s.customer_details?.phone ?? '',
      country: a.country ?? '', region: a.state ?? '', address1: a.line1 ?? '', address2: a.line2 ?? '',
      city: a.city ?? '', zip: a.postal_code ?? '',
    },
  };
  try {
    const shop = env.PRINTIFY_SHOP_ID;
    // Stripe retries webhooks: skip if this session already has an order.
    const existing = await printify(env, `shops/${shop}/orders.json?limit=50`);
    if ((existing.data ?? []).some((o) => o.metadata?.shop_order_id === s.id || o.external_id === s.id || o.label === order.label)) return json({ duplicate: true });
    const created = await printify(env, `shops/${shop}/orders.json`, order);
    if (event.livemode) await printify(env, `shops/${shop}/orders/${created.id}/send_to_production.json`, {});
    return json({ order: created.id, production: event.livemode });
  } catch (e) {
    console.error(String(e));
    return json({ error: 'fulfilment failed' }, 500); // non-2xx: Stripe retries for up to 3 days
  }
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (req.method === 'POST' && pathname === '/api/store/checkout') return checkout(req, env);
    if (req.method === 'POST' && pathname === '/api/store/webhook') return webhook(req, env);
    if (pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(req);
  },
};
