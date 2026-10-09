// Read-only deployment checks. Does not send emails or change account settings.
const input = process.argv[2];
try {
  if (!input) throw new Error('Usage: npm run deploy:check -- https://YOUR-SERVICE.onrender.com');
  const origin = new URL(input);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)
    throw new Error('Use the HTTPS app origin only.');
  const request = async (path) => {
    const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response;
  };
  const health = await (await request('/api/health')).json();
  if (health.ok !== true) throw new Error('Health check failed.');
  const status = await (await request('/api/status')).json();
  if (status.operatorPreview !== false) throw new Error('Disable operator preview before sharing the site.');
  if (status.authConfigured !== true || status.authEmailMode !== 'link')
    throw new Error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and PUBLIC_APP_URL.');
  const home = await request('/');
  if (!(home.headers.get('content-type') || '').includes('text/html') || !(await home.text()).includes('id="root"'))
    throw new Error('The built app is missing. Run the build during deployment.');
  console.log('PASS: HTTPS, server health, app HTML, authentication configuration and disabled operator preview.');
  console.log('Still verify email sign-in, mobile access and saved records after restart on the actual host.');
} catch (error) {
  console.error(`Deployment check failed: ${error.message}`);
  process.exitCode = 1;
}
