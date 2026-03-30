/**
 * Test script for webhook endpoint
 */

const http = require('http');

const webhookData = {
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_test_123456',
      metadata: {
        order_id: 'test-order-001'
      }
    }
  }
};

const postData = JSON.stringify(webhookData);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': 'test_signature',
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
      console.log('Parsed response:', parsed);
    } catch (e) {
      console.log('Failed to parse JSON:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(postData);
req.end();
