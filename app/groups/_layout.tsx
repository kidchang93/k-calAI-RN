import { AuthGuardStack } from '@/components/auth-guard-stack';

export default function GroupsLayout() {
  return <AuthGuardStack initialRouteName="index" />;
}
