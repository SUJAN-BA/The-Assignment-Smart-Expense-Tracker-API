const express = require('express');
const crypto = require('crypto');

const store = require('../store');
const { validateExpense } = require('../validation');

const router = express.Router();


function round2(value) {
  return Math.round(value * 100) / 100;
}


function toAmount(value) {
  return Number.isFinite(value) ? value : 0;
}

function toMonth(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}/.test(value)
    ? value.slice(0, 7) // "2026-01-31" -> "2026-01"
    : 'unknown';
}

// POST /expenses - add a new expense
router.post('/', (req, res) => {
  const errors = validateExpense(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const expense = {
    id: crypto.randomUUID(),
    title: req.body.title.trim(),
    amount: round2(req.body.amount),
    category: req.body.category.trim(),
    date: req.body.date,
  };

  const expenses = store.readAll();
  expenses.push(expense);
  store.writeAll(expenses);

  res.status(201).json(expense);
});


router.get('/summary', (req, res) => {
  const expenses = store.readAll();

  let total = 0;
  const byCategory = {};

  for (const expense of expenses) {
    const amount = toAmount(expense.amount);
    total += amount;
    byCategory[expense.category] = (byCategory[expense.category] || 0) + amount;
  }

  
  for (const category of Object.keys(byCategory)) {
    byCategory[category] = round2(byCategory[category]);
  }

  res.json({
    count: expenses.length,
    total: round2(total),
    byCategory,
  });
});


router.get('/summary/monthly', (req, res) => {
  const expenses = store.readAll();
  const byMonth = {};

  for (const expense of expenses) {
    const month = toMonth(expense.date);

    if (!byMonth[month]) {
      byMonth[month] = { count: 0, total: 0 };
    }

    byMonth[month].count += 1;
    byMonth[month].total += toAmount(expense.amount);
  }

  for (const month of Object.keys(byMonth)) {
    byMonth[month].total = round2(byMonth[month].total);
  }

  res.json({ months: byMonth });
});


router.get('/', (req, res) => {
  const expenses = store.readAll();
  const categoryQuery = typeof req.query.category === 'string' ? req.query.category.trim() : '';

  if (!categoryQuery) {
    return res.json(expenses);
  }

  const normalizedQuery = categoryQuery.toLowerCase();
  const filtered = expenses.filter((expense) =>
    expense.category.toLowerCase() === normalizedQuery
  );

  res.json(filtered);
});


router.delete('/:id', (req, res) => {
  const expenses = store.readAll();
  const index = expenses.findIndex((expense) => expense.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: `Expense with id ${req.params.id} not found` });
  }

  const [deletedExpense] = expenses.splice(index, 1);
  store.writeAll(expenses);

  res.status(200).json(deletedExpense);
});

module.exports = router;
