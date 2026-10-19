// Every 6 hours (05:23 = the daily snapshot run): start a Workers Build of the site.
export default {
  async scheduled(event, env) {
    if (!env.DEPLOY_HOOK) { console.log('recomp-cron: DEPLOY_HOOK not set, skipped'); return; }
    const r = await fetch(env.DEPLOY_HOOK, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    console.log(`recomp-cron: ${event.cron} -> HTTP ${r.status} build ${j.result?.build_uuid ?? '?'}${j.result?.already_exists ? ' (already pending)' : ''}`);
    if (!r.ok) throw new Error(`deploy hook HTTP ${r.status}`);
  },
};
