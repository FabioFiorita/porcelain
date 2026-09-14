import { toast } from '@/components/ui/toast';

/** Copy over HTTPS/localhost and on plain HTTP, where the async API is absent. */
export function copyText(text: string, label: string) {
  const done = () =>
    toast.add({
      title: `Copied ${label}`,
      description: text,
      type: 'success',
    });
  const failed = () =>
    toast.add({
      title: `Could not copy ${label}`,
      description: text,
      type: 'error',
    });

  if (window.isSecureContext && navigator.clipboard != null) {
    navigator.clipboard.writeText(text).then(done, () => {
      if (legacyCopy(text)) done();
      else failed();
    });
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
