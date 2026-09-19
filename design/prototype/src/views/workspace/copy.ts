import { toast } from '@/components/ui/toast';

/**
 * The async clipboard API only exists in a secure context (https or
 * localhost). Porcelain is also reached over plain http on a LAN or tailnet,
 * so fall back to a hidden textarea there. Either way the reviewer gets a toast,
 * showing the text unless it is too long for one (`description`).
 */
export function copyText(
  text: string,
  label: string,
  description: string = text,
) {
  const done = () =>
    toast.add({ title: `Copied ${label}`, description, type: 'success' });
  const failed = () =>
    toast.add({ title: `Could not copy ${label}`, description, type: 'error' });

  if (window.isSecureContext && navigator.clipboard != null) {
    navigator.clipboard
      .writeText(text)
      .then(done, () => (legacyCopy(text) ? done() : failed()));
    return;
  }
  if (legacyCopy(text)) done();
  else failed();
}

function legacyCopy(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
