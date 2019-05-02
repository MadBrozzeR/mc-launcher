const https = require('https');
const http = require('http');
const fs = require('fs');
const MBRZip = require('mbr-zip').MBRZip;
const mojangApi = require('./mojang-api.js');
const FileSaver = require('./file-saver.js').FileSaver;
const Fetcher = require('./fetcher.js').Fetcher;

const MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';

const ROOT = __dirname;

const ARG_RE = /^--([-\w]+)(?:=(.*))?$/;

const ACTION = process.argv[2];
const args = {};
for (let index = 3 ; index < process.argv.length ; ++index) {
  const regMatch = ARG_RE.exec(process.argv[index]);
  if (regMatch) {
    args[regMatch[1]] = regMatch[2] === undefined ? true : regMatch[2];
  }
}

function print (data, error) {
  process.stdout.write(data);
  error && console.log(error);
}

const fetcher = new Fetcher(6);

function get (path, callback) {
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
      callback(Buffer.concat(data, length));
    });
  }).end();
}

function downloadNatives (library, callback) {
  const name = library.downloads.classifiers['natives-linux'].path;
  const path = ROOT + '/natives/';
  let exclude = library.extract && library.extract.exclude;
  exclude = exclude && (new RegExp('^(?:' + exclude.join('|') + ')'));

  get('https://libraries.minecraft.net/' + name, function (data) {
    const saver = new FileSaver(path, function (result) {
      callback(result.hasErrors && result.errors);
    });

    const zip = new MBRZip(data);
    for (let index = 0 ; index < zip.cd.length ; ++index) {
      if (!exclude || !exclude.exec(zip.cd[index].name)) {
        saver.asyncSave(zip.cd[index].name, function (save) {
          zip.extract(index, function (error, data) {
            save(data);
          });
        });
      }
    }
  });
}

function downloadClient (version, callback) {
  get(version.downloads.client.url, function (data) {
    FileSaver.save(version.id + '/client.jar', data, function (name, error) {
      if (error) {
        print('Failed to download client\n', error);
      } else {
        print('Client downloaded successfully\n');
      }
      callback(name, error);
    });
  });
}

function downloadAssets (assetsIndex, callback) {
  get(assetsIndex.url, function (data) {
    const response = JSON.parse(data.toString());
    const saver = new FileSaver(ROOT + '/assets/', function (result) {
      callback(result);
    });

    for (let name in response.objects) {
      saver.asyncSave(name, function (callback) {
        let path = response.objects[name].hash.substr(0, 2) + '/' + response.objects[name].hash;
        get('http://resources.download.minecraft.net/' + path, function (data) {
          print('Downloaded asset ' + name + '\n');
          callback(data);
        });
      });
    }
  });
}

function downloadLibrary (library, callback) {
  const name = library.downloads.artifact.path;
  const path = ROOT + '/libraries/';

  const downloaded = {
    library: false,
    natives: false
  };

  function done () {
    if (downloaded.library && downloaded.natives) {
      callback(library);
    }
  }

  fs.access(path, fs.constants.F_OK, function (error) {
    if (error) {
      get('https://libraries.minecraft.net/' + name, function (data) {
        FileSaver.save(path + '/' + name, data, function (name, error) {
          if (error) {
            console.log(error);
          }
          print('Library downloaded: ' + library.name + '\n');
          downloaded.library = true;
          done();
        });
      });
    } else {
      print('Library already exists: ' + library.name + '\n');
      downloaded.library = true;
      done();
    }
  });

  if (library.downloads.classifiers && library.downloads.classifiers['natives-linux']) {
    downloadNatives(library, function (error) {
      if (error) {
        console.log(error);
      }
      print('Downloaded natives for: ' + library.name + '\n');
      downloaded.natives = true;
      done();
    });
  } else {
    downloaded.natives = true;
    done();
  }
}

function requestVersions (callback) {
  get(MANIFEST, function (data) {callback(JSON.parse(data));});
}

function versionInfo (version, callback) {
  requestVersions(function (meta) {
    let result;

    for (let index = 0 ; index < meta.versions.length ; ++index) {
      if (meta.versions[index].id === version) {
        result = meta.versions[index];
        break;
      }
    }

    if (result) {
      get(result.url, function (data) {
        callback(JSON.parse(data));
      });
    }
  });
}

function authenticate (user, pass) {
  mojangApi.auth(user, pass, function (status, data) {
    if (status === 200) {
      const username = data.selectedProfile.name;
      FileSaver.save(
        ROOT + '/users/' + username + '.json',
        JSON.stringify(data),
        function (name, error) {
          if (error) {
            print('Failed to write authentication data\n');
          } else {
            print('Authentication success: ' + username + '\n');
          }
        }
      );
    } else {
      print('Authentication failed: \n');
      console.log(data);
    }
  });
}

switch (ACTION) {
  case 'list':
    requestVersions(function (meta) {
      let count = args.count ? parseInt(args.count, 10) : -1;
      for (let index = 0 ; index < meta.versions.length && count ; ++index) {
        const item = meta.versions[index];
        if (item.type === 'snapshot' && !args.snaps) {
          continue;
        }
        print(item.id + '\n');
        --count;
      }
    });
    break;
  case 'make':
    versionInfo(args.id, function (data) {
      let counter = data.libraries.length + 1;
      function next () {
        if (--counter === 0) {
          downloadAssets(data.assetIndex, function (result) {
            if (result.hasErrors) {
              print('Failed to save some assets\n');
              console.log(result.errors);
            }
            print('All downloaded\n');
          });
        }
      }
      downloadClient(data, next);
      for (let index = 0 ; index < data.libraries.length ; ++index) {
        downloadLibrary(data.libraries[index], next);
      }
    });
    break;
  case 'login':
    authenticate(args.name, args.pass);
    break;
  default:
    requestVersions(function (data) {
      console.log(data);
    });
    break;
}
