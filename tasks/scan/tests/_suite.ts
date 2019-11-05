import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('NeuVectorScan tests', function () {

    before(function () {

    });

    after(() => {

    });

    it('Scan on external NeuVector controller', function (done: MochaDone) {
        this.timeout(20000);

        let tp = path.join(__dirname, 'external-scan.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Scan on local NeuVector controller', function (done: MochaDone) {
        this.timeout(20000);

        let tp = path.join(__dirname, 'local-scan.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
});