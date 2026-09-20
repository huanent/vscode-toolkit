import { describe, expect, it } from 'vitest';
import { applyConfigurationPatches } from './patch';

describe('configuration string patches', () => {
    it('tolerates indentation, spaces, tabs and CRLF outside strings', () => {
        const source = '{\r\n\t"name" : "Example",\r\n\t"steps": []\r\n}';
        const result = applyConfigurationPatches(source, [{
            oldString: '"name":"Example",\n"steps":[]', newString: '"name": "Updated", "steps": []',
        }]);
        expect(JSON.parse(result)).toEqual({ name: 'Updated', steps: [] });
    });

    it('preserves whitespace and escapes inside JSON strings', () => {
        const source = JSON.stringify({ command: 'echo  "hello"\nnext' }, undefined, 2);
        expect(() => applyConfigurationPatches(source, [{
            oldString: JSON.stringify('echo "hello"\nnext'), newString: '"changed"',
        }])).toThrow('not found');
        expect(JSON.parse(applyConfigurationPatches(source, [{
            oldString: '"command":' + JSON.stringify('echo  "hello"\nnext'), newString: '"command":"changed"',
        }]))).toEqual({ command: 'changed' });
    });

    it('rejects ambiguous exact and whitespace-tolerant matches', () => {
        for (const source of ['{"a":1,"a":1}', '{"a": 1,"a" : 1}']) {
            expect(() => applyConfigurationPatches(source, [{ oldString: '"a":1', newString: '"a":2' }])).toThrow('multiple');
        }
    });

    it('applies patches sequentially and rejects empty searches', () => {
        expect(applyConfigurationPatches('"first"', [
            { oldString: 'first', newString: 'second' }, { oldString: 'second', newString: 'third' },
        ])).toBe('"third"');
        expect(() => applyConfigurationPatches('{}', [{ oldString: '  ', newString: '' }])).toThrow('non-empty');
    });
});