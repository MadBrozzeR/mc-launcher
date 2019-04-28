const https = require('https');
const fs = require('fs');

// https://launchermeta.mojang.com/mc/game/version_manifest.json
const LAUNCHERMETA = {
  hostname: 'launchermeta.mojang.com',
  path: '/mc/game/version_manifest.json'
};

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

function print (data) {
  process.stdout.write(data);
}

function get (host, path, callback) {
  https.request({
    hostname: host,
    path: path
  }, function (message) {
    let data = [];
    let length = 0;
    message.on('data', function (chunk) {
      data.push(chunk);
      length += chunk.length;
    });
    message.on('end', function () {
      callback(Buffer.concat(data, length));
    });
  }).end();
}

function downloadLibrary (library, callback) {
  const name = library.downloads.artifact.path;
  const path = ROOT + '/libraries/' + name;
  const dir = path.substr(0, path.lastIndexOf('/'));

  fs.access(path, fs.constants.F_OK, function (error) {
    if (error) {
      fs.mkdir(dir, {recursive: true}, function (error) {
        if (error) {
	  console.log(error);
	} else {
          get('libraries.minecraft.net', '/' + name, function (data) {
            fs.writeFile(path, data, function (error) {
              if (error) {
                console.log(error);
              } else {
                callback(library);
              }
            });
          });
	}
      });
    } else {
      callback(library);
    }
  });
}

function requestVersions (callback) {
  get(LAUNCHERMETA.hostname, LAUNCHERMETA.path, function (data) {callback(JSON.parse(data));});
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
      get(LAUNCHERMETA.hostname, result.url.substr(31), function (data) {
        callback(JSON.parse(data));
      });
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
      let counter = data.libraries.length;
      for (let index = 0 ; index < data.libraries.length ; ++index) {
        downloadLibrary(data.libraries[index], function (library) {
          console.log(library);
          if (--counter === 0) {
	    print('All downloaded');
	  }
          //print(library.name + ' downloaded\n');
        });
      }
    });
    break;
  default:
    requestVersions(function (data) {
      console.log(data);
    });
    break;
}
