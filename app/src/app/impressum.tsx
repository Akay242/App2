import { LegalPage } from '@/components/LegalPage';
import { imprint } from '@/content/legal';

export default function Impressum() {
  return <LegalPage build={imprint} />;
}
