const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Expense Tracker API is running on http://localhost:${PORT}`);
});
