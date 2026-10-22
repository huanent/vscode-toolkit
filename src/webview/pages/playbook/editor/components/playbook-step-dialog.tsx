import { useId, useState } from 'react';
import type { PlaybookStep } from '@/features/playbook/protocol';
import type { AssetSummary } from '@/features/assets/protocol';
import { Dialog } from '@/webview/components/ui/dialog';
import { Form } from '@/webview/components/ui/form';
import { PlaybookStepEditor } from '@/webview/pages/playbook/editor/components/playbook-step-editor';
import { convertStep, isStepComplete } from '@/webview/pages/playbook/editor/step-model';

export function PlaybookStepDialog({
  step,
  index,
  hosts,
  editing,
  onClose,
  onSave,
}: {
  step: PlaybookStep;
  index: number;
  hosts: readonly AssetSummary[];
  editing: boolean;
  onClose: () => void;
  onSave: (step: PlaybookStep) => void;
}) {
  const formId = useId();
  const [draft, setDraft] = useState(step);
  const valid = isStepComplete(draft, hosts);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={editing ? `Edit step ${index + 1}` : 'Add step'}
      form={formId}
      saveDisabled={!valid}
    >
      <Form
        id={formId}
        className="py-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (valid) onSave(draft);
        }}
      >
        <PlaybookStepEditor
          index={index}
          step={draft}
          hosts={hosts}
          onChange={setDraft}
          onTypeChange={(type) =>
            setDraft(convertStep(draft, type, hosts.find((host) => host.type === 'ssh')?.id ?? ''))
          }
        />
      </Form>
    </Dialog>
  );
}
