function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message, err.stack);

  const status = err.status || 500;
  const message = err.expose ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
}

// Convenience factory for HTTP errors
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

module.exports = { errorHandler, httpError };
