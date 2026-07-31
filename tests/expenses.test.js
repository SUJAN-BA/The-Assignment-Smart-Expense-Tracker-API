const fs = require('fs');
const os = require('os');
const path = require('path');

// Point the API at a throwaway data file before app.js is loaded,
// so the real data/expenses.json is never touched by the tests.
const TEST_FILE = path.join(os.tmpdir(), 'expense-tracker-expenses.test.json');
process.env.DATA_FILE = TEST_FILE;

const request = require('supertest');
const app = require('../src/app');

// A valid expense we can reuse in the tests
const sampleExpense = {
  title: 'Lunch at canteen',
  amount: 120.5,
  category: 'Food',
  date: '2026-01-15',
};

beforeEach(() => {
  fs.writeFileSync(TEST_FILE, '[]', 'utf-8');
});

afterAll(() => {
  if (fs.existsSync(TEST_FILE)) {
    fs.unlinkSync(TEST_FILE);
  }
});

describe('GET /health', () => {
  it('says the server is ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /', () => {
  it('lists the available endpoints instead of returning 404', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body.endpoints).toEqual(
      expect.arrayContaining([expect.stringContaining('/expenses')])
    );
  });
});

describe('POST /expenses', () => {
  it('creates an expense and gives it an id', async () => {
    const res = await request(app).post('/expenses').send(sampleExpense);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Lunch at canteen');
    expect(res.body.amount).toBe(120.5);
    expect(res.body.category).toBe('Food');
    expect(res.body.date).toBe('2026-01-15');
  });

  it('saves the expense so it comes back in GET /expenses', async () => {
    await request(app).post('/expenses').send(sampleExpense);

    const res = await request(app).get('/expenses');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Lunch at canteen');
  });

  it('rejects an expense with no title', async () => {
    const res = await request(app)
      .post('/expenses')
      .send({ amount: 50, category: 'Food', date: '2026-01-15' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('title')])
    );
  });

  it('rejects an amount that is zero or negative', async () => {
    const res = await request(app)
      .post('/expenses')
      .send({ ...sampleExpense, amount: -10 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('greater than 0')])
    );
  });

  it('rejects a date that is not in YYYY-MM-DD format', async () => {
    const res = await request(app)
      .post('/expenses')
      .send({ ...sampleExpense, date: '15/01/2026' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('date')])
    );
  });

  it('rejects an amount too large to represent, instead of storing null', async () => {
    // JSON.parse turns 1e400 into Infinity, and JSON.stringify writes Infinity
    // back out as null - so without this check the expense would be saved with
    // no amount at all and the summary would quietly count it as 0.
    const res = await request(app)
      .post('/expenses')
      .set('Content-Type', 'application/json')
      .send('{"title":"Overflow","amount":1e400,"category":"Food","date":"2026-01-15"}');

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('amount')])
    );

    const listRes = await request(app).get('/expenses');
    expect(listRes.body).toEqual([]);
  });

  it('rejects a body that is not valid JSON', async () => {
    const res = await request(app)
      .post('/expenses')
      .set('Content-Type', 'application/json')
      .send('{"title": broken}');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Request body is not valid JSON');
  });
});

describe('GET /expenses', () => {
  it('returns an empty list when nothing has been added', async () => {
    const res = await request(app).get('/expenses');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /expenses/summary', () => {
  it('adds up the overall total and the total for each category', async () => {
    await request(app).post('/expenses').send({ ...sampleExpense, amount: 100, category: 'Food' });
    await request(app).post('/expenses').send({ ...sampleExpense, amount: 50, category: 'Food' });
    await request(app).post('/expenses').send({ ...sampleExpense, amount: 25, category: 'Travel' });

    const res = await request(app).get('/expenses/summary');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.total).toBe(175);
    expect(res.body.byCategory).toEqual({ Food: 150, Travel: 25 });
  });

  it('is not confused by floating point maths', async () => {
    await request(app).post('/expenses').send({ ...sampleExpense, amount: 0.1 });
    await request(app).post('/expenses').send({ ...sampleExpense, amount: 0.2 });

    const res = await request(app).get('/expenses/summary');

    expect(res.body.total).toBe(0.3);
  });
});

describe('GET /expenses/summary/monthly', () => {
  it('groups the totals by month', async () => {
    await request(app).post('/expenses').send({ ...sampleExpense, amount: 100, date: '2026-01-05' });
    await request(app).post('/expenses').send({ ...sampleExpense, amount: 40, date: '2026-01-20' });
    await request(app).post('/expenses').send({ ...sampleExpense, amount: 60, date: '2026-02-02' });

    const res = await request(app).get('/expenses/summary/monthly');

    expect(res.status).toBe(200);
    expect(res.body.months['2026-01']).toEqual({ count: 2, total: 140 });
    expect(res.body.months['2026-02']).toEqual({ count: 1, total: 60 });
  });

  it('does not treat the word summary as an expense id', async () => {
    // This is the reason the /summary routes are registered before /:id
    const res = await request(app).get('/expenses/summary');

    expect(res.status).toBe(200);
    expect(res.body.total).toBeDefined();
  });
});

describe('a data file that was edited by hand', () => {
  it('still answers both summaries instead of returning 500', async () => {
    fs.writeFileSync(
      TEST_FILE,
      JSON.stringify([
        { id: 'a', title: 'Good row', amount: 10, category: 'Food', date: '2026-01-05' },
        { id: 'b', title: 'No date', amount: 5, category: 'Food' },
        { id: 'c', title: 'Bad amount', amount: 'ten', category: 'Food', date: '2026-01-06' },
      ]),
      'utf-8'
    );

    const summary = await request(app).get('/expenses/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.total).toBe(15);
    expect(summary.body.byCategory).toEqual({ Food: 15 });

    const monthly = await request(app).get('/expenses/summary/monthly');
    expect(monthly.status).toBe(200);
    expect(monthly.body.months['2026-01']).toEqual({ count: 2, total: 10 });
    expect(monthly.body.months.unknown).toEqual({ count: 1, total: 5 });
  });
});

describe('unknown routes', () => {
  it('returns 404 with a JSON error', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
