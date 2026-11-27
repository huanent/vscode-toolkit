import { FormItem } from '@/webview/components/ui/form';
import { Textarea } from '@/webview/components/ui/textarea';

type OtherPanelProps = {
  description: string;
  onDescriptionChange: (description: string) => void;
};

export function OtherPanel({ description, onDescriptionChange }: OtherPanelProps) {
  return (
    <FormItem name="description" label="Description">
      <Textarea rows={3} value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
    </FormItem>
  );
}
