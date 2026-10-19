import type { AssetFormValues } from '@/features/assets/protocol';
import { Checkbox } from '@/webview/components/ui/checkbox';
import { FormItem } from '@/webview/components/ui/form';
import { Input } from '@/webview/components/ui/input';
import { Textarea } from '@/webview/components/ui/textarea';

type GeneralPanelProps = {
  values: AssetFormValues;
  onChange: (values: Partial<AssetFormValues>) => void;
};

export function GeneralPanel({ values, onChange }: GeneralPanelProps) {
  return (
    <>
      <FormItem name="name" label="Name" error="Name is required." match="valueMissing">
        <Input
          aria-label="Name"
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Connection name"
          required
          autoFocus
        />
      </FormItem>
      <FormItem name="enableAI" label="Allow AI tool access">
        <Checkbox checked={values.enableAI} onCheckedChange={(enableAI) => onChange({ enableAI })} />
      </FormItem>
      <FormItem name="description" label="Description">
        <Textarea
          rows={3}
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </FormItem>
    </>
  );
}
