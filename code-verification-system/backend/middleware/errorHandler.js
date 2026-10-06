const AppError = require('../utils/AppError');

const notFound = (req, res, next) =>
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, code, message, details } = err;

  if (err.name === 'ValidationError') { statusCode = 400; code = 'VALIDATION_ERROR'; message = 'Invalid request data.'; }
  else if (err.name === 'CastError') { statusCode = 400; code = 'INVALID_ID'; message = 'Invalid identifier.'; }
  else if (err.code === 11000) { statusCode = 409; code = 'DUPLICATE'; message = 'That value already exists.'; }
  else if (err.type === 'entity.parse.failed') { statusCode = 400; code = 'INVALID_JSON'; message = 'Malformed JSON body.'; }
  else if (err.type === 'entity.too.large') { statusCode = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request body too large.'; }
  else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401; code = 'INVALID_TOKEN'; message = 'Your session is invalid or has expired.';
  }

  if (!statusCode || statusCode >= 500) {
    console.error(err);
    statusCode = 500;
    code = 'SERVER_ERROR';
    message = 'Something went wrong. Please try again later.';
    details = undefined;
  }

  res.status(statusCode).json({ success: false, code, message, ...(details ? { details } : {}) });
};

module.exports = { notFound, errorHandler };
