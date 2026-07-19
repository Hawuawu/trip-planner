import { AppShell } from './components/layout/AppShell';

interface Props {
  onBack: () => void;
}

export default function App({ onBack }: Props) {
  return <AppShell onBack={onBack} />;
}
