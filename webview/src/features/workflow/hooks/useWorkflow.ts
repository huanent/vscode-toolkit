import { useEffect, useState } from 'react';
import { workflowApi as vscode, subscribe } from '../../dashboard/channel';
import type { Workflow, WorkflowStep } from '../../../../../src/features/workflow/workflow';

type State = {
	locations: Record<string, string>;
	workspaceFolders: { name: string; uri: string }[];
	workflows: Workflow[];
	servers: { id: string; name: string }[];
	cwd: string;
	busy: boolean;
};

export function useWorkflow(editorMode: boolean) {
	const [editRequest, setEditRequest] = useState<{ workflow?: Workflow; id?: string }>();
	const [state, setState] = useState<State>({
		workflows: [],
		servers: [],
		cwd: '',
		busy: false,
		locations: {},
		workspaceFolders: [],
	});
	const [draftLocations, setDraftLocations] = useState<Record<string, string>>({});
	const [draft, setDraft] = useState<Workflow>();
	const [dirty, setDirty] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState('');
	const [activeStep, setActiveStep] = useState(0);
	const [loaded, setLoaded] = useState(false);
	const [nextDraft, setNextDraft] = useState<Workflow>();
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === 'state') {
				setState(message);
				setLoaded(true);
			}
			if (message.type === 'saved') {
				setDraft(message.workflow);
				setDirty(false);
				setPending(false);
			}
			if (message.type === 'error') {
				setError(message.message);
				setPending(false);
			}
			if (message.type === 'deleted')
				setDraft(current => (current?.id === message.id ? undefined : current));
			if (message.type === 'path') {
				setDraft(current =>
					current && current.id === message.draftId
						? {
								...current,
								steps: current.steps.map((step, index) =>
									index === message.index ? { ...step, [message.field]: message.value } : step,
								),
							}
						: current,
				);
				setDirty(true);
			}
		};
		const unsubscribe = subscribe('workflow', receive);
		vscode.postMessage({ type: 'ready' });
		return unsubscribe;
	}, []);
	const locked = state.busy || pending;
	const change = (next: Workflow) => {
		setDraft(next);
		setDirty(true);
		setError('');
	};
	const select = (next: Workflow) => {
		if (!editorMode) {
			vscode.postMessage({ type: 'openEditor', workflow: next });
			return;
		}
		if (dirty) {
			setNextDraft(next);
			return;
		}
		setDraft(structuredClone(next));
		setActiveStep(0);
		setDraftLocations({});
		setDirty(false);
		setError('');
	};
	const newStep = (type: WorkflowStep['type']): WorkflowStep =>
		type === 'command'
			? { type, name: 'Local Command', command: '', cwd: state.cwd }
			: type === 'ssh'
				? { type, name: 'SSH Command', serverId: state.servers[0]?.id ?? '', command: '' }
				: {
						type,
						name: 'SFTP Upload',
						serverId: state.servers[0]?.id ?? '',
						localPath: '',
						remotePath: '',
					};
	const updateStep = (index: number, step: WorkflowStep) =>
		draft &&
		change({
			...draft,
			steps: draft.steps.map((current, position) => (position === index ? step : current)),
		});
	const submit = () => {
		setError('');
		setPending(true);
		vscode.postMessage({
			type: 'save',
			workflow: draft,
			location: draft ? (draftLocations[draft.id] ?? state.locations[draft.id] ?? '') : '',
		});
	};
	useEffect(() => {
		const edit = (event: Event) => setEditRequest((event as CustomEvent).detail);
		window.addEventListener('toolkitEdit', edit);
		return () => window.removeEventListener('toolkitEdit', edit);
	}, []);
	useEffect(() => {
		if (!editRequest || !loaded) return;
		const next = editRequest.workflow ?? state.workflows.find(item => item.id === editRequest.id);
		if (next) select(next);
		else setError('The workflow no longer exists.');
		setEditRequest(undefined);
	}, [editRequest, loaded, state.workflows]);
	useEffect(() => {
		const open = (event: Event) => {
			const detail = (event as CustomEvent).detail;
			const workflow = state.workflows.find(item => item.id === detail.id);
			if (detail.tab === 'workflow' && workflow && !locked) select(workflow);
		};
		window.addEventListener('dashboardOpenItem', open);
		return () => window.removeEventListener('dashboardOpenItem', open);
	}, [state.workflows, dirty, locked]);
	const close = () => {
		if (locked || (dirty && !window.confirm('Discard unsaved changes?'))) return;
		setDraft(undefined);
		setDraftLocations({});
		setDirty(false);
	};
	const discard = () => {
		if (!nextDraft) return;
		setDraft(structuredClone(nextDraft));
		setActiveStep(0);
		setDraftLocations({});
		setNextDraft(undefined);
		setDirty(false);
		setError('');
	};
	const changeLocation = (location: string) => {
		if (!draft) return;
		setDraftLocations(current => ({ ...current, [draft.id]: location }));
		setDirty(true);
	};
	const browse = (field: 'cwd' | 'localPath', index: number) => {
		if (draft) vscode.postMessage({ type: 'browse', field, index, draftId: draft.id });
	};
	return {
		state,
		draft,
		dirty,
		pending,
		error,
		loaded,
		locked,
		nextDraft,
		activeStep,
		setActiveStep,
		change,
		select,
		newStep,
		updateStep,
		submit,
		close,
		discard,
		changeLocation,
		browse,
		location: draft ? (draftLocations[draft.id] ?? state.locations[draft.id] ?? '') : '',
		keepEditing: () => setNextDraft(undefined),
		refresh: () => vscode.postMessage({ type: 'ready' }),
		create: () => select({ id: crypto.randomUUID(), name: 'New Workflow', steps: [] }),
		run: (workflow: Workflow) => vscode.postMessage({ type: 'run', workflow }),
		remove: (id: string) => vscode.postMessage({ type: 'delete', id }),
	};
}

export type WorkflowController = ReturnType<typeof useWorkflow>;
