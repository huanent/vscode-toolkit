export interface ConfigurationPatch {
    oldString: string;
    newString: string;
}

function compact(text: string) {
    let quoted = false;
    let escaped = false;
    let value = '';
    const offsets: number[] = [];
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted || !/[\t\r\n ]/.test(character)) {
            value += character;
            offsets.push(index);
        }
        if (escaped) escaped = false;
        else if (quoted && character === '\\') escaped = true;
        else if (character === '"') quoted = !quoted;
    }
    return { value, offsets };
}

function uniqueIndex(source: string, search: string): number {
    const index = source.indexOf(search);
    if (index >= 0 && source.indexOf(search, index + 1) >= 0)
        throw new Error('Patch matches multiple locations. Include more context.');
    return index;
}

export function applyConfigurationPatches(text: string, patchs: ConfigurationPatch[]): string {
    if (!Array.isArray(patchs) || !patchs.length) throw new Error('patchs must be a non-empty array.');
    for (const patch of patchs) {
        if (!patch || typeof patch.oldString !== 'string' || !patch.oldString.trim() || typeof patch.newString !== 'string')
            throw new Error('Each patch requires a non-empty oldString and a string newString.');
        let start = uniqueIndex(text, patch.oldString);
        let end = start + patch.oldString.length;
        if (start < 0) {
            const source = compact(text);
            const search = compact(patch.oldString).value;
            const index = uniqueIndex(source.value, search);
            if (index < 0) throw new Error('Patch text was not found. Read the configuration again.');
            start = source.offsets[index];
            end = source.offsets[index + search.length - 1] + 1;
        }
        text = text.slice(0, start) + patch.newString + text.slice(end);
    }
    return text;
}