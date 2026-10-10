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
        if (quoted || !/\s/.test(character)) {
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

function findPatchRange(text: string, oldString: string): [number, number] {
    const exactStart = uniqueIndex(text, oldString);
    if (exactStart >= 0) return [exactStart, exactStart + oldString.length];

    const source = compact(text);
    const search = compact(oldString).value;
    const compactStart = uniqueIndex(source.value, search);
    if (compactStart < 0) throw new Error('Patch text was not found. Read the configuration again.');
    return [
        source.offsets[compactStart],
        source.offsets[compactStart + search.length - 1] + 1,
    ];
}

export function applyConfigurationPatches(text: string, patches: ConfigurationPatch[]): string {
    if (!Array.isArray(patches) || !patches.length) throw new Error('patches must be a non-empty array.');
    for (const patch of patches) {
        if (!patch || typeof patch.oldString !== 'string' || !patch.oldString.trim() || typeof patch.newString !== 'string')
            throw new Error('Each patch requires a non-empty oldString and a string newString.');
        const [start, end] = findPatchRange(text, patch.oldString);
        text = text.slice(0, start) + patch.newString + text.slice(end);
    }
    return text;
}