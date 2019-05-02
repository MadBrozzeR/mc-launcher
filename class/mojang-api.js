const https = require('https');

const OPTIONS = {
  GET: {
    hostname: 'api.mojang.com',
    method: 'GET'
  },
  POST: {
    hostname: 'api.mojang.com',
    method: 'POST'
  },
  AUTH: {
    hostname: 'authserver.mojang.com',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }
};

function request (options, url, data, callback) {
  https.request({...options, path: url}, function (message) {
    let data = '';
    message.on('data', function (chunk) {
      data += chunk.toString();
    });
    message.on('end', function () {
      callback(message.statusCode, JSON.parse(data));
    });
  }).end(data && (typeof data === 'string' ? data : JSON.stringify(data)));
}

function getUUID (name, timestamp, callback) {
  const url = '/users/profiles/minecraft/' + name + (timestamp ? ('?at=' + timestamp) : '');

  request(OPTIONS.GET, url, undefined,  callback);
}

function getNameHistory (uuid, callback) {
  const url = '/user/profiles/' + uuid + '/names';

  request(OPTIONS.GET, url, undefined, callback);
}

function getUUIDs (nameArray, callback) {
  const url = '/profiles/minecraft';
  request(OPTIONS.POST, url, nameArray, callback);
}

function getProfile (uuid, callback) {
  const url = '/session/minecraft/profile/' + uuid;
  request({
    hostname: 'sessionserver.mojang.com',
    method: 'GET'
  }, url, undefined, callback)
}

function changeSkin (params, callback) {
  request(
    { ...OPTIONS.POST, headers: {Authorization: 'Bearer ' + params.accessToken} },
    '/user/profile/' + params.uuid + '/skin',
    'model=' + (params.slim ? '""' : '"slim"') + '&url=' + encodeURIComponent(params.url),
    callback
  );
}

function authenticate (account, password, callback) {
  request(OPTIONS.AUTH, '/authenticate', {
    agent: {
      name: 'Minecraft',
      version: 1
    },
    username: account,
    password: password
  }, callback);
}

function refreshAuth (accessToken, clientToken, selectedProfile, callback) {
  request(OPTIONS.AUTH, '/refresh', {
    accessToken,
    clientToken,
    selectedProfile
  }, callback);
}

function validateAuth (accessToken, clientToken, callback) {
  request(OPTIONS.AUTH, '/validate', {
    accessToken,
    clientToken
  }, function (status) {
    if (status === 204) {
      callback && callback(status, true);
    } else {
      callback && callback(status, false);
    }
  });
}

function signOut (username, password, callback) {
  request(OPTIONS.AUTH, '/signout', {username, password}, callback);
}

function invalidateAuth (accessToken, clientToken, callback) {
  request(OPTIONS.AUTH, '/invalidate', {accessToken, clientToken}, callback);
}

module.exports = {
  getUUID,
  getNameHistory,
  getUUIDs,
  getProfile,
  authenticate,
  refreshAuth,
  validateAuth,
  signOut,
  invalidateAuth
};
