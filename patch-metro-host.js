const net = require('net');
const originalListen = net.Server.prototype.listen;

net.Server.prototype.listen = function(...args) {
  if (args.length >= 2 && typeof args[1] === 'string' && (args[1] === 'localhost' || args[1] === '127.0.0.1') && args[0] === 8081) {
    args[1] = '0.0.0.0';
  }
  
  if (args.length >= 1 && typeof args[0] === 'object' && args[0] !== null) {
    const opts = args[0];
    if ((opts.host === 'localhost' || opts.host === '127.0.0.1') && opts.port === 8081) {
      opts.host = '0.0.0.0';
    }
  }
  
  return originalListen.apply(this, args);
};
