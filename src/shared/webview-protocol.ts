export interface WebviewReadyMessage {
  type: 'ready';
}

export interface WebviewLoadedMessage<TData> {
  type: 'loaded';
  data: TData;
}

export interface WebviewLoadFailedMessage {
  type: 'loadFailed';
}

export type WebviewHostMessage<TData> = WebviewLoadedMessage<TData> | WebviewLoadFailedMessage;
