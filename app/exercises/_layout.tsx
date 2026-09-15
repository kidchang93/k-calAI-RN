import { AuthGuardStack } from '@/components/auth-guard-stack';

export default function ExercisesLayout() {
  return <AuthGuardStack />;
}
