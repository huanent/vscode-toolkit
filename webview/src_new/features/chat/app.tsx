import { Menu } from '../../components/icons';
import { ChatInput } from './components/chatInput';
import { HistoryPanel } from './components/historyPanel';
import { MessageList } from './components/message/messageList';
import { IconButton } from '../../components/button';
import { useChat } from './hooks/useChat';
import { Popover } from '../../components/popover';

export function App() {
	const chat = useChat();
	return (
		<div className="relative h-full">
			<div className="absolute top-1 left-1 z-20 flex gap-1">
				<Popover
					open={chat.historyVisible}
					onOpenChange={chat.setHistoryVisible}
					label="Chat history"
					className="w-85 overflow-hidden"
					trigger={props => (
						<IconButton {...props} label="Show chat history" icon={<Menu size="sm" />} size="md" />
					)}
				>
					<HistoryPanel
						sessions={chat.sessions}
						currentSessionId={chat.currentSessionId}
						query={chat.historyQuery}
						onQueryChange={chat.setHistoryQuery}
						onClose={() => chat.setHistoryVisible(false)}
						onSelect={chat.selectSession}
						onDelete={chat.deleteSession}
					/>
				</Popover>
			</div>
			<div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto]">
				<MessageList
					messages={chat.messages}
					busy={chat.busy}
					editingIndex={chat.editingIndex}
					onEdit={chat.editMessage}
					onRegenerate={chat.regenerate}
					onRetry={chat.retry}
				/>
				<ChatInput
					inputRef={chat.inputRef}
					input={chat.input}
					busy={chat.busy}
					editingIndex={chat.editingIndex}
					models={chat.models}
					selectedModelId={chat.selectedModelId}
					modelsError={chat.modelsError}
					onInputChange={chat.setInput}
					onSelectModel={chat.selectModel}
					onSend={chat.send}
				/>
			</div>
		</div>
	);
}
