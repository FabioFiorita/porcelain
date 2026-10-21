import { Alert } from 'react-native';
export function showAlertDialog(input: {
  title: string;
  description: string;
  action: string;
  onConfirm: () => void;
}) {
  Alert.alert(
    input.title,
    input.description,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: input.action, style: 'destructive', onPress: input.onConfirm },
    ],
    { cancelable: false },
  );
}
