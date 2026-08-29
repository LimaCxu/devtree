import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { verifyWebhookSignature } from '../server/api.js';

test('accepts only an exact GitHub HMAC signature',()=>{
  const body=Buffer.from('{"ref":"refs/heads/main"}');
  const secret='webhook-test-secret';
  const signature=`sha256=${crypto.createHmac('sha256',secret).update(body).digest('hex')}`;
  assert.equal(verifyWebhookSignature(body,signature,secret),true);
  assert.equal(verifyWebhookSignature(Buffer.from('{}'),signature,secret),false);
  assert.equal(verifyWebhookSignature(body,'sha256=invalid',secret),false);
  assert.equal(verifyWebhookSignature(body,undefined,secret),false);
});
