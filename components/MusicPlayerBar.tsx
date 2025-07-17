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
          {Platform.OS !== 'web' && audioUrl && (
            <Text style={{ color: '#888', fontSize: 13, marginTop: 8 }}>앱에서는 오디오 재생 기능을 지원하지 않습니다.</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
          <TouchableOpacity
            onPress={() => {
              if (!selectedPlaylist || !playingSong) return;
              const items = selectedPlaylist.items;
              const idx = items.findIndex((s) => s.video_id === playingSong.video_id);
              if (isShuffle) {
                const remain = items.filter((s) => s.video_id !== playingSong.video_id);
                if (remain.length > 0) {
                  const prev = remain[Math.floor(Math.random() * remain.length)];
                  setPlayingSong(prev);
                  setAudioUrl(`https://youtube.ssrhouse.store/api/play?id=${prev.video_id}`);
                  setIsPlaying(true);
                }
              } else if (idx > 0) {
                setPlayingSong(items[idx - 1]);
                setAudioUrl(`https://youtube.ssrhouse.store/api/play?id=${items[idx - 1].video_id}`);
                setIsPlaying(true);
              }
            }}
            disabled={!playingSong}
            style={{ opacity: playingSong ? 1 : 0.5, marginHorizontal: 6 }}
          >
            <Icon name="skip-previous" size={28} color={playingSong ? '#222' : '#bbb'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (!selectedPlaylist || !playingSong) return;
              const items = selectedPlaylist.items;
              const idx = items.findIndex((s) => s.video_id === playingSong.video_id);
              if (isShuffle) {
                const remain = items.filter((s) => s.video_id !== playingSong.video_id);
                if (remain.length > 0) {
                  const next = remain[Math.floor(Math.random() * remain.length)];
                  setPlayingSong(next);
                  setAudioUrl(`https://youtube.ssrhouse.store/api/play?id=${next.video_id}`);
                  setIsPlaying(true);
                }
              } else if (idx < items.length - 1) {
                setPlayingSong(items[idx + 1]);
                setAudioUrl(`https://youtube.ssrhouse.store/api/play?id=${items[idx + 1].video_id}`);
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
