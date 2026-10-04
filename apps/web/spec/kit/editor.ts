type Editor = {
  press: (key: string) => Promise<void>;
  pressSequentially: (text: string) => Promise<void>;
};

export async function replaceEditorContent(editor: Editor, text: string) {
  await editor.press('ControlOrMeta+a');
  await editor.pressSequentially(text);
}
