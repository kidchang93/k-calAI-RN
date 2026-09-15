import { AuthGuardStack } from '@/components/auth-guard-stack';

export default function OnboardingLayout() {
  return <AuthGuardStack initialRouteName="consent" />;
}
