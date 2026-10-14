import { Input as BaseInput, type InputProps as BaseInputProps } from '@base-ui/react/input';
import { cn } from 'cn';
import { useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { fieldClassName } from '@/webview/components/surface-styles';

export type InputProps = Omit<BaseInputProps, 'prefix'> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function Input({ className, prefix, suffix, type, ...props }: InputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [searchValue, setSearchValue] = useState(props.defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(props.ref, () => inputRef.current!);
  const isPassword = type === 'password';
  const isSearch = type === 'search';
  const visibilityLabel = passwordVisible ? 'Hide password' : 'Show password';
  const clearButton = isSearch && String(props.value ?? searchValue).length > 0 && !props.readOnly && (
    <Button
      variant="ghost"
      size="sm"
      className="text-(--vscode-descriptionForeground)"
      disabled={props.disabled}
      aria-label={props['aria-label'] ? `Clear ${props['aria-label']}` : 'Clear search'}
      title="Clear search"
      prefix={<Icon name="close" size="sm" />}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        const input = inputRef.current;
        if (!input) return;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }}
    />
  );

  if (isSearch && prefix == null && suffix == null) {
    return (
      <div className="relative min-w-0">
        <BaseInput
          {...props}
          ref={inputRef}
          className={cn(fieldClassName, 'w-full pr-7 [&::-webkit-search-cancel-button]:appearance-none', className)}
          type={type}
          onChange={(event) => {
            setSearchValue(event.target.value);
            props.onChange?.(event);
          }}
        />
        <div className="absolute inset-y-0 right-1 flex items-center">{clearButton}</div>
      </div>
    );
  }

  if (prefix == null && suffix == null && !isPassword) {
    return <BaseInput className={cn(fieldClassName, className)} type={type} {...props} ref={inputRef} />;
  }

  return (
    <div
      className={cn(
        'flex h-6 w-full min-w-0 items-center gap-2 rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 text-(--vscode-input-foreground) focus-within:border-(--vscode-focusBorder) has-aria-invalid:border-(--vscode-inputValidation-errorBorder)',
        props.disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {prefix != null && <div className="inline-flex shrink-0 items-center">{prefix}</div>}
      <BaseInput
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent p-0 placeholder:text-(--vscode-input-placeholderForeground) focus:outline-none disabled:opacity-100',
          isSearch && '[&::-webkit-search-cancel-button]:appearance-none',
          className,
        )}
        {...props}
        ref={inputRef}
        onChange={(event) => {
          if (isSearch) setSearchValue(event.target.value);
          props.onChange?.(event);
        }}
        type={isPassword && passwordVisible ? 'text' : type}
      />
      {clearButton}
      {suffix != null && <div className="inline-flex shrink-0 items-center">{suffix}</div>}
      {isPassword && (
        <Button
          variant="ghost"
          size="sm"
          disabled={props.disabled}
          aria-label={visibilityLabel}
          title={visibilityLabel}
          aria-pressed={passwordVisible}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPasswordVisible((visible) => !visible)}
        >
          <Icon name={passwordVisible ? 'eye-closed' : 'eye'} size="sm" />
        </Button>
      )}
    </div>
  );
}
