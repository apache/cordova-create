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

var fs = require('fs');
var path = require('path');

var shell = require('shelljs');
var semver = require('semver');
var requireFresh = require('import-fresh');

var create = require('..');
var helpers = require('./helpers');
var events = require('cordova-common').events;
var ConfigParser = require('cordova-common').ConfigParser;
var CordovaLogger = require('cordova-common').CordovaLogger;

var tmpDir = helpers.tmpDir('create_test');
var appName = 'TestBase';
var appId = 'org.testing';
var project = path.join(tmpDir, appName);

// Disable regular console output during tests
CordovaLogger.get().setLevel(CordovaLogger.ERROR);

// Global configuration paths
var global_config_path = process.env.CORDOVA_HOME;
if (!global_config_path) {
    var HOME = process.env[(process.platform.slice(0, 3) === 'win') ? 'USERPROFILE' : 'HOME'];
    global_config_path = path.join(HOME, '.cordova');
}

var configSubDirPkgJson = {
    lib: {
        www: {
            template: true,
            url: path.join(__dirname, 'templates', 'withsubdirectory_package_json'),
            version: ''
        }
    }
};

var configConfigInWww = {
    lib: {
        www: {
            template: true,
            url: path.join(__dirname, 'templates', 'config_in_www'),
            version: ''
        }
    }
};

var configGit = {
    lib: {
        www: {
            url: 'https://github.com/apache/cordova-app-hello-world',
            template: true,
            version: 'not_versioned'
        }
    }
};

var configNPMold = {
    lib: {
        www: {
            template: true,
            url: 'phonegap-template-vue-f7-tabs@1.0.0',
            version: ''
        }
    }
};

var configNPM = {
    lib: {
        www: {
            template: true,
            url: 'phonegap-template-vue-f7-tabs',
            version: ''
        }
    }
};

describe('cordova create checks for valid-identifier', function () {
    it('should reject reserved words from start of id', function (done) {
        create('projectPath', 'int.bob', 'appName', {}, events)
            .fail(function (err) {
                expect(err.message).toBe('App id contains a reserved word, or is not a valid identifier.');
            })
            .fin(done);
    }, 60000);

    it('should reject reserved words from end of id', function (done) {
        create('projectPath', 'bob.class', 'appName', {}, events)
            .fail(function (err) {
                expect(err.message).toBe('App id contains a reserved word, or is not a valid identifier.');
            })
            .fin(done);
    }, 60000);
});

describe('create end-to-end', function () {

    beforeEach(function () {
        shell.rm('-rf', project);
        shell.mkdir('-p', tmpDir);
    });

    afterEach(function () {
        process.chdir(path.join(__dirname, '..')); // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    function checkProject () {
        // Check if top level dirs exist.
        var dirs = ['hooks', 'platforms', 'plugins', 'www'];
        dirs.forEach(function (d) {
            expect(path.join(project, d)).toExist();
        });

        expect(path.join(project, 'hooks', 'README.md')).toExist();

        // Check if www files exist.
        expect(path.join(project, 'www', 'index.html')).toExist();

        // Check that config.xml was updated.
        var configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.packageName()).toEqual(appId);

        // TODO (kamrik): check somehow that we got the right config.xml from the fixture and not some place else.
        // expect(configXml.name()).toEqual('TestBase');
    }

    function checkConfigXml () {
        // Check if top level dirs exist.
        var dirs = ['hooks', 'platforms', 'plugins', 'www'];
        dirs.forEach(function (d) {
            expect(path.join(project, d)).toExist();
        });
        expect(path.join(project, 'hooks', 'README.md')).toExist();

        // index.js and template subdir folder should not exist (inner files should be copied to the project folder)
        expect(path.join(project, 'index.js')).not.toExist();
        expect(path.join(project, 'template')).not.toExist();

        // Check if www files exist.
        expect(path.join(project, 'www', 'index.html')).toExist();
        var configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.packageName()).toEqual(appId);
        expect(configXml.version()).toEqual('1.0.0');

        // Check that config.xml does not exist inside of www
        expect(path.join(project, 'www', 'config.xml')).not.toExist();

        // Check that we got no package.json
        expect(path.join(project, 'package.json')).not.toExist();

        // Check that we got the right config.xml from the template and not stock
        expect(configXml.description()).toEqual('this is the correct config.xml');
    }

    function checkSubDir () {
        // Check if top level dirs exist.
        var dirs = ['hooks', 'platforms', 'plugins', 'www'];
        dirs.forEach(function (d) {
            expect(path.join(project, d)).toExist();
        });
        expect(path.join(project, 'hooks', 'README.md')).toExist();

        // index.js and template subdir folder should not exist (inner files should be copied to the project folder)
        expect(path.join(project, 'index.js')).not.toExist();
        expect(path.join(project, 'template')).not.toExist();

        // Check if config files exist.
        expect(path.join(project, 'www', 'index.html')).toExist();

        // Check that config.xml was updated.
        var configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.packageName()).toEqual(appId);
        expect(configXml.version()).toEqual('1.0.0');
        // Check that we got package.json (the correct one)
        var pkjson = requireFresh(path.join(project, 'package.json'));
        // Pkjson.displayName should equal config's name.
        expect(pkjson.displayName).toEqual(appName);
        expect(pkjson.valid).toEqual('true');

        // Check that we got the right config.xml
        expect(configXml.description()).toEqual('this is the correct config.xml');
    }

    it('should successfully run without template and use default hello-world app', function (done) {
        // Create a real project with no template
        // use default cordova-app-hello-world app
        return create(project, appId, appName, {}, events)
            .then(checkProject)
            .then(function () {
                var pkgJson = requireFresh(path.join(project, 'package.json'));
                // confirm default hello world app copies over package.json and it matched appId
                expect(pkgJson.name).toEqual(appId);
            }).fail(function (err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 60000);

    it('should successfully run with Git URL', function (done) {
        // Create a real project with gitURL as template
        return create(project, appId, appName, configGit, events)
            .then(checkProject)
            .fail(function (err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 60000);

    it('should successfully run with NPM package and not use old cache of template on second create', function (done) {
        var templatePkgJsonPath = path.join(global_config_path, 'node_modules', 'phonegap-template-vue-f7-tabs', 'package.json');
        // Create a real project with npm module as template
        // tests cache clearing of npm template
        // uses phonegap-template-vue-f7-tabs
        return create(project, appId, appName, configNPMold)
            .then(checkProject)
            .then(function () {
                shell.rm('-rf', project);
                var pkgJson = requireFresh(templatePkgJsonPath);
                expect(pkgJson.version).toBe('1.0.0');
                return create(project, appId, appName, configNPM);
            }).then(function () {
                var pkgJson = requireFresh(templatePkgJsonPath);
                expect(semver.gt(pkgJson.version, '1.0.0')).toBeTruthy();
            }).fail(function (err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 60000);

    it('should successfully run with template not having a package.json at toplevel', function (done) {
        // Call cordova create with no args, should return help.
        var config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'templates', 'nopackage_json'),
                    version: ''
                }
            }
        };
        // Create a real project
        return create(project, appId, appName, config, events)
            .then(checkProject)
            .then(function () {
                // Check that we got the right config.xml
                var configXml = new ConfigParser(path.join(project, 'config.xml'));
                expect(configXml.description()).toEqual('this is the very correct config.xml');
            })
            .fail(function (err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 60000);

    it('should successfully run with template having package.json and no sub directory', function (done) {
        // Call cordova create with no args, should return help.
        var config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'templates', 'withpackage_json'),
                    version: ''
                }
            }
        };
        // Create a real project
        return create(project, appId, appName, config, events)
            .then(checkProject)
            .fail(function (err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 60000);

    it('should successfully run with template having package.json, and subdirectory, and no package.json in subdirectory', function (done) {
        // Call cordova create with no args, should return help.
        var config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'templates', 'withsubdirectory'),
                    version: ''
                }
            }
        };

        // Create a real project
        return create(project, appId, appName, config, events)
            .then(checkProject)
            .fail(function (err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 60000);

    it('should successfully run with template having package.json, and subdirectory, and package.json in subdirectory', function (done) {
        // Call cordova create with no args, should return help.
        var config = configSubDirPkgJson;
        return create(project, appId, appName, config, events)
            .then(checkSubDir)
            .fail(function (err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 60000);

    it('should successfully run config.xml in the www folder and move it outside', function (done) {
        // Call cordova create with no args, should return help.
        var config = configConfigInWww;
        // Create a real project
        return create(project, appId, appName, config, events)
            .then(checkConfigXml)
            .fail(function (err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 60000);

    it('should successfully run with www folder as the template', function (done) {
        var config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'templates', 'config_in_www', 'www'),
                    version: ''
                }
            }
        };
        return create(project, appId, appName, config, events)
            .then(checkConfigXml)
            .fail(function (err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 60000);

    describe('when --link-to is provided', function () {
        it('when passed www folder should not move www/config.xml, only copy and update', function (done) {
            function checkSymWWW () {
                // Check if top level dirs exist.
                var dirs = ['hooks', 'platforms', 'plugins', 'www'];
                dirs.forEach(function (d) {
                    expect(path.join(project, d)).toExist();
                });
                expect(path.join(project, 'hooks', 'README.md')).toExist();

                // Check if www files exist.
                expect(path.join(project, 'www', 'index.html')).toExist();

                // Check www/config exists
                expect(path.join(project, 'www', 'config.xml')).toExist();
                // Check www/config.xml was not updated.
                var configXml = new ConfigParser(path.join(project, 'www', 'config.xml'));
                expect(configXml.packageName()).toEqual('io.cordova.hellocordova');
                expect(configXml.version()).toEqual('0.0.1');
                expect(configXml.description()).toEqual('this is the correct config.xml');

                // Check that config.xml was copied to project/config.xml
                expect(path.join(project, 'config.xml')).toExist();
                configXml = new ConfigParser(path.join(project, 'config.xml'));
                expect(configXml.description()).toEqual('this is the correct config.xml');
                // Check project/config.xml was updated.
                expect(configXml.packageName()).toEqual(appId);
                expect(configXml.version()).toEqual('1.0.0');

                // Check that we got no package.json
                expect(path.join(project, 'package.json')).not.toExist();

                // Check that www is really a symlink,
                // and project/config.xml , hooks and merges are not
                expect(fs.lstatSync(path.join(project, 'www')).isSymbolicLink()).toBe(true);
                expect(fs.lstatSync(path.join(project, 'hooks')).isSymbolicLink()).not.toBe(true);
                expect(fs.lstatSync(path.join(project, 'config.xml')).isSymbolicLink()).not.toBe(true);
            }
            var config = {
                lib: {
                    www: {
                        template: true,
                        url: path.join(__dirname, 'templates', 'config_in_www', 'www'),
                        version: '',
                        link: true
                    }
                }
            };
            return create(project, appId, appName, config, events)
                .then(checkSymWWW)
                .fail(function (err) {
                    if (process.platform.slice(0, 3) === 'win') {
                        // Allow symlink error if not in admin mode
                        expect(err.message).toBe('Symlinks on Windows require Administrator privileges');
                    } else {
                        if (err) {
                            console.log(err.stack);
                        }
                        expect(err).toBeUndefined();
                    }
                })
                .fin(done);
        }, 60000);

        it('with subdirectory should not update symlinked project/config.xml', function (done) {
            function checkSymSubDir () {
                // Check if top level dirs exist.
                var dirs = ['hooks', 'platforms', 'plugins', 'www'];
                dirs.forEach(function (d) {
                    expect(path.join(project, d)).toExist();
                });
                expect(path.join(project, 'hooks', 'README.md')).toExist();

                // index.js and template subdir folder should not exist (inner files should be copied to the project folder)
                expect(path.join(project, 'index.js')).not.toExist();
                expect(path.join(project, 'template')).not.toExist();

                // Check if www files exist.
                expect(path.join(project, 'www', 'index.html')).toExist();

                // Check that www, and config.xml is really a symlink
                expect(fs.lstatSync(path.join(project, 'www')).isSymbolicLink()).toBe(true);
                expect(fs.lstatSync(path.join(project, 'config.xml')).isSymbolicLink()).toBe(true);

                // Check that config.xml was not updated. (symlinked config does not get updated!)
                var configXml = new ConfigParser(path.join(project, 'config.xml'));
                expect(configXml.packageName()).toEqual('io.cordova.hellocordova');
                expect(configXml.version()).toEqual('0.0.1');

                // Check that we got the right config.xml
                expect(configXml.description()).toEqual('this is the correct config.xml');

                // Check that we got package.json (the correct one) and it was changed
                var pkjson = requireFresh(path.join(project, 'package.json'));
                // Pkjson.name should equal config's id.
                expect(pkjson.name).toEqual(appId.toLowerCase());
                expect(pkjson.valid).toEqual('true');
            }
            var config = {
                lib: {
                    www: {
                        template: true,
                        url: path.join(__dirname, 'templates', 'withsubdirectory_package_json'),
                        version: '',
                        link: true
                    }
                }
            };
            return create(project, appId, appName, config, events)
                .then(checkSymSubDir)
                .fail(function (err) {
                    if (process.platform.slice(0, 3) === 'win') {
                        // Allow symlink error if not in admin mode
                        expect(err.message).toBe('Symlinks on Windows require Administrator privileges');
                    } else {
                        if (err) {
                            console.log(err.stack);
                        }
                        expect(err).toBeUndefined();
                    }
                })
                .fin(done);
        }, 60000);

        it('with no config should create one and update it', function (done) {
            function checkSymNoConfig () {
                // Check if top level dirs exist.
                var dirs = ['hooks', 'platforms', 'plugins', 'www'];
                dirs.forEach(function (d) {
                    expect(path.join(project, d)).toExist();
                });
                expect(path.join(project, 'hooks', 'hooks.file')).toExist();
                expect(path.join(project, 'merges', 'merges.file')).toExist();

                // Check if www files exist.
                expect(path.join(project, 'www', 'index.html')).toExist();

                // Check that config.xml was updated.
                var configXml = new ConfigParser(path.join(project, 'config.xml'));
                expect(configXml.packageName()).toEqual(appId);

                // Check that www, hooks, merges are really a symlink; config is not
                expect(fs.lstatSync(path.join(project, 'www')).isSymbolicLink()).toBe(true);
                expect(fs.lstatSync(path.join(project, 'hooks')).isSymbolicLink()).toBe(true);
                expect(fs.lstatSync(path.join(project, 'merges')).isSymbolicLink()).toBe(true);
                expect(fs.lstatSync(path.join(project, 'config.xml')).isSymbolicLink()).not.toBe(true);
            }

            var config = {
                lib: {
                    www: {
                        template: true,
                        url: path.join(__dirname, 'templates', 'noconfig'),
                        version: '',
                        link: true
                    }
                }
            };
            return create(project, appId, appName, config, events)
                .then(checkSymNoConfig)
                .fail(function (err) {
                    if (process.platform.slice(0, 3) === 'win') {
                        // Allow symlink error if not in admin mode
                        expect(err.message).toBe('Symlinks on Windows require Administrator privileges');
                    } else {
                        if (err) {
                            console.log(err.stack);
                        }
                        expect(err).toBeUndefined();
                    }
                })
                .fin(done);
        }, 60000);

    });
});
