
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_CATEGORIES = [];
const ALLOW_FUTURE_DATES = true;
const MAX_AMOUNT = null;

function isRealDate(value) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
 
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateExpense(body) {
  const errors = [];

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return ['Request body must be a JSON object'];
  }

  
  if (typeof body.title !== 'string' || body.title.trim() === '') {
    errors.push('title is required and must be a non-empty string');
  }

  if (!Number.isFinite(body.amount)) {
    errors.push('amount is required and must be a number');
  } else if (body.amount <= 0) {
    errors.push('amount must be greater than 0');
  } else if (MAX_AMOUNT !== null && body.amount > MAX_AMOUNT) {
    errors.push(`amount must not be greater than ${MAX_AMOUNT}`);
  }

 
  if (typeof body.category !== 'string' || body.category.trim() === '') {
    errors.push('category is required and must be a non-empty string');
  } else if (ALLOWED_CATEGORIES.length > 0 && !ALLOWED_CATEGORIES.includes(body.category.trim())) {
    errors.push(`category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
  }

  if (typeof body.date !== 'string' || !isRealDate(body.date)) {
    errors.push('date is required and must be a real date in YYYY-MM-DD format');
  } else if (!ALLOW_FUTURE_DATES) {
    const today = new Date().toISOString().slice(0, 10);
    if (body.date > today) {
      errors.push('date cannot be in the future');
    }
  }

  return errors;
}

module.exports = { validateExpense, ALLOWED_CATEGORIES };
