const express = require('express');

const expensesRouter = require('./routes/expenses');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());


app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});


app.get('/', (req, res) => {
  res.json({
    name: 'Smart Expense Tracker API',
    endpoints: [
      'GET /health',
      'POST /expenses',
      'GET /expenses',
      'GET /expenses?category=Food',
      'GET /expenses/summary',
      'GET /expenses/summary/monthly',
      'DELETE /expenses/:id',
    ],
  });
});

app.use('/expenses', expensesRouter);


app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
