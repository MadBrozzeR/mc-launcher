const fs = require('fs');

function FileSaver (directory, callback) {
  this.count = 0;
  this.root = directory;
  this.callback = callback;
  this.result = {
    hasErrors: false,
    errors: {}
  }
}
FileSaver.save = function (name, data, callback) {
  const dir = name.substr(0, name.lastIndexOf('/') + 1);

  fs.mkdir(dir, {recursive: true}, function (error) {
    if (error) {
      callback(name, error);
    } else {
      fs.writeFile(name, data, function (error) {
        callback(name, error);
      });
    }
  });
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
