
import { Tabs, useRouter, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { Platform } from 'react-native';
import Toast from 'react-native-root-toast';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';


export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [checked, setChecked] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    async function getToken() {
      if (Platform.OS === 'web') {
        return window.localStorage.getItem('token');
      } else {
        try {
          return await SecureStore.getItemAsync('token');
        } catch {
          return null;
        }
      }
    }
    async function removeToken() {
      if (Platform.OS === 'web') {
        window.localStorage.removeItem('token');
      } else {
        try {
          await SecureStore.deleteItemAsync('token');
        } catch {}
      }
    }
    async function validateToken(token: string) {
      try {
        const res = await fetch('https://youtube.ssrhouse.store/api/validate', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('invalid');
        const data = await res.json();
        if (!data.valid) throw new Error('invalid');
        return true;
      } catch {
        await removeToken();
        return false;
      }
    }
    async function checkAuth() {
      const token = await getToken();
      setIsLoggedIn(!!token);
      const current = segments[1];
      // 루트(/) 진입 시 /auth로 강제 이동
      if (!current) {
        router.replace('/auth');
        setChecked(false);
        return;
      }
      // 1. search 또는 playlist 진입 시 토큰 없거나 유효하지 않으면 auth로 이동
      if (current === 'search' || current === 'playlist') {
        if (!token) {
          setTimeout(() => {
            if (Platform.OS === 'web') {
              window.alert('로그인 후 이용 가능합니다.');
            } else {
              Toast.show('로그인 후 이용 가능합니다.', { duration: Toast.durations.SHORT });
            }
            router.replace('/auth');
          }, 0);
          setChecked(false);
          return;
        } else {
          // 토큰 유효성 검사
          const valid = await validateToken(token);
          if (!valid) {
            setTimeout(() => {
              if (Platform.OS === 'web') {
                window.alert('세션이 만료되었습니다. 다시 로그인하세요.');
              } else {
                Toast.show('세션이 만료되었습니다. 다시 로그인하세요.', { duration: Toast.durations.SHORT });
              }
              router.replace('/auth');
            }, 0);
            setChecked(false);
            setIsLoggedIn(false);
          } else {
            setChecked(true);
            setIsLoggedIn(true);
          }
          return;
        }
      }
      // 2. auth 진입 시 토큰 있으면 search로 이동 (유효성 검사 포함)
      if (current === 'auth') {
        if (token) {
          const valid = await validateToken(token);
          if (valid) {
            setTimeout(() => {
              if (Platform.OS === 'web') {
                window.alert('이미 로그인되어 있습니다.');
              } else {
                Toast.show('이미 로그인되어 있습니다.', { duration: Toast.durations.SHORT });
              }
              router.replace('/search');
            }, 0);
            setChecked(true); // 렌더링 허용, 반복 방지
            setIsLoggedIn(true);
            return;
          } else {
            setChecked(true);
            setIsLoggedIn(false);
          }
          return;
        } else {
          setIsLoggedIn(false);
        }
      }
      setChecked(true);
    }
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);
  if (!checked) return null;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          height: 80,
          paddingBottom: 24,
        },
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}>
        <Tabs.Screen
          name="auth"
          options={{
            title: isLoggedIn ? '로그아웃' : '로그인',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name={isLoggedIn ? "rectangle.portrait.and.arrow.right" : "person.crop.circle"} color={color} />,
            tabBarButton: (props) => {
              // 로그아웃 버튼 동작
              if (isLoggedIn) {
                return (
                  <HapticTab
                    {...props}
                    onPress={async () => {
                      // 토큰 삭제
                      if (Platform.OS === 'web') {
                        window.localStorage.removeItem('token');
                      } else {
                        try {
                          await SecureStore.deleteItemAsync('token');
                        } catch {}
                      }
                      Toast.show('로그아웃 되었습니다.', { duration: Toast.durations.SHORT });
                      router.replace('/auth');
                      setIsLoggedIn(false);
                    }}
                  />
                );
              } else {
                // 기본 로그인 버튼 동작
                return <HapticTab {...props} />;
              }
            },
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: '검색',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
          }}
        />
        <Tabs.Screen
          name="playlist"
          options={{
            title: '플레이리스트',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="music.note.list" color={color} />,
          }}
        />
      </Tabs>
  );
}
