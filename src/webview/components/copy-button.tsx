import { useEffect, useRef, useState } from 'react';
import { Button, type ButtonProps } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';

interface CopyButtonProps extends Omit<ButtonProps, 'children' | 'prefix' | 'suffix' | 'onClick'> {
  icon?: string;
  title: string;
  copiedTitle?: string;
  onCopy: () => void;
}

export function CopyButton({ icon = 'copy', title, copiedTitle, onCopy, ...props }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const label = copied ? (copiedTitle ?? title) : title;

  return (
    <Button
      variant="ghost"
      {...props}
      size={props.size}
      title={label}
      aria-label={label}
      onClick={() => {
        onCopy();
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
      }}
    >
      <Icon name={copied ? 'check' : icon} size={props.size} />
    </Button>
  );
}
