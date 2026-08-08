const request = require('supertest');
const app = require('../../sample-app/app');

const server = app.default || app;

describe('Vantage API Tests (sequential)', () => {
  it('get-api-todos-1 — GET /api/todos', async () => {
    const res = await request(server)
      .get('/api/todos')
      .set('accept', '*/*');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        "id": 1,
        "title": "Learn Keploy and Vantage"
      },
      {
        "id": 2,
        "title": "Build Vantage"
      }
    ]);
  });

  it('post-api-todos-1 — POST /api/todos', async () => {
    const res = await request(server)
      .post('/api/todos')
      .set('content-type', 'application/json')
      .set('accept', '*/*')
      .send({"title":"Play Cricket"});

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      "id": 3,
      "title": "Play Cricket"
    });
  });

  it('post-api-todos-2 — POST /api/todos', async () => {
    const res = await request(server)
      .post('/api/todos')
      .set('content-type', 'application/json')
      .set('accept', '*/*')
      .send({"title":"Watch Movies"});

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      "id": 4,
      "title": "Watch Movies"
    });
  });

  it('put-api-todos-1 — PUT /api/todos', async () => {
    const res = await request(server)
      .put('/api/todos')
      .set('content-type', 'application/json')
      .set('accept', '*/*')
      .send({"id":1,"title":"Learn Cooking"});

    expect(res.status).toBe(404);
  });

  it('put-api-todos-1-1 — PUT /api/todos/1', async () => {
    const res = await request(server)
      .put('/api/todos/1')
      .set('content-type', 'application/json')
      .set('accept', '*/*')
      .send({"title":"Learn Cooking"});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      "id": 1,
      "title": "Learn Cooking"
    });
  });

  it('get-api-todos-2 — GET /api/todos', async () => {
    const res = await request(server)
      .get('/api/todos')
      .set('accept', '*/*');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        "id": 1,
        "title": "Learn Cooking"
      },
      {
        "id": 2,
        "title": "Build Vantage"
      },
      {
        "id": 3,
        "title": "Play Cricket"
      },
      {
        "id": 4,
        "title": "Watch Movies"
      }
    ]);
  });

  it('delete-api-todos-4-1 — DELETE /api/todos/4', async () => {
    const res = await request(server)
      .delete('/api/todos/4')
      .set('accept', '*/*');

    expect(res.status).toBe(204);
  });

  it('get-api-todos-3 — GET /api/todos', async () => {
    const res = await request(server)
      .get('/api/todos')
      .set('accept', '*/*');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        "id": 1,
        "title": "Learn Cooking"
      },
      {
        "id": 2,
        "title": "Build Vantage"
      },
      {
        "id": 3,
        "title": "Play Cricket"
      }
    ]);
  });

});
