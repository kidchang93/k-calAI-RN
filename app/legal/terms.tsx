import { LegalDocumentView } from '@/components/legal-document-view';
import { TERMS } from '@/constants/legal';

export default function TermsScreen() {
  return <LegalDocumentView document={TERMS} />;
}
