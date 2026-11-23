import { notifyCopy, type CopyTarget } from '@/shared/views/notify';

export function copyText(text: string, target: CopyTarget) {
  const done = () => notifyCopy(target, true);
  const failed = () => notifyCopy(target, false);

  if (
    window.isSecureContext &&
    navigator.clipboard !== null &&
    navigator.clipboard !== undefined
  ) {
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
