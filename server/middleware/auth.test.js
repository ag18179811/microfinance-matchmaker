import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { requireAuth } from './auth.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

// Dummy but well-formed values so the Supabase client can be constructed —
// no network call happens at construction time, only inside auth.getUser,
// which every test below mocks.
before(() => {
  process.env.VITE_SUPABASE_URL ??= 'https://test-project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
});

test('requireAuth rejects a request with no Authorization header', async () => {
  const req = { headers: {} };
  const res = mockRes();
  let nextCalled = false;
  await requireAuth(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireAuth rejects a token Supabase says is invalid', async () => {
  const admin = getSupabaseAdmin();
  const getUser = mock.method(admin.auth, 'getUser', async () => ({
    data: { user: null },
    error: { message: 'invalid token' },
  }));
  try {
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = mockRes();
    let nextCalled = false;
    await requireAuth(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  } finally {
    getUser.mock.restore();
  }
});

test('requireAuth attaches req.userId and calls next() for a valid token', async () => {
  const admin = getSupabaseAdmin();
  const getUser = mock.method(admin.auth, 'getUser', async () => ({
    data: { user: { id: 'user-123' } },
    error: null,
  }));
  try {
    const req = { headers: { authorization: 'Bearer good-token' } };
    const res = mockRes();
    let nextCalled = false;
    await requireAuth(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.userId, 'user-123');
    assert.equal(res.statusCode, null);
  } finally {
    getUser.mock.restore();
  }
});
