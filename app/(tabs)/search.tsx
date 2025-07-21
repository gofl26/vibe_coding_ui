// ISO 8601 -> mm:ss 변환
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import React, { useState } from 'react';
import { FlatList, Image, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-root-toast';
function parseDuration(iso: string) {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    const [, h, m, s] = match;
    const hours = h ? parseInt(h) : 0;
    const minutes = m ? parseInt(m) : 0;
    const seconds = s ? parseInt(s) : 0;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

// 서버에서 검색 결과를 받아오는 함수
async function fetchSongs(page: number, pageSize: number, query: string): Promise<SongResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), query });
  let token: string | null = null;
  if (Platform.OS === 'web') {
    token = window.localStorage.getItem('token');
  } else {
    token = await SecureStore.getItemAsync('token');
  }
  const res = await fetch(`https://youtube.ssrhouse.store/api/search?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return { items: [], totalResults: 0 };
  return await res.json();
}
async function fetchPlaylists() {
  let token: string | null = null;
  if (Platform.OS === 'web') {
    token = window.localStorage.getItem('token');
  } else {
    token = await SecureStore.getItemAsync('token');
  }
  const res = await fetch('https://youtube.ssrhouse.store/api/playList', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return [];
  const data = await res.json();
  // playlists: [{ id, name, items: [...] }]
  return Array.isArray(data.playlists) ? data.playlists : [];
}
type IdType = {
  kind: string;
  videoId: string;
}
type Snippet = {
  channelId: string;
  channelTitle: string;
  description: string;
  liveBroadcastContent: string;
  publishedAt: string;
  publishTime: string;
  title: string;
  thumbnails: {
    default: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
    high: { url: string; width: number; height: number };
  };
}
type Song = {
  id: IdType;
  etag: string;
  kind: string;
  snippet: Snippet;
  duration?: string;
};
type SongResponse = {
  items: Song[];
  nextPageToken?: string;
  totalResults: number;
  hasMore?: boolean;
}

export default function SearchScreen() {
  // 토큰 가져오기 (localStorage)
  async function getToken() {
    if (Platform.OS === 'web') {
      return window.localStorage.getItem('token');
    } else {
      return await SecureStore.getItemAsync('token');
    }
  }

  // 플레이리스트에 음악 추가
  async function addToPlaylist(playlistId: number, item: { videoId: string; title: string; thumbnail: string }) {
    const token = await getToken();
    const res = await fetch('https://youtube.ssrhouse.store/api/playList', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        id: playlistId,
        items: [
          {
            ...item,
            channelTitle: selectedSong?.snippet.channelTitle || '',
          },
        ],
      }),
    });
    return await res.json();
  }
  // 플레이리스트 생성
  async function createPlaylist(name: string) {
    const token = await getToken();
    const res = await fetch('https://youtube.ssrhouse.store/api/playList', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ name, items: [] }),
    });
    return await res.json();
  }
  // 오디오 재생 상태 관리
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [page, setPage] = useState(1);
  const [songs, setSongs] = useState<Song[]>(() => []);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // 플레이리스트 모달 관련 상태
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlists, setPlaylists] = useState<{ id: number; name: string }[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  // 생성 입력창 상태
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // 검색 실행
  const handleSearch = async () => {
    setPage(1);
    setLoading(true);
    const result = await fetchSongs(1, 10, query);
    setSongs(result.items);
    setHasMore(!!result.hasMore);
    setSelectedSong(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setLoading(false);
  };

  // 무한스크롤 로딩
  const loadMore = async () => {
    if (loading || !hasMore || !query) return;
    setLoading(true);
    const nextPage = page + 1;
    const more = await fetchSongs(nextPage, 10, query);
    setSongs(prev => [...prev, ...more.items]);
    setPage(nextPage);
    setHasMore(!!more.hasMore);
    setLoading(false);
  };

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  function decodeHtmlEntities(str: string) {
    if (str === null || str === undefined) return '';
    return str.replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&#39;/g, "'")
  }
  // 다른 탭 이동 시 음악 재생 중지
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setAudioUrl(null);
        setIsPlaying(false);
      };
    }, [])
  );

  return (
    <LinearGradient colors={['#e0e7ff', '#fff']} style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 420, backgroundColor: 'white', borderRadius: 16, padding: 24, marginTop: 40, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, flex: 1, height: 48 }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <TextInput
                placeholder="노래와 아티스트 검색"
                value={query}
                onChangeText={setQuery}
                style={{
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 16,
                  backgroundColor: '#f9fafb',
                  marginRight: 8,
                  height: 48,
                  minWidth: 0,
                }}
                placeholderTextColor="#aaa"
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity
              onPress={handleSearch}
              style={{
                backgroundColor: '#6366f1',
                borderRadius: 8,
                paddingHorizontal: 18,
                justifyContent: 'center',
                alignItems: 'center',
                height: 48,
                flexShrink: 0,
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>검색</Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          style={{ width: '100%', maxWidth: 420, flexGrow: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.85)', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1, paddingHorizontal: 0, marginBottom: 24 }}
          contentContainerStyle={{ paddingBottom: 24, borderRadius: 14 }}
          data={songs}
          keyExtractor={(item, index) => `${item.id.videoId}_${index}`}
          renderItem={({ item, index }) => (
            <View>
              <TouchableOpacity
                onPress={() => {
                  if (selectedSong?.id.videoId === item.id.videoId && !item.id.videoId) {
                    setSelectedSong(null);
                    setAudioUrl(null);
                    setIsPlaying(false);
                  } else {
                    setSelectedSong(item);
                    setAudioUrl(null);
                    setIsPlaying(false);
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 20,
                  paddingHorizontal: 12,
                  borderBottomWidth: 1,
                  borderColor: '#eee',
                  backgroundColor: selectedSong?.id.videoId === item.id.videoId ? '#e0e7ff' : 'transparent',
                  borderTopLeftRadius: item.id === songs[0]?.id ? 14 : 0,
                  borderTopRightRadius: item.id === songs[0]?.id ? 14 : 0,
                  borderBottomLeftRadius: item.id === songs[songs.length-1]?.id ? 14 : 0,
                  borderBottomRightRadius: item.id === songs[songs.length-1]?.id ? 14 : 0,
                }}
              >
                <View style={{ width: '30%', justifyContent: 'center', alignItems: 'center' }}>
                  <Image
                    source={{ uri: item.snippet.thumbnails.default.url }}
                    style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: '#eee' }}
                    resizeMode="cover"
                  />
                </View>
                <View style={{ width: '30%', justifyContent: 'center' }}>
                  {/* 웹 환경에서만 툴팁 제공 */}
                  {Platform.OS === 'web' ? (
                    <div style={{ position: 'relative', width: '100%' }}>
                      <span
                        style={{
                          fontSize: 17,
                          fontWeight: 'bold',
                          color: '#222',
                          maxWidth: '100%',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                          cursor: 'pointer',
                        }}
                        title={typeof item.snippet.title === 'string' ? decodeHtmlEntities(item.snippet.title) : ''}
                      >
                        {decodeHtmlEntities(item.snippet.title)}
                      </span>
                      {/* duration */}
                      <span style={{ fontSize: 13, color: '#888', marginTop: 2, display: 'block' }}>
                        {item.duration ? `재생시간: ${parseDuration(item.duration)}` : ''}
                      </span>
                    </div>
                  ) : (
                    <View>
                      <Text
                        style={{ fontSize: 17, fontWeight: 'bold', color: '#222', maxWidth: '100%' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {decodeHtmlEntities(item.snippet.title)}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                        {item.duration ? `재생시간: ${parseDuration(item.duration)}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ width: '20%', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15 }}>{item.snippet.channelTitle}</Text>
                </View>
                <View style={{ width: '20%', justifyContent: 'center', alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 13, color: '#666' }}>{formatDate(item.snippet.publishedAt)}</Text>
                </View>
              </TouchableOpacity>
              {selectedSong?.id.videoId === item.id.videoId && (
                <View style={{ width: '100%', backgroundColor: '#f3f4f6', padding: 16, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
                    {/* 썸네일 영역 */}
                    <View style={{ width: '50%', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedSong?.snippet?.thumbnails && selectedSong.snippet.thumbnails.default && (
                        <Image
                          source={{ uri: selectedSong.snippet.thumbnails.default.url }}
                          style={{
                            width: selectedSong.snippet.thumbnails.default.width,
                            height: selectedSong.snippet.thumbnails.default.height,
                            maxWidth: '100%',
                            maxHeight: '100%',
                            borderRadius: 12,
                            backgroundColor: '#eee',
                            objectFit: 'contain',
                          }}
                          resizeMode="contain"
                        />
                     )}
                    </View>
                    {/* 타이틀 및 버튼 영역 */}
                    <View style={{ width: '50%', justifyContent: 'flex-start' }}>
                      {/* 타이틀 + duration */}
                      {Platform.OS === 'web' ? (
                        <div style={{ position: 'relative', width: '100%', height: 36 }}>
                          <span
                            style={{
                              fontSize: 20,
                              fontWeight: 'bold',
                              color: '#222',
                              maxWidth: '100%',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: 'block',
                              height: 36,
                              lineHeight: '36px',
                              cursor: 'pointer',
                            }}
                            title={typeof selectedSong?.snippet?.title === 'string' ? decodeHtmlEntities(selectedSong?.snippet?.title) : ''}
                          >
                            {decodeHtmlEntities(selectedSong?.snippet?.title)}
                          </span>
                        </div>
                      ) : (
                        <View>
                          <Text
                            style={{ fontSize: 20, fontWeight: 'bold', color: '#222', maxWidth: '100%', height: 36 }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {decodeHtmlEntities(selectedSong?.snippet?.title)}
                          </Text>
                        </View>
                      )}
                      {/* 버튼 영역 */}
                      <View style={{ flexDirection: 'row', marginTop: 8, width: '100%' }}>
                        <TouchableOpacity
                          style={{
                            backgroundColor: '#6366f1',
                            borderRadius: 6,
                            paddingVertical: 6,
                            paddingHorizontal: 8,
                            flex: 1,
                            marginRight: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 0,
                          }}
                          onPress={async () => {
                            setPlaylistLoading(true);
                            setShowPlaylistModal(true);
                            setPlaylistError(null);
                            setShowCreateInput(false);
                            try {
                              const list = await fetchPlaylists();
                              setPlaylists(list);
                            } catch {
                              setPlaylistError('플레이리스트 목록을 불러올 수 없습니다.');
                            }
                            setPlaylistLoading(false);
                          }}
                        >
                          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15, textAlign: 'center' }}>플레이리스트에 등록</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            backgroundColor: '#007AFF',
                            borderRadius: 6,
                            paddingVertical: 6,
                            paddingHorizontal: 8,
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 0,
                          }}
                          onPress={async () => {
                            let token: string | null = null;
                            if (Platform.OS === 'web') {
                              token = window.localStorage.getItem('token');
                            } else {
                              token = await SecureStore.getItemAsync('token');
                            }
                            const playUrl = `https://youtube.ssrhouse.store/api/play?id=${selectedSong?.id?.videoId}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
                            setAudioUrl(playUrl);
                            setIsPlaying(true);
                          }}
                        >
                          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15, textAlign: 'center' }}>재생</Text>
                        </TouchableOpacity>
                      </View>
                      {/* 채널명, 업로드일, 재생시간 */}
                      <Text style={{ fontSize: 15, color: '#666', marginTop: 8 }}>{selectedSong?.snippet?.channelTitle}</Text>
                      <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>업로드: {formatDate(selectedSong?.snippet?.publishedAt)}</Text>
                      <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                        {selectedSong?.duration ? `재생시간: ${parseDuration(selectedSong.duration)}` : ''}
                      </Text>
                    </View>
                  </View>
                  {/* 음악 재생 UI */}
                  {Platform.OS === 'web' ? (
                    audioUrl && (
                      <div style={{ width: '100%', marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                        <audio
                          src={audioUrl}
                          controls
                          autoPlay={isPlaying}
                          style={{ width: '100%' }}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                        />
                      </div>
                    )
                  ) : (
                    audioUrl && (
                      <View style={{ width: '100%', marginTop: 16, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#888', fontSize: 15 }}>앱에서는 오디오 재생 기능을 지원하지 않습니다.</Text>
                      </View>
                    )
                  )}
                {/* 플레이리스트 선택 모달 */}
                {showPlaylistModal && (
                  <View style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
                    <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, minWidth: 260, maxWidth: 320, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 }}>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>플레이리스트 선택</Text>
                      {playlistLoading ? (
                        <Text style={{ color: '#888', marginBottom: 12 }}>불러오는 중...</Text>
                      ) : playlistError ? (
                        <Text style={{ color: 'red', marginBottom: 12 }}>{playlistError}</Text>
                      ) : (
                        <>
                          {playlists.length === 0 ? (
                            <Text style={{ color: '#888', marginBottom: 12 }}>플레이리스트가 없습니다.</Text>
                          ) : (
                            playlists.map(pl => (
                              <TouchableOpacity
                                key={pl.id}
                                style={{ paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#eee' }}
                                onPress={async () => {
                                  if (!selectedSong) return;
                                  setPlaylistLoading(true);
                                  setPlaylistError(null);
                                  try {
                                    // 플레이리스트 등록 성공 시
                                    await addToPlaylist(pl.id, {
                                      videoId: selectedSong.id.videoId,
                                      title: typeof selectedSong.snippet.title === 'string' ? decodeHtmlEntities(selectedSong.snippet.title) : '',
                                      thumbnail: selectedSong.snippet.thumbnails.default.url,
                                    });
                                    setShowPlaylistModal(false);
                                    if (Platform.OS === 'web') {
                                      window.alert(`'${pl.name}'에 저장되었습니다.`);
                                    } else {
                                      Toast.show(`'${pl.name}'에 저장되었습니다.`, { duration: Toast.durations.SHORT });
                                    }
                                  } catch {
                                    setPlaylistError('저장에 실패했습니다.');
                                  }
                                  setPlaylistLoading(false);
                                }}
                              >
                                <Text style={{ fontSize: 16 }}>{pl.name}</Text>
                              </TouchableOpacity>
                            ))
                          )}
                          {/* 생성 입력창: 항상 하단에 노출 */}
                          {showCreateInput ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                              <TextInput
                                style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, fontSize: 15, backgroundColor: '#f9fafb', marginRight: 8 }}
                                placeholder="새 플레이리스트 이름"
                                value={newPlaylistName}
                                onChangeText={setNewPlaylistName}
                              />
                              <TouchableOpacity
                                style={{ backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
                                onPress={async () => {
                                  if (!newPlaylistName.trim()) {
                                    alert('플레이리스트 이름을 입력하세요.');
                                    return;
                                  }
                                  try {
                                    await createPlaylist(newPlaylistName.trim());
                                    // 목록 새로고침
                                    setPlaylistLoading(true);
                                    setPlaylistError(null);
                                    setNewPlaylistName('');
                                    setShowCreateInput(false);
                                    const list = await fetchPlaylists();
                                    setPlaylists(list);
                                  } catch (err) {
                                    alert('플레이리스트 생성에 실패했습니다.');
                                  }
                                  setPlaylistLoading(false);
                                }}
                              >
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>생성</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={{ marginTop: 16, alignSelf: 'center', backgroundColor: '#e5e7eb', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
                              onPress={() => setShowCreateInput(true)}
                            >
                              <Text style={{ fontSize: 28, color: '#6366f1', fontWeight: 'bold' }}>+</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                      <TouchableOpacity style={{ marginTop: 16, alignSelf: 'flex-end' }} onPress={() => setShowPlaylistModal(false)}>
                        <Text style={{ color: '#6366f1', fontWeight: 'bold', fontSize: 15 }}>닫기</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>검색 결과가 없습니다.</Text>}
          onEndReached={loadMore}
          onEndReachedThreshold={0.7}
          refreshing={loading}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </LinearGradient>
  );
}
