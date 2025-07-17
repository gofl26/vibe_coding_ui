import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { Alert, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AuthTab() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  // Expo Router 사용 시
  // import { useRouter } from 'expo-router';
  // const router = useRouter();
  // 또는 React Navigation 사용 시
  // import { useNavigation } from '@react-navigation/native';
  // const navigation = useNavigation();
  // 여기서는 Expo Router 기준으로 작성
  const router = useRouter();

  const handleLogin = async () => {
    if (!id || !pw) {
      if (Platform.OS === 'web') {
        window.alert('ID와 비밀번호를 모두 입력하세요.');
      } else {
        Alert.alert('입력 오류', 'ID와 비밀번호를 모두 입력하세요.');
      }
      return;
    }
    setLoading(true);
    try {
      // 플랫폼에 따라 API 주소 분기
      const apiBaseUrl =
        Platform.OS === 'android' || Platform.OS === 'ios'
          ? 'https://youtube.ssrhouse.store' // 실제 배포 주소, 필요시 로컬 IP로 변경
          : 'https://youtube.ssrhouse.store'; // 웹은 그대로

      const res = await fetch(`${apiBaseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: id, password: pw }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        // 토큰 저장 (웹: localStorage, 앱: SecureStore)
        if (Platform.OS === 'web') {
          window.localStorage.setItem('token', data.token);
        } else {
          try {
            await SecureStore.setItemAsync('token', data.token);
          } catch {
            // SecureStore 저장 실패 시 fallback
          }
        }
        // 검색 탭으로 이동 (탭 구조에 따라 경로 조정)
        if (router) {
          router.replace('/(tabs)/search');
        } else {
          if (Platform.OS === 'web') {
            window.alert('로그인 성공! 검색 탭으로 이동하세요.');
          } else {
            Alert.alert('로그인 성공', '검색 탭으로 이동하세요.');
          }
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(data.error || '로그인에 실패했습니다.');
        } else {
          Alert.alert('로그인 실패', data.error || '로그인에 실패했습니다.');
        }
      }
    } catch {
      if (Platform.OS === 'web') {
        window.alert('서버와 통신 중 오류가 발생했습니다.');
      } else {
        Alert.alert('오류', '서버와 통신 중 오류가 발생했습니다.');
      }
    }
    setLoading(false);
  };

  return (
    <LinearGradient
      colors={['#e0e7ff', '#fff']}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#222', marginBottom: 8 }}>🎵 Vibe Music</Text>
          <Text style={{ fontSize: 18, color: '#666' }}>로그인 후 음악을 즐겨보세요</Text>
        </View>
        <View style={{ width: '100%', maxWidth: 340, backgroundColor: 'white', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }}>
          <TextInput
            placeholder="ID"
            value={id}
            onChangeText={setId}
            style={{ width: '100%', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16, backgroundColor: '#f9fafb' }}
            autoCapitalize="none"
            placeholderTextColor="#aaa"
          />
          <TextInput
            placeholder="Password"
            value={pw}
            onChangeText={setPw}
            style={{ width: '100%', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 14, marginBottom: 24, fontSize: 16, backgroundColor: '#f9fafb' }}
            secureTextEntry
            placeholderTextColor="#aaa"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            style={{ backgroundColor: loading ? '#a5b4fc' : '#6366f1', padding: 16, borderRadius: 8, width: '100%' }}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 }}>{loading ? '로그인 중...' : '로그인'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}
