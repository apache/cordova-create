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

const fs = require('node:fs');
const rewire = require('rewire');
const path = require('node:path');
const requireFresh = require('import-fresh');
const create = require('..');
const { CordovaError, ConfigParser } = require('cordova-common');
const { tmpDir, createWith, createWithMockFetch, expectRejection } = require('./helpers');

const appName = 'TestBase';
const appId = 'org.testing';
const appVersion = '1.0.0';
const project = path.join(tmpDir, appName);

let opts;

beforeEach(() => {
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });
    opts = { name: appName, id: appId };
});
afterAll(() => {
    process.chdir(path.join(__dirname, '..')); // Needed to rm the dir on Windows.
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('cordova create checks for valid-identifier', () => {
    const error = new CordovaError('is not a valid identifier');

    it('should reject reserved words from start of id', () => {
        opts.id = 'int.bob';
        return expectRejection(create(project, opts), error);
    });

    it('should reject reserved words from end of id', () => {
        opts.id = 'bob.class';
        return expectRejection(create(project, opts), error);
    });
});

describe('create end-to-end', () => {
    function checkCommonArtifacts () {
        // Check that www dir exist
        expect(path.join(project, 'www')).toExist();

        // Check that index.html exists inside of www
        expect(path.join(project, 'www', 'index.html')).toExist();

        // Check that www files don't get copied to the top level
        expect(path.join(project, 'index.html')).not.toExist();

        // index.js and template subdir folder should not exist in top level
        // (inner files should be copied to the project top level folder)
        expect(path.join(project, 'index.js')).not.toExist();
        expect(path.join(project, 'template')).not.toExist();

        // Check that config.xml does not exist inside of www
        expect(path.join(project, 'www', 'config.xml')).not.toExist();

        // Check that config.xml was updated correctly
        const configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.packageName()).toEqual(appId);
        expect(configXml.name()).toEqual(appName);
    }

    // Check that we got package.json and it was updated correctly
    function checkPackageJson () {
        const pkg = requireFresh(path.join(project, 'package.json'));
        expect(pkg.name).toEqual(appId);
        expect(pkg.displayName).toEqual(appName);
    }

    // Check that we got no package.json
    function checkNoPackageJson () {
        expect(path.join(project, 'package.json')).not.toExist();
    }

    // Check that we did use the default template
    function checkDefaultTemplate () {
        const pkg = requireFresh(path.join(project, 'package.json'));
        expect(pkg.author).toEqual('Apache Cordova Team');
        expect(pkg.version).toEqual(appVersion);

        const configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.author()).toEqual('Apache Cordova Team');
        expect(configXml.version()).toEqual(appVersion);
    }

    // Check that we did not use the default template
    function checkNotDefaultTemplate () {
        const configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.author()).not.toEqual('Apache Cordova Team');
        expect(configXml.version()).toEqual('0.0.1');
    }

    function checkProjectCreatedWithDefaultTemplate () {
        checkCommonArtifacts();
        checkPackageJson();
        checkDefaultTemplate();
    }

    it('should successfully run without template and use default hello-world app', () => {
        // Create a real project with no template
        // use default cordova-app-hello-world app
        return create(project, opts)
            .then(checkProjectCreatedWithDefaultTemplate);
    });

    it('should successfully run with Git URL', () => {
        // Create a real project with git URL as template
        opts.template = 'https://github.com/apache/cordova-app-hello-world';
        return createWithMockFetch(project, opts)
            .then(fetchSpy => {
                expect(fetchSpy).toHaveBeenCalledTimes(1);
                expect(fetchSpy.calls.argsFor(0)[0]).toBe(opts.template);
            })
            .then(checkProjectCreatedWithDefaultTemplate);
    });

    it('should successfully run with NPM package (specific version)', () => {
        // Create a real project with npm module as template
        opts.template = 'phonegap-template-vue-f7-tabs@1';
        return createWithMockFetch(project, opts)
            .then(fetchSpy => {
                expect(fetchSpy).toHaveBeenCalledTimes(1);
                expect(fetchSpy.calls.argsFor(0)[0]).toBe(opts.template);
            })
            .then(checkProjectCreatedWithDefaultTemplate);
    });

    it('should successfully run with NPM package (no specific version)', () => {
        // Create a real project with npm module as template
        opts.template = 'phonegap-template-vue-f7-tabs';
        return createWithMockFetch(project, opts)
            .then(fetchSpy => {
                expect(fetchSpy).toHaveBeenCalledTimes(1);
                expect(fetchSpy.calls.argsFor(0)[0]).toBe(opts.template);
            })
            .then(checkProjectCreatedWithDefaultTemplate);
    });

    it('should successfully run with local template having no package.json in template dir', () => {
        opts.template = path.join(__dirname, 'templates', 'withsubdirectory');
        return create(project, opts)
            .then(checkCommonArtifacts)
            .then(checkNoPackageJson)
            .then(checkNotDefaultTemplate);
    });

    it('should successfully run with local template having package.json in template dir', () => {
        opts.template = path.join(__dirname, 'templates', 'withsubdirectory_package_json');
        return create(project, opts)
            .then(checkCommonArtifacts)
            .then(checkPackageJson)
            .then(checkNotDefaultTemplate);
    });

    it('should successfully run with existing, empty destination', () => {
        fs.mkdirSync(project, { recursive: true });
        return create(project, opts)
            .then(checkProjectCreatedWithDefaultTemplate);
    });

    it('should rename all gitignore files in template to .gitignore', () => {
        const baseTemplatePkg = path.join(__dirname, 'templates', 'withsubdirectory');
        const templatePkg = path.join(tmpDir, 'gitignore-template');
        fs.cpSync(baseTemplatePkg, templatePkg, { recursive: true });

        // Setup a few gitignore files that should be renamed (or not)
        const templateDir = path.join(templatePkg, 'template');
        fs.mkdirSync(path.join(templateDir, 'www'), { recursive: true });
        fs.writeFileSync(path.join(templateDir, 'gitignore'), '', 'utf8');
        fs.writeFileSync(path.join(templateDir, 'www', 'gitignore'), '', 'utf8');
        fs.mkdirSync(path.join(templateDir, 'foo', 'gitignore'), { recursive: true });

        opts.template = templatePkg;
        return create(project, opts).then(() => {
            // Renames gitignore at template root
            expect(path.join(project, 'gitignore')).not.toExist();
            expect(path.join(project, '.gitignore')).toExist();

            // Renames gitignores in sub-directories
            expect(path.join(project, 'www', 'gitignore')).not.toExist();
            expect(path.join(project, 'www', '.gitignore')).toExist();

            // Does not rename directories with name gitignore
            expect(path.join(project, 'foo', 'gitignore')).toExist();
            expect(path.join(project, 'foo', '.gitignore')).not.toExist();
        });
    });
});

describe('when shit happens', () => {
    it('should fail when dir is missing', () => {
        return expectRejection(
            create(null, opts),
            new CordovaError('Directory not specified')
        );
    });

    it('should fail when dir already exists', () => {
        return expectRejection(
            create(__dirname, opts),
            new CordovaError('Path already exists and is not empty')
        );
    });

    it('should fail when destination is inside template', () => {
        opts.template = path.join(tmpDir, 'template');
        return expectRejection(
            create(path.join(opts.template, 'destination'), opts),
            new CordovaError('inside the template')
        );
    });

    it('should fail when fetch fails', () => {
        const fetchError = new Error('Fetch fail');
        const failingFetch = jasmine.createSpy('failingFetch')
            .and.callFake(() => Promise.reject(fetchError));

        opts.template = 'http://localhost:12345/cordova-create';
        return expectRejection(
            createWith({ fetch: failingFetch })(project, opts),
            fetchError
        );
    });

    // FIXME: we need to improve isRemote to make this different from the test above
    xit('should fail when template does not exist', () => {
        opts.template = path.join(__dirname, 'doesnotexist');
        return expectRejection(
            create(project, opts),
            new CordovaError('not a valid template')
        );
    });
});

describe('cordova create needsToBeFetched', () => {
    let needsToBeFetched;

    beforeEach(() => {
        needsToBeFetched = rewire('..').__get__('needsToBeFetched');
    });

    it('should recognize URLs as remote', () => {
        expect(needsToBeFetched('https://example.com/pkg/foo')).toBe(true);
    });

    it('should recognize package@version as remote', () => {
        expect(needsToBeFetched('foo@1')).toBe(true);
    });

    it('should not detect paths as remote only because they include an @', () => {
        expect(needsToBeFetched('../foo@1')).toBe(false);
    });
});
