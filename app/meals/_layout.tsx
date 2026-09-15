import { AuthGuardStack } from '@/components/auth-guard-stack';

export default function MealsLayout() {
  return <AuthGuardStack />;
}
