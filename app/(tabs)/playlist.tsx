import MusicPlayerBar from '@/components/MusicPlayerBar';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, Text, TouchableOpacity, View } from 'react-native';

function durationToSeconds(iso: string) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  const hours = h ? parseInt(h) : 0;
  const minutes = m ? parseInt(m) : 0;
  const seconds = s ? parseInt(s) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}
// 초 -> mm:ss
function secondsToMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function decodeHtmlEntities(str: string) {
  if (str === null || str === undefined) return '';
  return str.replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&#39;/g, "'");
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
  return Array.isArray(data.playlists) ? data.playlists : [];
}

export default function PlaylistTab() {
  // ...existing code...
  // 음악 재생 관련 상태
  const [playingSong, setPlayingSong] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  // 마지막 재생한 플레이리스트 상태 추가
  const [lastPlayedPlaylist, setLastPlayedPlaylist] = useState<any | null>(null);
  // 삭제 모드 및 선택 곡 상태 추가
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      setLoading(true);
      setError(null);
      (async () => {
        try {
          const list = await fetchPlaylists();
          if (isActive) setPlaylists(list);
        } catch {
          if (isActive) setError('플레이리스트를 불러올 수 없습니다.');
        }
        if (isActive) setLoading(false);
      })();
      return () => {
        isActive = false;
        setPlayingSong(null);
        setIsPlaying(false);
        setAudioUrl(null);
        setLastPlayedPlaylist(null);
      };
    }, [])
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 24, backgroundColor: '#f3f4f6' }}>
      {/* 플레이리스트 목록/상세 */}
      {!selectedPlaylist ? (
        <>
          <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 18 }}>플레이리스트</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
          ) : error ? (
            <Text style={{ color: 'red', marginTop: 40 }}>{error}</Text>
          ) : playlists.length === 0 ? (
            <Text style={{ color: '#888', marginTop: 40 }}>플레이리스트가 없습니다.</Text>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={pl => String(pl.id)}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => setSelectedPlaylist(item)}>
                  <View style={{ backgroundColor: 'white', borderRadius: 14, marginBottom: 18, padding: 18, width: 340, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>{item.name}</Text>
                      {/* 총 재생시간 */}
                      <Text style={{ fontSize: 13, color: '#888', marginLeft: 8 }}>
                        {item.items && item.items.length > 0
                          ? `총 ${secondsToMMSS(item.items.reduce((acc: number, cur: any) => acc + durationToSeconds(cur.duration || ''), 0))}`
                          : ''}
                      </Text>
                    </View>
                    {item.items && item.items.length > 0 ? (
                      <FlatList
                        data={item.items}
                        keyExtractor={it => it.video_id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        renderItem={({ item: song }) => (
                          <View style={{ marginRight: 12, alignItems: 'center' }}>
                            <Image source={{ uri: song.thumbnail }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' }} />
                            <Text style={{ fontSize: 13, color: '#222', marginTop: 4, maxWidth: 64 }} numberOfLines={1} ellipsizeMode="tail">{decodeHtmlEntities(song.title)}</Text>
                          </View>
                        )}
                      />
                    ) : (
                      <Text style={{ color: '#aaa', fontSize: 14 }}>곡이 없습니다.</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 340, marginBottom: 18 }}>
            {/* 좌측 상단: 뒤로가기 버튼 */}
            <TouchableOpacity onPress={() => setSelectedPlaylist(null)} style={{ padding: 6, marginRight: 8 }}>
              <Text style={{ fontSize: 34, color: '#6366f1', fontWeight: 'bold' }}>←</Text>
            </TouchableOpacity>
            {/* 우측 상단: 플레이리스트 이름 */}
            <Text style={{ fontSize: 22, fontWeight: 'bold', flex: 1, textAlign: 'right' }}>{selectedPlaylist.name}</Text>
          </View>
          {selectedPlaylist.items && selectedPlaylist.items.length > 0 ? (
            <>
              {/* 삭제 모드 상태 및 선택 곡 관리 */}
              {typeof window !== 'undefined' && window.localStorage ? null : null}
              {/* 삭제 모드 토글 및 삭제하기 버튼 */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 10, width: 340 }}>
                {!deleteMode ? (
                  <TouchableOpacity
                    style={{ paddingHorizontal: 4, paddingVertical: 2 }}
                    onPress={() => {
                      setDeleteMode(true);
                      setSelectedSongs([]);
                    }}
                  >
                    <Text style={{ color: '#6366f1', fontWeight: 'bold', fontSize: 14 }}>목록 삭제</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={{ backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 }}
                      onPress={() => setDeleteMode(false)}
                    >
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: selectedSongs.length > 0 ? '#a5b4fc' : '#e5e7eb', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}
                      disabled={selectedSongs.length === 0}
                      onPress={async () => {
                        let token: string | null = null;
                        if (Platform.OS === 'web') {
                          token = window.localStorage.getItem('token');
                        } else {
                          token = await SecureStore.getItemAsync('token');
                        }
                        try {
                          const res = await fetch('https://youtube.ssrhouse.store/api/playList/item', {
                            method: 'DELETE',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify({
                              playlistId: selectedPlaylist.id,
                              videoIds: selectedSongs,
                            }),
                          });
                          if (res.ok) {
                            // 삭제 성공 시 목록 새로고침
                            const updated = selectedPlaylist.items.filter((s: any) => !selectedSongs.includes(s.video_id));
                            setSelectedPlaylist({ ...selectedPlaylist, items: updated });
                            setDeleteMode(false);
                            setSelectedSongs([]);
                          } else {
                            alert('삭제에 실패했습니다.');
                          }
                        } catch {
                          alert('삭제에 실패했습니다.');
                        }
                      }}
                    >
                      <Text style={{ color: selectedSongs.length > 0 ? '#6366f1' : '#888', fontWeight: 'bold', fontSize: 15 }}>삭제하기</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              {/* 곡 목록 렌더링 (삭제 모드일 때 체크박스 표시) */}
              <FlatList
                data={selectedPlaylist.items}
                keyExtractor={it => it.video_id}
                style={{ marginBottom: 80 }}
                renderItem={({ item: song }) => (
                  <TouchableOpacity
                    onPress={async () => {
                      if (deleteMode) {
                        setSelectedSongs(prev =>
                          prev.includes(song.video_id)
                            ? prev.filter(id => id !== song.video_id)
                            : [...prev, song.video_id]
                        );
                        return;
                      }
                      setPlayingSong(song);
                      setIsPlaying(true);
                      let token: string | null = null;
                      if (Platform.OS === 'web') {
                        token = window.localStorage.getItem('token');
                      } else {
                        token = await SecureStore.getItemAsync('token');
                      }
                      const playUrl = `https://youtube.ssrhouse.store/api/play?id=${song.video_id}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
                      setAudioUrl(playUrl);
                      setLastPlayedPlaylist(selectedPlaylist);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 14,
                      backgroundColor: playingSong?.video_id === song.video_id ? '#e0e7ff' : 'white',
                      borderRadius: 10,
                      padding: 10,
                      width: 340,
                      shadowColor: '#000',
                      shadowOpacity: 0.04,
                      shadowRadius: 4,
                      elevation: 1,
                    }}
                  >
                    {deleteMode && (
                      <View style={{ marginRight: 10 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#6366f1', backgroundColor: selectedSongs.includes(song.video_id) ? '#6366f1' : 'white', justifyContent: 'center', alignItems: 'center' }}>
                          {selectedSongs.includes(song.video_id) && (
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>✓</Text>
                          )}
                        </View>
                      </View>
                    )}
                    <Image source={{ uri: song.thumbnail }} style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: '#eee', marginRight: 14 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, color: playingSong?.video_id === song.video_id ? '#6366f1' : '#222', fontWeight: 'bold' }} numberOfLines={1} ellipsizeMode="tail">
                        {decodeHtmlEntities(song.title)}
                        {playingSong?.video_id === song.video_id ? ' ▶' : ''}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{song.channel_title || ''} {song.duration ? `· ${secondsToMMSS(durationToSeconds(song.duration))}` : ''}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <Text style={{ color: '#aaa', fontSize: 15 }}>곡이 없습니다.</Text>
          )}
        </View>
      )}
      {/* 항상 하단에 MusicPlayerBar 조건부 렌더링 */}
      {audioUrl && playingSong && lastPlayedPlaylist && (
        <MusicPlayerBar
          playingSong={playingSong}
          audioUrl={audioUrl}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          selectedPlaylist={lastPlayedPlaylist}
          isShuffle={isShuffle}
          setIsShuffle={setIsShuffle}
          setPlayingSong={setPlayingSong}
          setAudioUrl={setAudioUrl}
          durationToSeconds={durationToSeconds}
          secondsToMMSS={secondsToMMSS}
          onEnd={() => {
            (async () => {
              if (!lastPlayedPlaylist || !lastPlayedPlaylist.items) return;
              const items = lastPlayedPlaylist.items;
              const idx = items.findIndex((it: any) => it.video_id === playingSong.video_id);
              let token: string | null = null;
              if (Platform.OS === 'web') {
                token = window.localStorage.getItem('token');
              } else {
                token = await SecureStore.getItemAsync('token');
              }
              const getPlayUrl = (videoId: string) => `https://youtube.ssrhouse.store/api/play?id=${videoId}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
              let nextSong = null;
              if (isShuffle) {
                const remain = items.filter((s: any) => s.video_id !== playingSong.video_id);
                if (remain.length > 0) {
                  nextSong = remain[Math.floor(Math.random() * remain.length)];
                }
              } else {
                if (idx < items.length - 1) {
                  nextSong = items[idx + 1];
                }
              }
              if (nextSong) {
                setPlayingSong(nextSong);
                if (Platform.OS === 'web') {
                  try {
                    const res = await fetch(getPlayUrl(nextSong.video_id));
                    if (res.ok) {
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      setAudioUrl(url);
                    } else {
                      setAudioUrl(null);
                    }
                  } catch {
                    setAudioUrl(null);
                  }
                } else {
                  setAudioUrl(getPlayUrl(nextSong.video_id));
                }
                setIsPlaying(true);
              } else {
                setIsPlaying(false);
              }
            })();
          }}
        />
      )}
    </View>
  );
}
