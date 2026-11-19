import { useState } from 'react';
import type { Place, Lang } from '../shared/types';
import type { Listing } from '../shared/listings';
import { api } from './api';

type Settings = { mode: 'existing'; placeId: string } | {
  mode: 'new'; lat: number; lng: number; days: number[]; open: number; close: number;
  stay: number; reservation: boolean;
} | { mode: 'off' };
type ExistingPlace = Pick<Place, 'id' | 'name' | 'areaId' | 'address'>;

const toMinutes = (value: string) => {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};
const toClock = (minutes: number) =>
  [Math.floor(minutes / 60), minutes % 60].map(value => String(value).padStart(2, '0')).join(':');

export function ListingRouteEditor({ listing, lang }: { listing: Listing; lang: Lang }) {
  const t = (ko: string, en: string) => lang === 'ko' ? ko : en;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [places, setPlaces] = useState<ExistingPlace[]>([]);
  const [days, setDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function load() {
    if (settings || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await api<{ places: ExistingPlace[]; links: Record<string, Settings> }>('operator/listing-routes');
      const saved = data.links[listing.id] || { mode: 'off' };
      setSettings(saved);
      setDays(saved.mode === 'new' ? saved.days : []);
      setPlaces(data.places.filter(place => place.areaId === listing.data.areaId));
    } catch {
      setMessage(t('코스 설정을 불러오지 못했습니다.', 'Could not load route settings.'));
    } finally {
      setBusy(false);
    }
  }

  return <details onToggle={event => { if (event.currentTarget.open) void load(); }}>
    <summary>{t('추천 코스 연결', 'Connect to recommended routes')}</summary>
    {settings && <form key={settings.mode} onSubmit={async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const mode = settings.mode;
      const next: Settings = mode === 'existing' ? { mode, placeId: String(data.get('placeId')) }
        : mode === 'new' ? {
          mode, lat: Number(data.get('lat')), lng: Number(data.get('lng')), days,
          open: toMinutes(String(data.get('open'))), close: toMinutes(String(data.get('close'))),
          stay: Number(data.get('stay')), reservation: data.has('reservation'),
        } : { mode };
      setMessage('');
      setBusy(true);
      try {
        const result = await api<{ settings: Settings | null }>('operator/listing-routes', { ...next, id: listing.id, updated: listing.updated });
        setSettings(result.settings || { mode: 'off' });
        setMessage(t('코스 연결 설정을 저장했습니다.', 'Route settings saved.'));
      } catch {
        setMessage(t('저장하지 못했습니다. 장소, 운영 요일·시간과 체류시간을 확인하세요. 게시물이 수정됐다면 새로고침하세요.',
          'Could not save. Check the place, opening days and hours, and visit duration. Refresh if the listing changed.'));
      } finally {
        setBusy(false);
      }
    }}>
      <label>{t('코스 연결 방식', 'Route connection')}
        <select value={settings.mode} onChange={event => {
          const mode = event.target.value;
          setDays([]);
          setSettings(mode === 'existing' ? { mode, placeId: '' } : mode === 'new'
            ? { mode, lat: NaN, lng: NaN, open: NaN, close: NaN, days: [], stay: listing.data.duration || 30, reservation: false }
            : { mode: 'off' });
        }}>
          <option value="off">{t('연결 안 함', 'Off')}</option>
          {!(listing.data.eventStart || listing.data.eventEnd || listing.data.kind === 'event' || listing.data.category === 'event') &&
            <option value="existing">{t('카탈로그의 같은 장소에 연결', 'Link to the same catalog place')}</option>}
          <option value="new">{t('새 방문 장소로 추가', 'Add a new stop')}</option>
        </select>
      </label>
      {settings.mode === 'existing' && <label>{t('기존 장소', 'Existing place')}
        <select name="placeId" required defaultValue={settings.placeId}>
          <option value="">{t('선택', 'Select')}</option>
          {places.map(place => <option key={place.id} value={place.id}>{place.name.ko} · {place.address}</option>)}
        </select>
      </label>}
      {settings.mode === 'new' && <>
        <p>{listing.data.address}</p>
        {(['lat', 'lng'] as const).map(key => <label key={key}>
          {key === 'lat' ? t('지도 위도', 'Latitude') : t('지도 경도', 'Longitude')}
          <input name={key} type="number" step="any" required defaultValue={Number.isFinite(settings[key]) ? settings[key] : ''} />
        </label>)}
        <fieldset><legend>{t('운영 요일', 'Open days')}</legend>
          {(lang === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map((day, i) =>
            <label key={day}><input type="checkbox" checked={days.includes(i)}
              onChange={event => setDays(event.target.checked ? [...days, i] : days.filter(value => value !== i))} />{day}</label>)}
        </fieldset>
        <label>{t('영업 시작', 'Opens')}<input type="time" name="open" required defaultValue={Number.isFinite(settings.open) ? toClock(settings.open) : ''} /></label>
        <label>{t('영업 종료', 'Closes')}<input type="time" name="close" required defaultValue={Number.isFinite(settings.close) ? toClock(settings.close) : ''} /></label>
        <label>{t('체류시간(분)', 'Visit duration (minutes)')}<input name="stay" type="number" min="10" max="240" required defaultValue={settings.stay} /></label>
        <label><input name="reservation" type="checkbox" defaultChecked={settings.reservation} />
          {t('예약 필수 · 자동 추천 제외', 'Reservation required · exclude from automatic recommendations')}</label>
      </>}
      <button className="secondary" disabled={busy}>{t('코스 설정 저장', 'Save route settings')}</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </details>;
}
