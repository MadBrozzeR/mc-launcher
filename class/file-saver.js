const fs = require('fs');
const crypto = require('crypto');

function FileSaver (directory, callback) {
  this.count = 0;
  this.root = directory;
  this.callback = callback;
  this.result = {
    hasErrors: false,
    errors: {}
  }
}
function save (name, data, options, callback) {
  const dir = name.substr(0, name.lastIndexOf('/') + 1);

  fs.mkdir(dir, {recursive: true}, function (error) {
    if (error) {
      callback && callback(name, error);
    } else {
      fs.writeFile(name, data, options, function (error) {
        callback && callback(name, error);
      });
    }
  });
}
FileSaver.save = function (name, data, callback) {
  return save(name, data, undefined, callback);
}
FileSaver.saveExecutable = function (name, data, callback) {
  return save(name, data, {mode: 0o766}, callback);
}
FileSaver.exists = function (path, callback) {
  fs.access(path, fs.constants.F_OK, function (error) {
    if (error) {
      callback && callback(false);
    } else {
      callback && callback(true);
    }
  })
}
FileSaver.check = function (path, hash, callback) {
  const stream = fs.createReadStream(path);
  let sha1;

  stream.on('error', function () {
    callback(false);
  });
  stream.on('readable', function () {
    const data = stream.read();

    if (!sha1) {
      sha1 = crypto.createHash('sha1');
    }

    if (data) {
      sha1.update(data);
    } else {
      callback(sha1.digest('hex') === hash);
    }
  });
}
FileSaver.read = function (path, callback) {
  fs.readFile(path, callback);
}
FileSaver.prototype.done = function (name, error) {
  if (error) {
    this.result.hasErrors = true;
    this.result.errors[name] = error;
  }

  if (--this.count === 0) {
    this.callback(this.result);
  }
}
FileSaver.prototype.save = function (name, data, disableCounter) {
  const saver = this;
  const dir = name.substr(0, name.lastIndexOf('/') + 1);
  const path = this.root + '/';

  if (dir === name) {
    --this.count;
    return;
  }

  if (!disableCounter) {
    ++this.count;
  }

  FileSaver.save(path + name, data, function (name, error) {
    saver.done(name, error)
  });
};
FileSaver.prototype.asyncSave = function (name, callback) {
  const saver = this;
  ++this.count;
  callback(function (data) {
    saver.save(name, data, true);
  });
}

module.exports = {
  FileSaver
};
