const request = require('supertest');
const app = require('../../sample-app/app.ts');

const server = app.default || app;

describe('Vantage API Tests (sequential)', () => {
  it('get-api-todos-1 — GET /api/todos', async () => {
    const res = await request(server)
      .get('/api/todos')
      .set('accept', '*/*');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        "id": expect.any(Number),
        "title": "Learn Keploy and Vantage"
      },
      {
        "id": expect.any(Number),
        "title": "Build Vantage"
      }
    ]);
  });

  it('delete-api-todos-4-1 — DELETE /api/todos/4', async () => {
    const res = await request(server)
      .delete('/api/todos/4')
      .set('accept', '*/*');

    expect(res.status).toBe(204);
  });

  it('get-api-todos-2 — GET /api/todos', async () => {
    const res = await request(server)
      .get('/api/todos')
      .set('accept', '*/*');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        "id": expect.any(Number),
        "title": "Learn Keploy and Vantage"
      },
      {
        "id": expect.any(Number),
        "title": "Build Vantage"
      }
    ]);
  });

  it('put-api-todos-10-1 — PUT /api/todos/10', async () => {
    const res = await request(server)
      .put('/api/todos/10')
      .set('content-type', 'application/json')
      .set('accept', '*/*')
      .send({"title":"Learn Cooking"});

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      "error": "Todo not found"
    });
  });

  it('post-api-todos-1 — POST /api/todos', async () => {
    const res = await request(server)
      .post('/api/todos')
      .set('content-type', 'application/json')
      .set('accept', '*/*')
      .send({"title":"Watch Movies"});

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      "id": expect.any(Number),
      "title": "Watch Movies"
    });
  });

});
