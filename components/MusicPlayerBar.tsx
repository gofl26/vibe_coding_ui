import { Audio, AVPlaybackStatus } from 'expo-av';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { Image, Platform, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

function decodeHtmlEntities(str: string) {
  if (str === null || str === undefined) return '';
  return str.replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&#39;/g, "'")
}

interface Song {
  video_id: string;
  title: string;
  thumbnail: string;
  channel_title?: string;
  duration?: string;
}

interface Playlist {
  items: Song[];
}

interface Props {
  playingSong: Song | null;
  audioUrl: string | null;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  selectedPlaylist: Playlist | null;
  isShuffle: boolean;
  setIsShuffle: (v: boolean | ((s: boolean) => boolean)) => void;
  setPlayingSong: (song: Song) => void;
  setAudioUrl: (url: string) => void;
  durationToSeconds: (iso: string) => number;
  secondsToMMSS: (sec: number) => string;
  onEnd?: () => void;
}

const MusicPlayerBar: React.FC<Props> = ({
  playingSong,
  audioUrl,
  isPlaying,
  setIsPlaying,
  selectedPlaylist,
  isShuffle,
  setIsShuffle,
  setPlayingSong,
  setAudioUrl,
  durationToSeconds,
  secondsToMMSS,
  onEnd,
}) => {
  const soundRef = React.useRef<Audio.Sound | null>(null);

  // 앱에서 오디오 재생
  React.useEffect(() => {
    if (Platform.OS !== 'web' && audioUrl) {
      (async () => {
        if (soundRef.current) {
          console.log('[expo-av] 기존 사운드 언로드');
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        try {
          console.log('[expo-av] Audio.Sound.createAsync 호출', audioUrl);
          const { sound } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: true },
            (status: AVPlaybackStatus) => {
              console.log('[expo-av] status 콜백', status);
              if ('didJustFinish' in status && status.didJustFinish && onEnd) onEnd();
              if ('isPlaying' in status) setIsPlaying(status.isPlaying ?? false);
            }
          );
          soundRef.current = sound;
          console.log('[expo-av] soundRef.current 할당 완료');
        } catch (err) {
          console.log('[expo-av] Audio.Sound.createAsync 에러', err);
        }
      })();
    }
    return () => {
      if (soundRef.current) {
        console.log('[expo-av] 언마운트 시 사운드 언로드');
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [audioUrl, onEnd, setIsPlaying]);

  if (!audioUrl || !playingSong) return null;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, zIndex: 99 }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <Image source={{ uri: playingSong.thumbnail }} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#eee', marginRight: 16 }} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#222' }} numberOfLines={1} ellipsizeMode="tail">{decodeHtmlEntities(playingSong.title)}</Text>
          <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
            {playingSong.channel_title || ''}
            {playingSong.duration ? ` · ${secondsToMMSS(durationToSeconds(playingSong.duration))}` : ''}
          </Text>
          {Platform.OS === 'web' && audioUrl && (
            <div style={{ width: '100%', marginTop: 8, display: 'flex', justifyContent: 'center' }}>
              <audio
                key={audioUrl}
                src={audioUrl}
                controls
                autoPlay={true}
                style={{ width: '100%' }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={onEnd}
              />
            </div>
          )}
          {/* 앱에서는 expo-av로 오디오가 실제로 재생됨. 아래에 재생/일시정지 버튼 추가 */}
          {Platform.OS !== 'web' && audioUrl && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <TouchableOpacity
                onPress={async () => {
                  if (soundRef.current) {
                    if (isPlaying) {
                      await soundRef.current.pauseAsync();
                    } else {
                      await soundRef.current.playAsync();
                    }
                  }
                }}
                style={{ marginRight: 12, padding: 8, borderRadius: 8, backgroundColor: '#e0e7ff' }}
              >
                <Icon name={isPlaying ? 'pause' : 'play-arrow'} size={28} color={'#6366f1'} />
              </TouchableOpacity>
              <Text style={{ color: '#6366f1', fontSize: 13 }}>{isPlaying ? '재생 중' : '일시정지'}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
          <TouchableOpacity
            onPress={async () => {
              if (!selectedPlaylist || !playingSong) return;
              const items = selectedPlaylist.items;
              const idx = items.findIndex((s) => s.video_id === playingSong.video_id);
              let nextSong = null;
              if (isShuffle) {
                const remain = items.filter((s) => s.video_id !== playingSong.video_id);
                if (remain.length > 0) {
                  nextSong = remain[Math.floor(Math.random() * remain.length)];
                }
              } else if (idx > 0) {
                nextSong = items[idx - 1];
              }
              if (nextSong) {
                setPlayingSong(nextSong);
                const playUrl = `https://youtube.ssrhouse.store/api/play?id=${nextSong.video_id}`;
                if (Platform.OS === 'web') {
                  setAudioUrl(playUrl);
                } else {
                  const token = await SecureStore.getItemAsync('token');
                  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
                  console.log('[api/play] token:', token);
                  console.log('[api/play] headers:', headers);
                  try {
                    const res = await fetch(playUrl, { headers });
                    console.log('[api/play] response status:', res.status);
                    if (res.ok) {
                      const blob = await res.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      setAudioUrl(blobUrl); // blob URL로 오디오 재생
                    } else {
                      setAudioUrl('');
                    }
                  } catch (err) {
                    console.log('[api/play] fetch 에러:', err);
                    setAudioUrl('');
                  }
                }
                setIsPlaying(true);
              }
            }}
            disabled={!playingSong}
            style={{ opacity: playingSong ? 1 : 0.5, marginHorizontal: 6 }}
          >
            <Icon name="skip-previous" size={28} color={playingSong ? '#222' : '#bbb'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              if (!selectedPlaylist || !playingSong) return;
              const items = selectedPlaylist.items;
              const idx = items.findIndex((s) => s.video_id === playingSong.video_id);
              let nextSong = null;
              if (isShuffle) {
                const remain = items.filter((s) => s.video_id !== playingSong.video_id);
                if (remain.length > 0) {
                  nextSong = remain[Math.floor(Math.random() * remain.length)];
                }
              } else if (idx < items.length - 1) {
                nextSong = items[idx + 1];
              }
              if (nextSong) {
                setPlayingSong(nextSong);
                const playUrl = `https://youtube.ssrhouse.store/api/play?id=${nextSong.video_id}`;
                if (Platform.OS === 'web') {
                  setAudioUrl(playUrl);
                } else {
                  const token = await SecureStore.getItemAsync('token');
                  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
                  console.log('[api/play] token:', token);
                  console.log('[api/play] headers:', headers);
                  try {
                    const res = await fetch(playUrl, { headers });
                    console.log('[api/play] response status:', res.status);
                    if (res.ok) {
                      const blob = await res.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      setAudioUrl(blobUrl); // blob URL로 오디오 재생
                    } else {
                      setAudioUrl('');
                    }
                  } catch (err) {
                    console.log('[api/play] fetch 에러:', err);
                    setAudioUrl('');
                  }
                }
                setIsPlaying(true);
              }
            }}
            disabled={!playingSong}
            style={{ opacity: playingSong ? 1 : 0.5, marginHorizontal: 6 }}
          >
            <Icon name="skip-next" size={28} color={playingSong ? '#222' : '#bbb'} />
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            <div style={{ position: 'relative', display: 'inline-block', marginLeft: 6, marginRight: 6 }}>
              <button
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                onClick={() => setIsShuffle((s) => !s)}
                onMouseEnter={e => {
                  const tip = document.createElement('div');
                  tip.innerText = isShuffle ? '랜덤 재생 중' : '순차 재생 중';
                  tip.style.position = 'absolute';
                  tip.style.bottom = '36px';
                  tip.style.left = '50%';
                  tip.style.transform = 'translateX(-50%)';
                  tip.style.background = '#222';
                  tip.style.color = '#fff';
                  tip.style.padding = '4px 10px';
                  tip.style.borderRadius = '8px';
                  tip.style.fontSize = '13px';
                  tip.style.whiteSpace = 'nowrap';
                  tip.style.zIndex = '9999';
                  tip.className = 'shuffle-tooltip';
                  if (e.currentTarget.parentNode) {
                    e.currentTarget.parentNode.appendChild(tip);
                  }
                }}
                onMouseLeave={e => {
                  if (e.currentTarget.parentNode) {
                    const tips = e.currentTarget.parentNode.querySelectorAll('.shuffle-tooltip');
                    tips.forEach(t => t.remove());
                  }
                }}
              >
                <Icon name={isShuffle ? 'shuffle' : 'repeat'} size={28} color={isShuffle ? '#6366f1' : '#bbb'} />
              </button>
            </div>
          ) : (
            <TouchableOpacity
              onPress={() => setIsShuffle((s) => !s)}
              style={{ marginHorizontal: 6 }}
            >
              <Icon name={isShuffle ? 'shuffle' : 'repeat'} size={28} color={isShuffle ? '#6366f1' : '#bbb'} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default MusicPlayerBar;
