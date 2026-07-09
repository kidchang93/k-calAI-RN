import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clearAuthSession } from '@/services/auth-session';

export default function AccountScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>내 정보</Text>
            <Text style={styles.subtitle}>프로필과 목표는 다음 단계에서 제공합니다.</Text>
          </View>

          <View style={styles.placeholderCard}>
            <MaterialIcons color="#b0b8c1" name="person-outline" size={40} />
            <Text style={styles.placeholderTitle}>준비 중입니다</Text>
            <Text style={styles.placeholderText}>
              신체 정보·목표 수정 화면을 다음 단계에서 제공합니다.
            </Text>
          </View>

          <View style={styles.section}>
            <Link href="/explore" asChild>
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <MaterialIcons color="#4e5968" name="build" size={20} />
                <Text style={styles.rowLabel}>개발자 정보</Text>
                <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
              </Pressable>
            </Link>

            <Pressable
              onPress={clearAuthSession}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <MaterialIcons color="#e5484d" name="logout" size={20} />
              <Text style={styles.logoutLabel}>로그아웃</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  header: {
    gap: 4,
  },
  logoutLabel: {
    color: '#e5484d',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  placeholderCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 32,
  },
  placeholderText: {
    color: '#6b7684',
    fontSize: 14,
    textAlign: 'center',
  },
  placeholderTitle: {
    color: '#191f28',
    fontSize: 19,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  rowLabel: {
    color: '#191f28',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    gap: 10,
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
});
