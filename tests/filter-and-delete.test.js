const fs = require('fs');
const os = require('os');
const path = require('path');

const TEST_FILE = path.join(os.tmpdir(), 'expense-tracker-filter-delete.test.json');
process.env.DATA_FILE = TEST_FILE;

const request = require('supertest');
const app = require('../src/app');

const sampleExpense = {
  title: 'Bus ticket',
  amount: 30,
  category: 'Travel',
  date: '2026-01-10',
};

beforeEach(() => {
  fs.writeFileSync(TEST_FILE, '[]', 'utf-8');
});

afterAll(() => {
  if (fs.existsSync(TEST_FILE)) {
    fs.unlinkSync(TEST_FILE);
  }
});

// Adds an expense and returns the created object (including its id)
async function addExpense(overrides = {}) {
  const res = await request(app)
    .post('/expenses')
    .send({ ...sampleExpense, ...overrides });
  return res.body;
}

describe('GET /expenses?category=', () => {
  it('returns only the expenses in the requested category', async () => {
    await addExpense({ title: 'Train ticket', category: 'Travel' });
    await addExpense({ title: 'Lunch', category: 'Food' });

    const res = await request(app).get('/expenses?category=Travel');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('Travel');
    expect(res.body[0].title).toBe('Train ticket');
  });

  it('returns an empty list for a category that has no expenses', async () => {
    await addExpense({ title: 'Taxi fare', category: 'Transport' });

    const res = await request(app).get('/expenses?category=Shopping');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('matches category case-insensitively', async () => {
    await addExpense({ title: 'Dinner', category: 'Food' });

    const res = await request(app).get('/expenses?category=food');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('Food');
  });
});

describe('DELETE /expenses/:id', () => {
  it('deletes an existing expense and it no longer appears in GET /expenses', async () => {
    const expense = await addExpense({ title: 'Taxi ride' });

    const deleteRes = await request(app).delete(`/expenses/${expense.id}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.id).toBe(expense.id);

    const listRes = await request(app).get('/expenses');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual([]);
  });

  it('returns 404 when the id does not exist', async () => {
    await addExpense({ title: 'Coffee' });

    const res = await request(app).delete('/expenses/abc123');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('does not change the other expenses when one is deleted', async () => {
    const keep = await addExpense({ title: 'Coffee', category: 'Food' });
    const remove = await addExpense({ title: 'Train ticket', category: 'Travel' });

    const deleteRes = await request(app).delete(`/expenses/${remove.id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.id).toBe(remove.id);

    const listRes = await request(app).get('/expenses');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(keep.id);
  });
});
