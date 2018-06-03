/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

const fs = require('fs-extra');

var path = require('path');

var tmp = require('tmp');
var isUrl = require('is-url');
var isObject = require('isobject');
var pathIsInside = require('path-is-inside');
var requireFresh = require('import-fresh');
var validateIdentifier = require('valid-identifier');

var fetch = require('cordova-fetch');
var CordovaError = require('cordova-common').CordovaError;
var ConfigParser = require('cordova-common').ConfigParser;

const DEFAULT_VERSION = '1.0.0';

module.exports = cordovaCreateLegacyAdapter;

/**
* Legacy interface. See README for documentation
*/
function cordovaCreateLegacyAdapter (dir, id, name, cfg, extEvents) {
    // Unwrap and shallow-clone that nasty nested config object
    const opts = Object.assign({}, ((cfg || {}).lib || {}).www);

    if (id) opts.id = id;
    if (name) opts.name = name;
    if (extEvents) opts.events = extEvents;

    return cordovaCreate(dir, opts);
}

/**
 * Creates a new cordova project in the given directory.
 *
 * @param {string} dest         directory where the project will be created.
 * @param {Object} [opts={}]    options to be used for creating the project.
 * @returns {Promise}           Resolves when project creation has finished.
 */
function cordovaCreate (dest, opts = {}) {
    let emit;
    // TODO this is to avoid having a huge diff. Remove later.
    let dir = dest;

    return Promise.resolve().then(function () {
        if (!dir) {
            throw new CordovaError('Directory not specified. See `cordova help`.');
        }

        if (!isObject(opts)) {
            throw new CordovaError('Given options must be an object');
        }

        // Shallow copy opts
        opts = Object.assign({}, opts);

        emit = getEventEmitter(opts);
        emit('verbose', 'Using detached cordova-create');

        // Make absolute.
        dir = path.resolve(dir);

        if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
            throw new CordovaError('Path already exists and is not empty: ' + dir);
        }

        if (opts.id && !validateIdentifier(opts.id)) {
            throw new CordovaError('App id contains a reserved word, or is not a valid identifier.');
        }

        // This was changed from "uri" to "url", but checking uri for backwards compatibility.
        opts.url = opts.url || opts.uri;

        if (!opts.url) {
            opts.url = require.resolve('cordova-app-hello-world');
            opts.template = true;
        }

        // Ensure that the destination is outside the template location
        if (pathIsInside(dir, opts.url)) {
            throw new CordovaError(
                `Cannot create project "${dir}" inside the template used to create it "${opts.url}".`
            );
        }
    })
        .then(function () {
            // Finally, Ready to start!
            emit('log', 'Creating a new cordova project.');

            // Use cordova-fetch to obtain npm or git templates
            if (opts.template && isRemoteUri(opts.url)) {
                var target = opts.url;
                emit('verbose', 'Using cordova-fetch for ' + target);
                return fetch(target, getSelfDestructingTempDir(), {});
            } else {
                // If assets are not online, resolve as a relative path on local computer
                return path.resolve(opts.url);
            }
        })
        .then(function (templatePath) {
            var import_from_path;

            try {
                import_from_path = requireFresh(templatePath).dirname;
            } catch (e) {
                throw new CordovaError(templatePath + ' is not a valid template');
            }

            if (!fs.existsSync(import_from_path)) {
                throw new CordovaError('Could not find directory: ' +
                    import_from_path);
            }

            var dirAlreadyExisted = fs.existsSync(dir);
            if (!dirAlreadyExisted) {
                fs.mkdirSync(dir);
            }

            try {
                // Copy files from template to project
                if (opts.template) {
                    emit('verbose', 'Copying assets.');
                    fs.copySync(import_from_path, dir);
                }

                // If following were not copied from template, copy from stock app hello world
                // TODO: get stock package.json if template does not contain package.json;
                copyIfNotExists(stockAssetPath('www'), path.join(dir, 'www'));
                copyIfNotExists(stockAssetPath('hooks'), path.join(dir, 'hooks'));
                copyIfNotExists(stockAssetPath('config.xml'), path.join(dir, 'config.xml'));
            } catch (e) {
                if (!dirAlreadyExisted) {
                    fs.removeSync(dir);
                }
                throw e;
            }

            var pkgjsonPath = path.join(dir, 'package.json');
            // Update package.json name and version fields
            if (fs.existsSync(pkgjsonPath)) {
                var pkgjson = requireFresh(pkgjsonPath);

                // Pkjson.displayName should equal config's name.
                if (opts.name) {
                    pkgjson.displayName = opts.name;
                }
                // Pkjson.name should equal config's id.
                if (opts.id) {
                    pkgjson.name = opts.id.toLowerCase();
                } else {
                    // Use default name.
                    pkgjson.name = 'helloworld';
                }

                pkgjson.version = DEFAULT_VERSION;
                fs.writeFileSync(pkgjsonPath, JSON.stringify(pkgjson, null, 4), 'utf8');
            }

            // Create basic project structure.
            fs.ensureDirSync(path.join(dir, 'platforms'));
            fs.ensureDirSync(path.join(dir, 'plugins'));

            // Write out id, name and default version to config.xml
            var configPath = path.join(dir, 'config.xml');
            var conf = new ConfigParser(configPath);
            if (opts.id) conf.setPackageName(opts.id);
            if (opts.name) conf.setName(opts.name);
            conf.setVersion(DEFAULT_VERSION);
            conf.write();
        });
}

function getEventEmitter ({ events }) {
    return events
        ? (...args) => events.emit(...args)
        : () => {};
}

/**
 * Recursively copies folder to destination if folder is not found in destination (including symlinks).
 * @param  {string} src for copying
 * @param  {string} dst for copying
 * @return No return value
 */
function copyIfNotExists (src, dst) {
    if (!fs.existsSync(dst) && src) {
        fs.copySync(src, dst);
    }
}

function stockAssetPath (p) {
    return path.join(require('cordova-app-hello-world').dirname, p);
}

// Creates temp dir that is deleted on process exit
function getSelfDestructingTempDir () {
    return tmp.dirSync({
        prefix: 'cordova-create-',
        unsafeCleanup: true
    }).name;
}

function isRemoteUri (uri) {
    return isUrl(uri) || uri.includes('@') || !fs.existsSync(uri);
}
