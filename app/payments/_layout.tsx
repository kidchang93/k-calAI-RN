import { AuthGuardStack } from '@/components/auth-guard-stack';

export default function PaymentsLayout() {
  return <AuthGuardStack initialRouteName="index" />;
}
