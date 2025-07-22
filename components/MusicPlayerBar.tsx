import Slider from '@react-native-community/slider';
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
  const [durationMillis, setDurationMillis] = React.useState(0);
  const [positionMillis, setPositionMillis] = React.useState(0);
  const [isSeeking, setIsSeeking] = React.useState(false);
  const [pendingSeek, setPendingSeek] = React.useState<number | null>(null);
  const [volume, setVolume] = React.useState(1);

  // 앱에서 오디오 재생 (이전 사운드 완전 언로드 후 새로 생성)
  React.useEffect(() => {
    let isMounted = true;
    let unloadPromise: Promise<AVPlaybackStatus> | null = null;
    if (Platform.OS !== 'web' && audioUrl) {
      (async () => {
        // 이전 사운드 언로드를 반드시 await
        if (soundRef.current) {
          try {
            unloadPromise = soundRef.current.unloadAsync();
            await unloadPromise;
          } catch {
            // ignore
          }
          soundRef.current = null;
        }
        if (!isMounted) return;
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: true, volume },
            (status: AVPlaybackStatus) => {
              if ('didJustFinish' in status && status.didJustFinish && onEnd) onEnd();
              if ('isPlaying' in status) setIsPlaying(status.isPlaying ?? false);
              if ('durationMillis' in status && typeof status.durationMillis === 'number') setDurationMillis(status.durationMillis);
              if ('positionMillis' in status && typeof status.positionMillis === 'number') setPositionMillis(status.positionMillis);
            }
          );
          if (isMounted) {
            soundRef.current = sound;
          } else {
            // 컴포넌트가 언마운트된 경우 바로 언로드
            await sound.unloadAsync();
          }
        } catch {
          // ignore
        }
      })();
    }
    return () => {
      isMounted = false;
      if (soundRef.current) {
        // 언로드가 진행 중이면 끝날 때까지 기다림
        if (unloadPromise) {
          unloadPromise.then(() => {
            soundRef.current = null;
          });
        } else {
          soundRef.current.unloadAsync();
          soundRef.current = null;
        }
      }
    };
  }, [audioUrl, onEnd, setIsPlaying, volume]);

  // 볼륨 변경
  React.useEffect(() => {
    if (Platform.OS !== 'web' && soundRef.current) {
      soundRef.current.setVolumeAsync(volume);
    }
  }, [volume]);

  if (!audioUrl || !playingSong) return null;
  // 시간 포맷
  const formatTime = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
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
          {/* 앱: 진행바/시킹/볼륨/시간표시 - 버튼 묶음을 위로, 슬라이더를 넓게 */}
          {Platform.OS !== 'web' && audioUrl && (
            <View style={{ marginTop: 8 }}>
              {/* 버튼 묶음 (이전/재생/다음/셔플) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
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
                      let token: string | null = null;
                      setPlayingSong(nextSong);
                      if (Platform.OS === 'web') {
                        token = window.localStorage.getItem('token');
                      } else {
                        token = await SecureStore.getItemAsync('token');
                      }
                      const playUrl = `https://youtube.ssrhouse.store/api/play?id=${nextSong.video_id}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
                      setAudioUrl(playUrl);
                      setIsPlaying(true);
                    }
                  }}
                  style={{ marginHorizontal: 8, padding: 8, borderRadius: 8, backgroundColor: '#e0e7ff' }}
                >
                  <Icon name="skip-previous" size={28} color={'#6366f1'} />
                </TouchableOpacity>
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
                  style={{ marginHorizontal: 8, padding: 8, borderRadius: 8, backgroundColor: '#e0e7ff' }}
                >
                  <Icon name={isPlaying ? 'pause' : 'play-arrow'} size={32} color={'#6366f1'} />
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
                      let token: string | null = null;
                      setPlayingSong(nextSong);
                      if (Platform.OS === 'web') {
                        token = window.localStorage.getItem('token');
                      } else {
                        token = await SecureStore.getItemAsync('token');
                      }
                      const playUrl = `https://youtube.ssrhouse.store/api/play?id=${nextSong.video_id}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
                      setAudioUrl(playUrl);
                      setIsPlaying(true);
                    }
                  }}
                  style={{ marginHorizontal: 8, padding: 8, borderRadius: 8, backgroundColor: '#e0e7ff' }}
                >
                  <Icon name="skip-next" size={28} color={'#6366f1'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsShuffle((s) => !s)}
                  style={{ marginHorizontal: 8, padding: 8, borderRadius: 8, backgroundColor: isShuffle ? '#6366f1' : '#e0e7ff' }}
                >
                  <Icon name={isShuffle ? 'shuffle' : 'repeat'} size={28} color={isShuffle ? '#fff' : '#6366f1'} />
                </TouchableOpacity>
              </View>
              {/* 진행바/시킹 */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#888', width: 40, textAlign: 'right' }}>{formatTime(positionMillis)}</Text>
                <Slider
                  style={{ flex: 1, marginHorizontal: 8, height: 32 }}
                  minimumValue={0}
                  maximumValue={durationMillis}
                  value={isSeeking && pendingSeek !== null ? pendingSeek : positionMillis}
                  minimumTrackTintColor="#6366f1"
                  maximumTrackTintColor="#ddd"
                  thumbTintColor="#6366f1"
                  onValueChange={val => {
                    setIsSeeking(true);
                    setPendingSeek(val);
                  }}
                  onSlidingComplete={async val => {
                    setIsSeeking(false);
                    setPendingSeek(null);
                    if (soundRef.current) {
                      await soundRef.current.setPositionAsync(val);
                    }
                  }}
                />
                <Text style={{ fontSize: 12, color: '#888', width: 40, textAlign: 'left' }}>{formatTime(durationMillis)}</Text>
              </View>
              {/* 볼륨 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' }}>
                <Icon name="volume-up" size={22} color="#6366f1" style={{ marginRight: 4 }} />
                <Slider
                  style={{ width: 100, height: 24 }}
                  minimumValue={0}
                  maximumValue={1}
                  value={volume}
                  minimumTrackTintColor="#6366f1"
                  maximumTrackTintColor="#ddd"
                  thumbTintColor="#6366f1"
                  onValueChange={setVolume}
                />
              </View>
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
                let token: string | null = null;
                setPlayingSong(nextSong);
                if (Platform.OS === 'web') {
                  token = window.localStorage.getItem('token');
                } else {
                  token = await SecureStore.getItemAsync('token');
                }
                const playUrl = `https://youtube.ssrhouse.store/api/play?id=${nextSong.video_id}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
                setAudioUrl(playUrl);
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
                let token: string | null = null;
                setPlayingSong(nextSong);
                if (Platform.OS === 'web') {
                  token = window.localStorage.getItem('token');
                } else {
                  token = await SecureStore.getItemAsync('token');
                }
                const playUrl = `https://youtube.ssrhouse.store/api/play?id=${nextSong.video_id}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
                setAudioUrl(playUrl);
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
