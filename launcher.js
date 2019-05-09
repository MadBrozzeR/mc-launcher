const MBRZip = require('mbr-zip').MBRZip;
const spawn = require('child_process').spawn;
const mojangApi = require('./class/mojang-api.js');
const FileSaver = require('./class/file-saver.js').FileSaver;
const Fetcher = require('./class/fetcher.js').Fetcher;

const MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';

const ROOT = __dirname;
const LIBRARIES_PATH = ROOT + '/libraries/';
const VERSIONS_PATH = ROOT + '/versions/';
const USERS_PATH = ROOT + '/users/';
const GAME_PATH = ROOT + '/game/';
const ASSETS_PATH = ROOT + '/assets/';

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

const fetcher = new Fetcher(8);

function downloadNatives (nativesPath, library, callback) {
  const name = library.downloads.classifiers['natives-linux'].path;
  let exclude = library.extract && library.extract.exclude;
  exclude = exclude && (new RegExp('^(?:' + exclude.join('|') + ')'));

  fetcher.get('https://libraries.minecraft.net/' + name, function (data) {
    const saver = new FileSaver(nativesPath, function (result) {
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
  const filePath = VERSIONS_PATH + version.id + '/client.jar';

  FileSaver.exists(filePath, function (exists) {
    if (exists) {
      print('Client already exists: ' + version.id + '\n');
    } else {
      fetcher.get(version.downloads.client.url, function (data) {
        FileSaver.save(filePath, data, function (name, error) {
          if (error) {
            print('Failed to download client\n', error);
          } else {
            print('Client downloaded successfully\n');
          }
          callback && callback(name, error);
        });
      });
    }
  });
}

function downloadAssets (assetsIndex, callback) {
  fetcher.get(assetsIndex.url, function (data) {
    const response = JSON.parse(data.toString());
    const saver = new FileSaver(ASSETS_PATH, function (result) {
      callback(result);
    });

    for (let name in response.objects) {
      FileSaver.exists(ASSETS_PATH + name, function (exists) {
        if (exists) {
          print('Asset already exists: ' + name + '\n');
        } else {
          saver.asyncSave(name, function (callback) {
            let path = response.objects[name].hash.substr(0, 2) + '/' + response.objects[name].hash;
            fetcher.get('http://resources.download.minecraft.net/' + path, function (data) {
              print('Downloaded asset ' + name + '\n');
              callback(data);
            });
          });
        }
      });
    }
  });
}

function downloadLibrary (nativesPath, library, callback) {
  const name = library.downloads.artifact.path;
  const path = LIBRARIES_PATH + name;

  const downloaded = {
    library: false,
    natives: false
  };

  function done () {
    if (downloaded.library && downloaded.natives) {
      callback && callback(library);
    }
  }

  FileSaver.exists(path, function (exists) {
    if (exists) {
      print('Library already exists: ' + library.name + '\n');
      downloaded.library = true;
      done();
    } else {
      fetcher.get(library.downloads.artifact.url, function (data) {
        FileSaver.save(path, data, function (name, error) {
          if (error) {
            console.log(error);
          }
          print('Library downloaded: ' + library.name + '\n');
          downloaded.library = true;
          done();
        });
      });
    }
  });

  if (library.downloads.classifiers && library.downloads.classifiers['natives-linux']) {
    downloadNatives(nativesPath, library, function (error) {
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
  Fetcher.fetch(MANIFEST, function (data) {callback(JSON.parse(data));});
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
      Fetcher.fetch(result.url, function (data) {
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
        USERS_PATH + username + '.json',
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

function useTemplate (template, substitutions) {
  return template.replace(/\$\{(\w+)\}/g, function (_, key) {
    return substitutions[key] || '';
  });
}

function getArguments (version, params) {
  const result = [];
  for (let index = 0 ; index < version.arguments.jvm.length ; ++index) {
    let argument = version.arguments.jvm[index];
    if (typeof argument === 'string') {
      result.push(useTemplate(argument, params));
    }
  }
  result.push(version.mainClass);
  return result;
}

function startGame () {
  const dir = VERSIONS_PATH + args.id + '/';

  let localArguments = [
    '-Xmx1G',
    '-XX:+UseConcMarkSweepGC',
    '-XX:+CMSIncrementalMode',
    '-XX:-UseAdaptiveSizePolicy',
    '-Xmn128M'
  ];
  FileSaver.read(dir + 'arguments.json', function (error, data) {
    if (error) {
      print('Failed to read arguments for version ' + args.id + '\n', error);
    } else {
      const versionArguments = JSON.parse(data.toString());

      FileSaver.read(USERS_PATH + args.user + '.json', function (error, data) {
        if (error) {
          print('User ' + args.user + ' is not authenticated\n');
        } else {
          const user = JSON.parse(data.toString());
          localArguments = localArguments.concat(versionArguments, [
            '--accessToken', user.accessToken,
            '--username', user.selectedProfile.name,
            '--uuid', user.selectedProfile.id,
            '--version', args.id,
            '--gameDir', GAME_PATH,
            '--assetsDir', ASSETS_PATH
          ]);
          FileSaver.save(ROOT + '/start.sh', '#!/bin/sh\njava ' + localArguments.join(' '), function (name, error) {
            if (error) {
              print('Failed to create start.sh\n', error);
            } else {
              print('start.sh have been created\n');
            }
          });
        }
      });
    }
  });
}

function configServer (id) {
  versionInfo(id, function (data) {
    print('Downloading server.jar...');
    Fetcher.fetch(data.downloads.server.url, function (data) {
      print(' DONE\n');
      FileSaver.save(VERSIONS_PATH + id + '/server.jar', data, function (name, error) {
        if (error) {
          print('Failed to save server.jar\n', error);
        } else {
          FileSaver.save(
            ROOT + '/server.sh',
            '#!/bin/sh\njava -Xms1G -Xmx4G -jar ' + VERSIONS_PATH + id + '/server.jar nogui',
            function (name, error) {
              if (error) {
                print('Failed to generate server.sh\n', error);
              } else {
                print('server.sh successfully generated\n');
              }
            }
          )
        }
      });
    });
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
      FileSaver.read(ROOT + '/package.json', function (error, packageData) {
        if (error) {
          return;
        }
        const version = JSON.parse(packageData.toString()).version;

        const params = {
          natives_directory: VERSIONS_PATH + data.id + '/natives/',
          launcher_name: 'mc-launcher',
          launcher_version: version,
          classpath: []
        };
        params.classpath.toString = function () {
          return this.join(':');
        }
        downloadClient(data);
        console.log(data);
        for (let index = 0 ; index < data.libraries.length ; ++index) {
          downloadLibrary(params.natives_directory, data.libraries[index]);
          params.classpath.push(LIBRARIES_PATH + data.libraries[index].downloads.artifact.path);
        }
        params.classpath.push(VERSIONS_PATH + data.id + '/client.jar');
        downloadAssets(data.assetIndex, function (result) {
          if (result.hasErrors) {
            print('Failed to save some assets\n');
            console.log(result.errors);
          }
        });
        FileSaver.save(
          VERSIONS_PATH + data.id + '/arguments.json',
          JSON.stringify(getArguments(data, params)),
          function (name, error) {
            if (error) {
              print('Failed to save arguments\n', error);
            } else {
              print('Arguments saved\n');
            }
          }
        );
        fetcher.callback = function () {
          print('All downloaded\n');
        }
      });
    });
    break;
  case 'login':
    authenticate(args.name, args.pass);
    break;
  case 'start':
    startGame();
    break;
  case 'server':
    configServer(args.id);
    break;
  default:
    requestVersions(function (data) {
      console.log(data);
    });
    break;
}
