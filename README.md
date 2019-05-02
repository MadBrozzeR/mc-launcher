# mc-launcher

JavaScript based (NodeJS) Minecraft launcher. Currently only Linux systems are supported.

## Preparation
### List versions

List all Minecraft versions.

```
node launcher.js list [--count=N] [--snaps]
```

*--count* - output only N last versions.
*--snaps* - output development versions as well.

### Assemble minecraft version

Download all dependencies required by given Minecraft version

```
node launcher.js make --id=VERSION
```

*--id* - selected Minecraft version.

### Authenticate user

Authenticate user on current computer.

```
node launcher.js login --name=ACCOUNT --pass=PASSWORD
```

*--name* - user account name.
*--pass* - user password.

### Generate launch script

Generate start.sh at root directory.

```
node launcher.js start --id=VERSION --user=USERNAME
```

*--id* - selected minecraft version.
*--user* - start as selected user.

## Start game

After all preparation have been done we can simply launch `./start.sh` script.
