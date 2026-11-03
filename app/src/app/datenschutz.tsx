import { LegalPage } from '@/components/LegalPage';
import { privacyPolicy } from '@/content/legal';

export default function Datenschutz() {
  return <LegalPage build={privacyPolicy} />;
}
