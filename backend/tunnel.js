const ngrok = require('@ngrok/ngrok');

(async function() {
  try {
    const listener = await ngrok.forward({
      addr: 'https://10.125.131.153:3000',
      domain: 'emerald-stank-yin.ngrok-free.dev',
      authtoken: '3L3x1n3uIJJnP1RBl0rICt5VmHa_eJrDixjtmtcVkA69rJX3',
      verify_upstream_tls: false
    });
    console.log(`NGROK_ONLINE: ${listener.url()}`);
    
    // Manter processo vivo
    process.stdin.resume();
  } catch (err) {
    console.error('NGROK_ERROR:', err);
  }
})();
