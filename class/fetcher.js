const https = require('https');
const http = require('http');

function Fetcher (count, callback) {
  this.counter = 0;
  this.index = 0;
  this.max = count;
  this.queue = [];
  this.callback = callback;
}
Fetcher.fetch = function (path, callback) {
  const protocol = path[4] === 's' ? https : http;

  protocol.request(path, function (message) {
    let data = [];
    let length = 0;
    let counter = 0;
    message.on('data', function (chunk) {
      data.push(chunk);
      length += chunk.length;
    });
    message.on('end', function () {
      callback && callback(Buffer.concat(data, length));
    });
  }).end();
}
Fetcher.prototype.get = function (path, callback) {
  this.queue.push(arguments);
  this.start();
};
Fetcher.prototype.start = function () {
  if (this.queue.length > this.counter) {
    if ((this.index - this.counter) < this.max) {
      this.download();
    }
  } else {
    this.callback && this.callback();
  }
};
Fetcher.prototype.download = function () {
  const next = this.queue[this.index++];
  if (!next) {
    return;
  }

  const path = next[0];
  const callback = next[1];
  const fetcher = this;

  Fetcher.fetch(path, function (data) {
    fetcher.counter++;
    fetcher.start();
    callback && callback(data);
  });
};

module.exports = {
  Fetcher
};
