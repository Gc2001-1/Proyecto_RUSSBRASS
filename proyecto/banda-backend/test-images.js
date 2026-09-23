const http = require('http');
const https = require('https');

const urls = [
  { name: 'fondo', url: 'https://i.imgur.com/J2KjD2o.jpeg' },
  { name: 'logo', url: 'https://i.imgur.com/yR4BQqV.jpeg' }
];

function checkUrl(item) {
  return new Promise((resolve) => {
    const client = item.url.startsWith('https') ? https : http;
    client.get(item.url, (res) => {
      const status = res.statusCode;
      const contentType = res.headers['content-type'] || '';
      console.log(`${item.name}: ${status} ${contentType}`);
      resolve({ name: item.name, ok: status >= 200 && status < 400, status, contentType });
    }).on('error', (err) => {
      console.log(`${item.name}: ERROR ${err.message}`);
      resolve({ name: item.name, ok: false, error: err.message });
    });
  });
}

(async () => {
  const results = await Promise.all(urls.map(checkUrl));
  const failed = results.filter(r => !r.ok);

  if (failed.length === 0) {
    console.log('Todas las URLs de imagen responden correctamente.');
  } else {
    console.log('Hay problemas con estas URLs:');
    failed.forEach(r => console.log('-', r.name, r.error || r.status));
  }
})();
