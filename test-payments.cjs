/**
 * Test script for payments API with real Stripe keys
 */

const http = require('http');

const testData = {
  order_id: 'test-order-002',
  amount: 5000, // 50.00 EUR in cents
  currency: 'eur',
  metadata: {
    client_name: 'Test Klientas',
    service_type: 'window_cleaning'
  }
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/create-payment-intent',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    try {
      const parsed = JSON.parse(data);
      console.log('✅ Payment Intent Created Successfully!');
      console.log('Payment Intent ID:', parsed.id);
      console.log('Client Secret:', parsed.client_secret);
      console.log('Amount:', parsed.amount / 100, 'EUR');
      console.log('Status:', parsed.status);
    } catch (e) {
      console.log('❌ Failed to parse JSON:', e.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(postData);
req.end();
