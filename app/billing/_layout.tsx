import { AuthGuardStack } from '@/components/auth-guard-stack';

export default function BillingLayout() {
  return <AuthGuardStack />;
}
