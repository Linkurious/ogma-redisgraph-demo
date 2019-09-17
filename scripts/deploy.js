#!/usr/bin/env node

const fs          = require('fs');
const path        = require('path');
const execSync    = require('child_process').execSync;
const package     = require('../package.json');
const archiveFile = `${package.name}.tar.gz`;
const depPackage  = `server.json`;
const authPackage = `auth.json`;

const argv = require('minimist')(process.argv.slice(2));

if (!argv.server || !argv.port || !argv.user || !argv.path) {
  console.log(`
    Usage:
      - ./scripts/deploy.js --user <SSH_USER> --server <SERVER> --port <SSH_PORT> --path <REMOTE_PATH> --auth <LOGIN>:<PASS>
  `);
  process.exit(0);
}

const SSH_KEY_PATH  = '~/.ssh/id_rsa';
const sshUser = argv.user;
const server = argv.server;
const remotePath = argv.path;
const PORT = argv.port;

delete package.dependencies.ogma;
package.devDependencies = {};

fs.writeFileSync(depPackage, JSON.stringify(package, 0, 2));

const files = [
  depPackage,
  './static',
  './server',
  'start.sh'
];

if (argv.auth) {
  fs.writeFileSync(authPackage, JSON.stringify({
    login: argv.auth.split(':')[0],
    password: argv.auth.split(':')[1]
  }, 0, 2));
  files.push(authPackage);
}

const dest = `${remotePath}ogma-redisgraph`;
const REMOTE_STEPS = [
  // Create the directory that will host the documentation
  `mkdir -p ${dest}`,

  // Go in this directory
  `cd ${dest}`,

  // Extract the tarball here
  `tar xf /tmp/${archiveFile}`,

  // The documentation is in the `build/doc/` folder, and we want it at the root of DEST_DIR
  // We are forced to first rename the `build/` folder to something else, otherwise we have a conflict
  // with the `build` folder which is inside the doc
  `mv ${depPackage} package.json`,

  // install deps
  `./start.sh`
];

process.stdout.write('npm run build...');
execSync('npm run build');
process.stdout.write('done\n');
process.stdout.write(`tar -czf ${archiveFile} ${files.join(' ')}...`);
execSync(`tar -czf ${archiveFile} ${files.join(' ')}`);
fs.unlinkSync(depPackage);

process.stdout.write('done\n');
process.stdout.write(`uploading...`);
// Upload the tarball to the server, in the `/tmp` folder
execSync(`scp -i ${SSH_KEY_PATH} -P ${PORT} ${archiveFile} ${sshUser}@${server}:/tmp`);
process.stdout.write('done\n');
process.stdout.write('unpacking...');
execSync(`ssh -i ${SSH_KEY_PATH} -p ${PORT} ${sshUser}@${server} "${REMOTE_STEPS.join(' && ')}"`);
