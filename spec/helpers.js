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
const os = require('node:os');
const path = require('node:path');
const rewire = require('rewire');

// Temporary directory to use for all tests
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cordova-create-tests-'));

// Returns a version of create with its local scope rewired
const create = rewire('..');

function createWith (rewiring) {
    return (...args) => create.__with__(rewiring)(() => create(...args));
}

// Calls create with mocked fetch to not depend on the outside world
function createWithMockFetch (dir, id, name, cfg, events) {
    const mockFetchDest = path.join(tmpDir, 'mockFetchDest');
    const templateDir = path.dirname(require.resolve('cordova-app-hello-world'));
    const fetchSpy = jasmine.createSpy('fetchSpy')
        .and.callFake(() => Promise.resolve(mockFetchDest));

    fs.cpSync(templateDir, mockFetchDest, { recursive: true });
    return createWith({ fetch: fetchSpy })(dir, id, name, cfg, events)
        .then(() => fetchSpy);
}

// Expect promise to get rejected with a reason matching expectedReason
function expectRejection (promise, expectedReason) {
    return promise.then(
        () => fail('Expected promise to be rejected'),
        reason => {
            if (expectedReason instanceof Error) {
                expect(reason instanceof expectedReason.constructor).toBeTruthy();
                expect(reason.message).toContain(expectedReason.message);
            } else if (typeof expectedReason === 'function') {
                expect(expectedReason(reason)).toBeTruthy();
            } else if (expectedReason !== undefined) {
                expect(reason).toBe(expectedReason);
            } else {
                expect().nothing();
            }
        });
}

module.exports = {
    tmpDir,
    createWith,
    createWithMockFetch,
    expectRejection
};

// Add the toExist matcher.
beforeEach(() => {
    jasmine.addMatchers({
        toExist: function () {
            return {
                compare: function (testPath) {
                    const result = {};
                    result.pass = fs.existsSync(testPath);

                    if (result.pass) {
                        result.message = 'Expected file ' + testPath + ' to not exist.';
                    } else {
                        result.message = 'Expected file ' + testPath + ' to exist.';
                    }

                    return result;
                }
            };
        }
    });
});
