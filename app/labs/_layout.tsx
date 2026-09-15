import { AuthGuardStack } from '@/components/auth-guard-stack';

export default function LabsLayout() {
  return <AuthGuardStack />;
}
