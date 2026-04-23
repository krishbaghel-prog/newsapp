function notFound(req, res, _next) {
  res.status(404).json({ error: "Not found", path: req.path });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const status = Number(err.status || 500);
  const message =
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    "Server error";
  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };

