
function errorHandler(err, req, res, next) {

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
}

module.exports = errorHandler;
