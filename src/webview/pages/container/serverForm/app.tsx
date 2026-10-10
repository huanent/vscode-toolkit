import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ContainerForm } from './containerForm';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<ContainerForm />
	</StrictMode>,
);
