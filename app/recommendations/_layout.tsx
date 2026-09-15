import { AuthGuardStack } from '@/components/auth-guard-stack';

export default function RecommendationsLayout() {
  return <AuthGuardStack initialRouteName="index" />;
}
