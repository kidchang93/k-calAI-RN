import { LegalDocumentView } from '@/components/legal-document-view';
import { PRIVACY_POLICY } from '@/constants/legal';

export default function PrivacyPolicyScreen() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}
