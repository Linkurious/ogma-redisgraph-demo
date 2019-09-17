const path = require('path');
const fs = require('fs');
const url = require('url');
const express = require('express');
const serveStatic = require('serve-static');
const minimist = require('minimist');
const basicAuth = require('express-basic-auth');
// patch util.promisify for Node.js <8.x
const util = require('util');
require('util.promisify').shim();

const routes = require('./routes');

const argv = minimist(process.argv.slice(2));

const portHttp = process.env.PORT || 8080;
const app = express();

const authFile = path.join(__dirname, '..', 'auth.json');
if (fs.existsSync(authFile)) {
  const auth = JSON.parse(fs.readFileSync(authFile));
  app.use((req, res, next) => {
    // parse login and password from headers
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = new Buffer(b64auth, 'base64').toString().split(':');

    // Verify login and password are set and correct
    if (!login || !password || login !== auth.login || password !== auth.password) {
      res.set('WWW-Authenticate', 'Basic realm="401"'); // change this
      res.status(401).send('Authentication required.'); // custom message
      return;
    }
    next();
  });
}

app.use(serveStatic(path.join(__dirname, '..', 'static'), {
  fallthrough: true,
  extensions: false, // serve any extension
  dotfiles: 'ignore', // don't serve files starting with a dot
  etag: true, // compute etag headers
  cacheControl: false,
  setHeaders: res => {
    res.setHeader('Cache-Control', 'public, must-revalidate, max-age=90');
  }
}));

routes(app);

fs.writeFileSync(path.join(process.cwd(), '.process'), process.pid);

app.listen(portHttp);
