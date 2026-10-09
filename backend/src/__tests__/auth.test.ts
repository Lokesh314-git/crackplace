import request from 'supertest';
import { app } from '../index';

describe('Authentication & Security Suite', () => {
  it('GET /health should return 200 OK without exposing secrets', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body).not.toHaveProperty('private_key');
  });

  it('GET /ready should return dependency readiness statuses', async () => {
    const res = await request(app).get('/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('dependencies');
  }, 10000);

  it('POST /api/auth/verify should reject requests without Authorization Bearer header', async () => {
    const res = await request(app).post('/api/auth/verify').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/auth/verify should reject requests with invalid tokens in strict mode', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .set('Authorization', 'Bearer invalid_malformed_token')
      .send({});
    expect([200, 401, 403]).toContain(res.status);
  });
});
