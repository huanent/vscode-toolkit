import { useEffect, useRef, useState } from 'react';
import { launchdApi as vscode, subscribe } from '../../dashboard/channel';
import type {
	LaunchAgent,
	LaunchAgentConfig,
	LaunchAgentDetails,
	LaunchdExtensionMessage,
} from '../types';
import { blankConfig, cloneConfig, parseEnvironment } from '../utils';

export function useLaunchd() {
	const loadedSelection = useRef<string | undefined>(undefined);
	const [agents, setAgents] = useState<LaunchAgent[]>([]);
	const [selectedFileName, setSelectedFileName] = useState<string>();
	const [draft, setDraft] = useState<LaunchAgentConfig>(() => cloneConfig(blankConfig));
	const [argumentsText, setArgumentsText] = useState('');
	const [environmentText, setEnvironmentText] = useState('');
	const [busy, setBusy] = useState(true);
	const [notice, setNotice] = useState<string>();
	const [error, setError] = useState<string>();
	const [details, setDetails] = useState<LaunchAgentDetails>();
	const [detailsLoading, setDetailsLoading] = useState(false);

	const setEditor = (config: LaunchAgentConfig) => {
		setDraft(cloneConfig(config));
		setArgumentsText(config.programArguments.join('\n'));
		setEnvironmentText(
			Object.entries(config.environmentVariables)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n'),
		);
	};

	useEffect(() => {
		const handleMessage = (event: MessageEvent<LaunchdExtensionMessage>) => {
			if (event.data.type === 'launchdError') {
				setError(event.data.message);
				setBusy(false);
				setDetailsLoading(false);
				return;
			}
			if (event.data.type === 'launchdDetails') {
				setDetails(event.data.details);
				setDetailsLoading(false);
				return;
			}
			if (event.data.type !== 'launchdAgents') return;
			setAgents(event.data.agents);
			setNotice(event.data.message);
			setError(undefined);
			setBusy(false);
		};
		const unsubscribe = subscribe('launchd', handleMessage);
		vscode.postMessage({ type: 'ready' });
		return unsubscribe;
	}, []);

	useEffect(() => {
		if (!selectedFileName) return;
		const selected = agents.find(agent => agent.fileName === selectedFileName);
		if (selected) {
			if (loadedSelection.current !== selectedFileName) setEditor(selected);
			loadedSelection.current = selectedFileName;
		} else {
			setSelectedFileName(undefined);
			setEditor(blankConfig);
		}
	}, [agents, selectedFileName]);

	const clearMessages = () => {
		setNotice(undefined);
		setError(undefined);
	};

	const selectAgent = (agent: LaunchAgent) => {
		loadedSelection.current = agent.fileName;
		setSelectedFileName(agent.fileName);
		setEditor(agent);
		clearMessages();
	};

	const createNew = () => {
		loadedSelection.current = undefined;
		setSelectedFileName(undefined);
		setEditor(blankConfig);
		clearMessages();
	};

	const runAction = (message: object) => {
		setBusy(true);
		clearMessages();
		vscode.postMessage(message);
	};

	const save = () => {
		try {
			const config = {
				...draft,
				programArguments: argumentsText
					.split('\n')
					.map(value => value.trim())
					.filter(Boolean),
				environmentVariables: parseEnvironment(environmentText),
			};
			setSelectedFileName(`${config.label.trim()}.plist`);
			runAction({ type: 'save', config });
		} catch (parseError) {
			setError(parseError instanceof Error ? parseError.message : 'Invalid environment variables.');
		}
	};

	const remove = (agent: LaunchAgent) => {
		if (
			window.confirm(
				`Delete ${agent.label}? This removes ${agent.fileName} from ~/Library/LaunchAgents.`,
			)
		) {
			runAction({ type: 'remove', fileName: agent.fileName, label: agent.label });
		}
	};

	const showDetails = (agent: LaunchAgent) => {
		setDetails(undefined);
		setDetailsLoading(true);
		setError(undefined);
		vscode.postMessage({ type: 'details', label: agent.label });
	};

	const closeDetails = () => {
		setDetails(undefined);
		setDetailsLoading(false);
	};

	const update = <Key extends keyof LaunchAgentConfig>(key: Key, value: LaunchAgentConfig[Key]) =>
		setDraft(current => ({ ...current, [key]: value }));

	return {
		agents,
		selectedFileName,
		draft,
		argumentsText,
		setArgumentsText,
		environmentText,
		setEnvironmentText,
		busy,
		notice,
		error,
		details,
		detailsLoading,
		selectAgent,
		createNew,
		runAction,
		save,
		remove,
		showDetails,
		closeDetails,
		update,
	};
}
