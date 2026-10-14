export interface WebviewReadyMessage {
  type: 'ready';
}

export interface WebviewLoadedMessage<TData> {
  type: 'loaded';
  data: TData;
}

export interface WebviewErrorMessage {
  type: 'error';
  message: string;
}

export type WebviewHostMessage<TData> = WebviewLoadedMessage<TData> | WebviewErrorMessage;
