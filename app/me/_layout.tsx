import { AuthGuardStack } from '@/components/auth-guard-stack';

export default function MeLayout() {
  return <AuthGuardStack />;
}
