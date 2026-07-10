const LOG_PREFIX = {
  info: '[INFO]',
  error: '[ERROR]',
  warn: '[WARN]',
  success: '[OK]'
};

const formatTimestamp = () => new Date().toISOString();

const log = (level, message, meta = {}) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  console.log(`${LOG_PREFIX[level] || '[LOG]'} ${formatTimestamp()} ${message} ${metaStr}`);
};

module.exports = {
  info: (message, meta) => log('info', message, meta),
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  success: (message, meta) => log('success', message, meta)
};
