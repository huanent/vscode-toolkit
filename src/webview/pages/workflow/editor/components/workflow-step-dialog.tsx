import { useId, useState } from 'react';
import type { WorkflowStep } from '@/features/workflow/protocol';
import type { AssetSummary } from '@/features/assets/protocol';
import { Dialog } from '@/webview/components/ui/dialog';
import { Form } from '@/webview/components/ui/form';
import { WorkflowStepEditor } from '@/webview/pages/workflow/editor/components/workflow-step-editor';
import { convertStep, isStepComplete } from '@/webview/pages/workflow/editor/step-model';

export function WorkflowStepDialog({
  step,
  index,
  hosts,
  editing,
  onClose,
  onSave,
}: {
  step: WorkflowStep;
  index: number;
  hosts: readonly AssetSummary[];
  editing: boolean;
  onClose: () => void;
  onSave: (step: WorkflowStep) => void;
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
        <WorkflowStepEditor
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
