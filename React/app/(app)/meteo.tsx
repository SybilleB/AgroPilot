/**
 * app/(app)/meteo.tsx — Écran Météo Agricole
 *
 * Sources :
 *  - Géocodage    : api-adresse.data.gouv.fr (gratuit, sans clé)
 *  - Météo        : Open-Meteo              (gratuit, sans clé)
 *  - Radar        : RainViewer API          (gratuit, sans clé, animé)
 *  - Satellite    : ESRI World Imagery      (gratuit, sans clé)
 *  - Carte topo   : OpenTopoMap             (gratuit, sans clé)
 *
 * Onglets : Général | Pluie | Gel | ETP | Sol | Vent
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { getFullProfile } from '@/services/profile.service';
import {
  DailyForecast,
  MeteoData,
  fetchMeteo,
  geocodeCommune,
  weatherCodeToEmoji,
  weatherCodeToLabel,
} from '@/services/meteo.service';
import { Colors } from '@/constants/Colors';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab       = 'general' | 'pluie' | 'gel' | 'etp' | 'sol' | 'vent';
type ChartMode = 'pluie' | 'gel' | 'etp';

const TABS: { key: Tab; label: string }[] = [
  { key: 'general', label: 'Général'  },
  { key: 'pluie',   label: 'Pluie'   },
  { key: 'gel',     label: 'Gel'     },
  { key: 'etp',     label: 'ETP'     },
  { key: 'sol',     label: 'Sol'     },
  { key: 'vent',    label: 'Vent'    },
];

const CHART_MODES: { key: ChartMode; label: string }[] = [
  { key: 'pluie', label: 'Pluie' },
  { key: 'gel',   label: 'Gel'   },
  { key: 'etp',   label: 'ETP'   },
];

// ─── Composant carte cross-platform ───────────────────────────────────────────
//
//  • iOS / Android → WebView avec Leaflet + radar RainViewer animé
//  • Web (Expo web) → iframe Windy embed (react-native-webview non supporté sur web)

function MeteoMap({ lat, lon, commune }: { lat: number; lon: number; commune: string }) {
  if (Platform.OS === 'web') {
    const windyUrl =
      `https://embed.windy.com/embed2.html` +
      `?lat=${lat}&lon=${lon}&zoom=9&level=surface&overlay=rain` +
      `&menu=false&message=false&marker=true&calendar=false` +
      `&pressure=false&type=map&location=coordinates` +
      `&detail=false&metricWind=km%2Fh&metricTemp=%C2%B0C`;
    return React.createElement('iframe', {
      src:   windyUrl,
      style: { width: '100%', height: '100%', border: 'none' },
      title: 'Météo Windy',
      allow: 'fullscreen',
    });
  }
  return (
    <WebView
      source={{ html: buildMapHtml(lat, lon, commune) }}
      style={mapStyles.webview}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      allowsInlineMediaPlayback
      scrollEnabled={false}
      nestedScrollEnabled={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    />
  );
}

const mapStyles = StyleSheet.create({ webview: { flex: 1 } });

// ─── HTML de la carte interactive ─────────────────────────────────────────────

function buildMapHtml(lat: number, lon: number, commune: string): string {
  const safeCommune = commune
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:100%;height:100%;background:#e8f0e9;}
    #map{width:100%;height:100%;}

    #layerBar{
      position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
      z-index:1000;display:flex;gap:6px;
      background:rgba(255,255,255,0.97);border-radius:28px;
      padding:6px 10px;box-shadow:0 3px 16px rgba(0,0,0,0.25);
    }
    .lbtn{
      border:none;border-radius:18px;padding:7px 14px;
      font-size:12px;font-weight:700;cursor:pointer;
      background:transparent;color:#555;transition:all .2s;
      white-space:nowrap;
    }
    .lbtn.active{background:#1A3A0F;color:#fff;}

    #infoBadge{
      position:absolute;top:10px;left:10px;z-index:1000;
      background:rgba(255,255,255,0.95);border-radius:10px;
      padding:7px 12px;font-size:11px;color:#333;
      line-height:1.6;max-width:180px;
      box-shadow:0 2px 8px rgba(0,0,0,0.15);
    }

    #radarTime{
      position:absolute;top:10px;right:10px;z-index:1000;
      background:rgba(26,58,15,0.92);color:#fff;
      border-radius:8px;padding:5px 10px;font-size:11px;
      font-weight:700;display:none;
    }

    .leaflet-control-attribution{font-size:8px;}
  </style>
</head>
<body>
<div id="map"></div>
<div id="layerBar">
  <button class="lbtn active" id="btn-radar"  onclick="setMode('radar')">Radar</button>
  <button class="lbtn"        id="btn-sat"    onclick="setMode('satellite')">Satellite</button>
  <button class="lbtn"        id="btn-topo"   onclick="setMode('topo')">Terrain</button>
</div>
<div id="infoBadge">Radar précipitations<br><span style="color:#888;font-size:10px">Animé · temps réel</span></div>
<div id="radarTime"></div>

<script>
const LAT="${lat}", LON="${lon}", NAME="${safeCommune}";

const map = L.map('map',{center:[LAT,LON],zoom:9,zoomControl:true});

const OSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'});
const SAT = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© ESRI'});
const TOPO= L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'© OpenTopoMap'});
OSM.addTo(map);

const farmIcon = L.divIcon({
  html:'<div style="background:#1A3A0F;color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.4)">&#128664;</div>',
  className:'',iconSize:[36,36],iconAnchor:[18,18]
});
L.marker([LAT,LON],{icon:farmIcon}).addTo(map)
  .bindPopup('<b>'+NAME+'</b><br><span style="color:#666;font-size:12px">Mon exploitation</span>')
  .openPopup();

let radarLayers=[], frames=[], frameIdx=0, animTimer=null;

async function loadRadar(){
  try{
    const r=await fetch('https://api.rainviewer.com/public/weather-maps.json');
    const d=await r.json();
    frames=[...d.radar.past.slice(-5),...(d.radar.nowcast||[]).slice(0,3)];
    preloadFrames();
  }catch(e){console.warn('radar err',e);}
}

function preloadFrames(){
  radarLayers.forEach(l=>map.removeLayer(l));
  radarLayers=frames.map(f=>
    L.tileLayer('https://tilecache.rainviewer.com'+f.path+'/512/{z}/{x}/{y}/4/1_1.png',
      {opacity:0,maxZoom:15,tileSize:512,zoomOffset:-1})
  );
  radarLayers.forEach(l=>l.addTo(map));
  startAnim();
}

function startAnim(){
  if(animTimer)clearInterval(animTimer);
  frameIdx=0;
  animTimer=setInterval(()=>{
    radarLayers.forEach((l,i)=>l.setOpacity(i===frameIdx?0.7:0));
    const ts=new Date(frames[frameIdx].time*1000);
    const label=ts.getHours().toString().padStart(2,'0')+':'+ts.getMinutes().toString().padStart(2,'0');
    const isPast=frameIdx<(frames.length-3);
    document.getElementById('radarTime').textContent=(isPast?'Passé ':' Prévu ')+label;
    frameIdx=(frameIdx+1)%radarLayers.length;
  },700);
}

function stopRadar(){
  if(animTimer){clearInterval(animTimer);animTimer=null;}
  radarLayers.forEach(l=>map.removeLayer(l));
  radarLayers=[];frames=[];
  document.getElementById('radarTime').style.display='none';
}

const infos={
  radar    :'Radar précipitations<br><span style="color:#888;font-size:10px">Animé · temps réel</span>',
  satellite:'Imagerie satellite<br><span style="color:#888;font-size:10px">Visualisez vos parcelles</span>',
  topo     :'Relief & topographie<br><span style="color:#888;font-size:10px">Drainage · exposition</span>',
};

function setMode(mode){
  document.querySelectorAll('.lbtn').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn-'+mode).classList.add('active');
  document.getElementById('infoBadge').innerHTML=infos[mode];

  map.removeLayer(OSM);map.removeLayer(SAT);map.removeLayer(TOPO);
  if(mode==='satellite')SAT.addTo(map);
  else if(mode==='topo')TOPO.addTo(map);
  else OSM.addTo(map);

  stopRadar();
  if(mode==='radar'){
    document.getElementById('radarTime').style.display='block';
    loadRadar();
  }
}

setMode('radar');
</script>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
function dayShort(d: string) { return JOURS[new Date(d + 'T12:00:00').getDay()]; }
function totalPrecip(daily: DailyForecast[]) { return daily.reduce((s, d) => s + d.precipitationSum, 0).toFixed(1); }
function maxPrecipDay(daily: DailyForecast[]) { const m = daily.reduce((a, b) => a.precipitationSum > b.precipitationSum ? a : b); return `${m.precipitationSum} mm (${dayShort(m.date)})`; }
function coldestNight(daily: DailyForecast[]) { const c = daily.reduce((a, b) => a.tempMin < b.tempMin ? a : b); return `${c.tempMin}°C (${dayShort(c.date)})`; }
function totalEtp(daily: DailyForecast[]) { return daily.reduce((s, d) => s + d.etp, 0).toFixed(1); }
function etpLabel(etp: number) { if (etp < 1) return 'Besoins faibles'; if (etp < 3) return 'Besoins modérés'; if (etp < 5) return 'Besoins importants'; return 'Besoins très élevés'; }
function bilanHydrique(daily: DailyForecast[]) { const b = daily.reduce((s, d) => s + d.precipitationSum - d.etp, 0); return (b >= 0 ? '+' : '') + b.toFixed(1) + ' mm'; }
function peakEtp(daily: DailyForecast[]) { const p = daily.reduce((a, b) => a.etp > b.etp ? a : b); return `${p.etp} mm (${dayShort(p.date)})`; }
function soilTrend(temps: number[]) { const h = Math.min(new Date().getHours(), 23); const d = (temps[h] ?? temps[0] ?? 0) - (temps[6] ?? temps[0] ?? 0); if (Math.abs(d) < 0.5) return 'Stable'; return d > 0 ? `+${d.toFixed(1)}°C` : `${d.toFixed(1)}°C`; }
function windDirLabel(deg: number) { return ['N','NE','E','SE','S','SO','O','NO'][Math.round(deg / 45) % 8]; }
function humidityLabel(h: number) { if (h < 30) return 'Air très sec'; if (h < 50) return 'Air sec'; if (h < 70) return 'Normal'; if (h < 85) return 'Humide'; return 'Très humide'; }
function traitementOk(wind: number, gusts: number, precip: number) {
  if (precip > 0.5) return { ok: false, reason: 'Pluie en cours — traitement impossible', icon: '🌧️' };
  if (gusts > 60)   return { ok: false, reason: 'Rafales > 60 km/h — risque de dérive', icon: '💨' };
  if (wind > 19)    return { ok: false, reason: 'Vent > 19 km/h — dérive trop importante', icon: '💨' };
  return { ok: true, reason: 'Conditions favorables au traitement', icon: '✓' };
}

// ─── Graphique barres 7 jours ─────────────────────────────────────────────────

function WeekChart({ daily, mode }: { daily: DailyForecast[]; mode: ChartMode }) {
  const vals = daily.map(d => mode === 'pluie' ? d.precipitationSum : mode === 'gel' ? d.tempMin : d.etp);
  const absMax = mode === 'gel'
    ? Math.max(Math.abs(Math.min(...vals)), Math.abs(Math.max(...vals)), 1)
    : Math.max(...vals, 0.1);

  return (
    <View style={cs.wrap}>
      <View style={cs.bars}>
        {daily.map((d, i) => {
          const v = vals[i];
          const h = Math.max((Math.abs(v) / absMax) * 76, 4);
          const col = mode === 'gel'
            ? (v < 0 ? '#1565C0' : Colors.warning)
            : mode === 'pluie' ? (v > 5 ? '#1565C0' : Colors.primaryLight)
            : (v > 4 ? '#E65100' : Colors.primary);
          return (
            <View key={d.date} style={cs.col}>
              <Text style={[cs.val, v < 0 && { color: '#1565C0' }]}>{v !== 0 ? v : ''}</Text>
              <View style={cs.track}><View style={[cs.bar, { height: h, backgroundColor: col }]} /></View>
              <Text style={[cs.day, d.isFrost && { color: '#1565C0', fontWeight: '700' }]}>
                {i === 0 ? 'Auj.' : dayShort(d.date)}
              </Text>
              {d.isFrost && <Text style={{ fontSize: 9 }}>❄️</Text>}
            </View>
          );
        })}
      </View>
      <Text style={cs.unit}>en {mode === 'pluie' ? 'mm' : mode === 'gel' ? '°C' : 'mm/j'}</Text>
    </View>
  );
}
const cs = StyleSheet.create({
  wrap:  { paddingHorizontal: 4 },
  bars:  { flexDirection: 'row', alignItems: 'flex-end', height: 104, gap: 5, paddingTop: 20 },
  col:   { flex: 1, alignItems: 'center', gap: 3 },
  track: { height: 76, justifyContent: 'flex-end', width: '100%' },
  bar:   { width: '100%', borderRadius: 4, minHeight: 4 },
  val:   { fontSize: 9, color: Colors.textMuted, fontWeight: '600', position: 'absolute', top: 0 },
  day:   { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
  unit:  { fontSize: 10, color: Colors.textPlaceholder, textAlign: 'right', marginTop: 4 },
});

// ─── Sub-composants ───────────────────────────────────────────────────────────

function MetricBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.metricBox}>
      <Text style={s.metricVal}>{value}</Text>
      <Text style={s.metricLbl}>{label}</Text>
    </View>
  );
}

function DataCard({ title, value, sub, badge }: {
  title: string; value: string; sub?: string;
  badge?: { label: string; color: string };
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{title}</Text>
        {badge && (
          <View style={[s.cardBadge, { backgroundColor: badge.color + '22' }]}>
            <Text style={[s.cardBadgeTxt, { color: badge.color }]}>{badge.label}</Text>
          </View>
        )}
      </View>
      <Text style={s.cardVal}>{value}</Text>
      {sub ? <Text style={s.cardSub}>{sub}</Text> : null}
    </View>
  );
}

function FRow({ day, isToday }: { day: DailyForecast; isToday: boolean }) {
  return (
    <View style={[s.fRow, day.isFrost && s.fFrost, isToday && s.fToday]}>
      <Text style={[s.fDay, isToday && s.fDayOn]}>{isToday ? 'Auj.' : dayShort(day.date)}</Text>
      <Text style={s.fEmoji}>{weatherCodeToEmoji(day.weatherCode)}</Text>
      <View style={{ flex: 1 }}><Text style={s.fPrecip}>{day.precipitationSum} mm</Text></View>
      <Text style={s.fEtp}>ETP {day.etp}</Text>
      <View style={s.fTemps}>
        {day.isFrost && <Text style={{ fontSize: 11 }}>❄️</Text>}
        <Text style={s.fMin}>{day.tempMin}°</Text>
        <Text style={s.fSep}>/</Text>
        <Text style={s.fMax}>{day.tempMax}°</Text>
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function MeteoScreen() {
  const insets      = useSafeAreaInsets();
  const { session } = useAuth();

  const [meteo,      setMeteo]      = useState<MeteoData | null>(null);
  const [commune,    setCommune]    = useState('');
  const [coords,     setCoords]     = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [tab,        setTab]        = useState<Tab>('general');
  const [chartMode,  setChartMode]  = useState<ChartMode>('pluie');

  const load = async (isRefresh = false) => {
    if (!session?.user.id) return;
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const fp   = await getFullProfile(session.user.id);
      const comm = fp?.exploitation?.commune ?? '';
      const cp   = fp?.exploitation?.code_postal ?? '';
      setCommune(comm || 'Mon exploitation');
      if (!comm) { setError('Commune non renseignée dans le profil.'); return; }

      const c = await geocodeCommune(comm, cp);
      if (!c) { setError('Impossible de localiser la commune.'); return; }
      setCoords(c);

      const data = await fetchMeteo(c.lat, c.lon);
      if (!data) { setError('Impossible de charger les données météo.'); return; }
      data.coordinates.label = c.label;
      setMeteo(data);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur inattendue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [session]);

  // ── Écran de chargement ───────────────────────────────────────────────────
  if (loading) return (
    <View style={s.loadScreen}>
      <View style={[s.loadHeader, { paddingTop: insets.top + 24 }]}>
        <Text style={s.loadHeaderTitle}>Météo agricole</Text>
        <Text style={s.loadHeaderSub}>Chargement des données en cours…</Text>
      </View>
      <View style={s.loadBody}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.loadTxt}>Localisation de votre exploitation</Text>
      </View>
    </View>
  );

  // ── Écran d'erreur ────────────────────────────────────────────────────────
  if (error || !meteo) return (
    <View style={s.loadScreen}>
      <View style={[s.loadHeader, { paddingTop: insets.top + 24 }]}>
        <Text style={s.loadHeaderTitle}>Météo agricole</Text>
      </View>
      <View style={s.loadBody}>
        <Text style={s.errTitle}>Données indisponibles</Text>
        <Text style={s.errTxt}>{error ?? 'Impossible de charger les données météo.'}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
          <Text style={s.retryTxt}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const { current, daily, hourly } = meteo;
  const today     = daily[0];
  const frostDays = daily.filter(d => d.isFrost);
  const hi        = Math.min(new Date().getHours(), 23);
  const soilNow   = hourly.soilTemp6cm[hi]  ?? hourly.soilTemp6cm[0]  ?? 0;
  const soilDeep  = hourly.soilTemp18cm[hi] ?? hourly.soilTemp18cm[0] ?? 0;
  const dec       = traitementOk(current.windSpeed, current.windGusts, current.precipitation);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >

      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 22 }]}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.hCommune}>{commune}</Text>
            <Text style={s.hLabel}>{coords?.label ?? 'Météo agricole'}</Text>
          </View>
          <View style={s.hTempBlock}>
            <Text style={s.hTempBig}>{current.temp}°</Text>
            <Text style={s.hWeatherLabel}>{weatherCodeToLabel(current.weatherCode)}</Text>
          </View>
        </View>

        {/* Métriques rapides */}
        <View style={s.metricsRow}>
          <MetricBox value={`${current.humidity}%`}        label="Humidité"  />
          <View style={s.metricDivider} />
          <MetricBox value={`${current.windSpeed} km/h`}   label="Vent"      />
          <View style={s.metricDivider} />
          <MetricBox value={`UV ${current.uvIndex}`}        label="UV"        />
          <View style={s.metricDivider} />
          <MetricBox value={`${current.apparent}°`}        label="Ressenti"  />
        </View>
      </View>

      {/* ─── ALERTE GEL ──────────────────────────────────────────────────── */}
      {frostDays.length > 0 && (
        <View style={s.frostAlert}>
          <Text style={s.frostIcon}>❄️</Text>
          <Text style={s.frostAlertTxt}>
            Gel prévu : {frostDays.map(d => dayShort(d.date)).join(', ')} — protégez vos cultures sensibles
          </Text>
        </View>
      )}

      {/* ─── CARTE INTERACTIVE ───────────────────────────────────────────── */}
      {coords && (
        <View style={s.mapContainer}>
          <MeteoMap lat={coords.lat} lon={coords.lon} commune={commune} />
        </View>
      )}

      {/* ─── DÉCISION TRAITEMENT ─────────────────────────────────────────── */}
      <View style={s.sectionPad}>
        <Text style={s.sectionLabel}>TRAITEMENT PHYTOSANITAIRE</Text>
        <View style={[s.dec, dec.ok ? s.decOk : s.decNok]}>
          <View style={s.decLeft}>
            <View style={[s.decIconBox, { backgroundColor: dec.ok ? Colors.successBg : Colors.errorBg }]}>
              <Text style={s.decIcon}>{dec.icon}</Text>
            </View>
            <View>
              <Text style={[s.decTitle, { color: dec.ok ? Colors.success : Colors.errorDark }]}>
                {dec.ok ? 'Traitement possible' : 'Traitement déconseillé'}
              </Text>
              <Text style={s.decReason}>{dec.reason}</Text>
            </View>
          </View>
          <View style={s.decRight}>
            <Text style={s.decWindVal}>{current.windSpeed}</Text>
            <Text style={s.decWindUnit}>km/h</Text>
          </View>
        </View>
      </View>

      {/* ─── GRAPHIQUE 7 JOURS ───────────────────────────────────────────── */}
      <View style={s.sectionPad}>
        <Text style={s.sectionLabel}>VUE 7 JOURS</Text>
        <View style={s.chartCard}>
          <View style={s.chartToggles}>
            {CHART_MODES.map(m => (
              <TouchableOpacity
                key={m.key}
                style={[s.ctBtn, chartMode === m.key && s.ctBtnOn]}
                onPress={() => setChartMode(m.key)}
              >
                <Text style={[s.ctTxt, chartMode === m.key && s.ctTxtOn]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <WeekChart daily={daily} mode={chartMode} />
          <View style={s.chartSum}>
            {chartMode === 'pluie' && <>
              <Text style={s.csi}>Total : <Text style={s.csv}>{totalPrecip(daily)} mm</Text></Text>
              <Text style={s.csi}>Jour max : <Text style={s.csv}>{maxPrecipDay(daily)}</Text></Text>
            </>}
            {chartMode === 'gel' && <>
              <Text style={s.csi}>Nuit la + froide : <Text style={s.csv}>{coldestNight(daily)}</Text></Text>
              <Text style={s.csi}>Jours de gel : <Text style={s.csv}>{frostDays.length} / 7</Text></Text>
            </>}
            {chartMode === 'etp' && <>
              <Text style={s.csi}>ETP totale : <Text style={s.csv}>{totalEtp(daily)} mm</Text></Text>
              <Text style={s.csi}>Bilan : <Text style={s.csv}>{bilanHydrique(daily)}</Text></Text>
            </>}
          </View>
        </View>
      </View>

      {/* ─── ONGLETS ─────────────────────────────────────────────────────── */}
      <View style={s.sectionPad}>
        <Text style={s.sectionLabel}>DONNÉES DÉTAILLÉES</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.tabsScroll} contentContainerStyle={s.tabsCont}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key}
            style={[s.tabBtn, tab === t.key && s.tabBtnOn]}
            onPress={() => setTab(t.key)}>
            <Text style={[s.tabTxt, tab === t.key && s.tabTxtOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ─── GRILLE CARDS ────────────────────────────────────────────────── */}
      <View style={s.grid}>
        {tab === 'general' && (<>
          <DataCard title="Température"    value={`${current.temp}°C`}             sub={`Ressenti ${current.apparent}°C`} />
          <DataCard title="Humidité"       value={`${current.humidity}%`}          sub={humidityLabel(current.humidity)} />
          <DataCard title="Conditions"     value={weatherCodeToLabel(current.weatherCode)} sub={`UV ${current.uvIndex}`} />
          <DataCard title="Précip. du jour" value={`${today.precipitationSum} mm`} sub={`${today.precipProbability}% de probabilité`} />
        </>)}
        {tab === 'pluie' && (<>
          <DataCard title="Aujourd'hui"       value={`${today.precipitationSum} mm`}  sub={`${today.precipProbability}% probabilité`} />
          <DataCard title="Cumul 7 jours"     value={`${totalPrecip(daily)} mm`}      sub="Total prévisionnel" />
          <DataCard title="Jour le + pluvieux" value={maxPrecipDay(daily)}            sub="Précipitations max" />
          <DataCard title="Jours de pluie"    value={`${daily.filter(d => d.precipitationSum > 1).length} / 7`} sub="Jours avec > 1 mm" />
        </>)}
        {tab === 'gel' && (<>
          <DataCard title="Risque de gel"
            value={frostDays.length > 0 ? `${frostDays.length} jour(s)` : 'Aucun'}
            sub={frostDays.length > 0 ? frostDays.map(d => dayShort(d.date)).join(', ') : 'Pas de gel prévu'}
            badge={frostDays.length > 0 ? { label: 'Alerte', color: Colors.error } : { label: 'OK', color: Colors.primary }} />
          <DataCard title="Nuit la + froide"  value={coldestNight(daily)} sub="Cette semaine" />
          <DataCard title="Min absolu 7j"     value={`${Math.min(...daily.map(d => d.tempMin))}°C`} sub="Température minimale" />
          <DataCard title="Max absolu 7j"     value={`${Math.max(...daily.map(d => d.tempMax))}°C`} sub="Température maximale" />
        </>)}
        {tab === 'etp' && (<>
          <DataCard title="ETP aujourd'hui" value={`${today.etp} mm/j`} sub={etpLabel(today.etp)}
            badge={today.etp > 4 ? { label: 'Irriguer', color: '#1565C0' } : undefined} />
          <DataCard title="ETP 7 jours"    value={`${totalEtp(daily)} mm`}    sub="Besoin cumulé" />
          <DataCard title="Bilan hydrique" value={bilanHydrique(daily)}        sub="Précip. − ETP" />
          <DataCard title="Pic ETP"         value={peakEtp(daily)}             sub="Jour le plus exigeant" />
        </>)}
        {tab === 'sol' && (<>
          <DataCard title="Sol superficiel" value={`${Math.round(soilNow)}°C`}  sub="Température à 6 cm"
            badge={soilNow >= 8 ? { label: 'Semis OK', color: Colors.primary } : { label: 'Trop froid', color: Colors.warning }} />
          <DataCard title="Sol profond"     value={`${Math.round(soilDeep)}°C`} sub="Température à 18 cm" />
          <DataCard title="Tendance sol"    value={soilTrend(hourly.soilTemp6cm)} sub="Évolution depuis ce matin" />
          <DataCard title="Conditions"
            value={soilNow >= 10 ? 'Favorables' : soilNow >= 5 ? 'Correctes' : 'Défavorables'}
            sub="Développement racinaire" />
        </>)}
        {tab === 'vent' && (<>
          <DataCard title="Vent moyen"     value={`${current.windSpeed} km/h`}  sub={`Direction : ${windDirLabel(current.windDirection)}`} />
          <DataCard title="Rafales"        value={`${current.windGusts} km/h`}
            sub={current.windGusts > 60 ? 'Risque pour traitements' : 'Traitements possibles'}
            badge={current.windGusts > 60 ? { label: 'Alerte', color: Colors.error } : undefined} />
          <DataCard title="Rafales max 7j" value={`${Math.max(...daily.map(d => d.windGusts))} km/h`} sub="Maximum cette semaine" />
          <DataCard title="Traitement"
            value={current.windSpeed < 19 ? 'Favorable' : 'Déconseillé'}
            sub={current.windSpeed < 19 ? '< 19 km/h — dérive faible' : '>= 19 km/h — risque dérive'}
            badge={current.windSpeed < 19 ? { label: 'OK', color: Colors.primary } : { label: 'Stop', color: Colors.error }} />
        </>)}
      </View>

      {/* ─── PRÉVISIONS 7 JOURS ──────────────────────────────────────────── */}
      <View style={s.sectionPad}>
        <Text style={s.sectionLabel}>PRÉVISIONS DÉTAILLÉES</Text>
        <View style={{ gap: 6 }}>
          {daily.map((d, i) => <FRow key={d.date} day={d} isToday={i === 0} />)}
        </View>
      </View>

      <Text style={s.footer}>Open-Meteo · RainViewer · ESRI · data.gouv.fr</Text>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.background },

  // Loading / error screens
  loadScreen:     { flex: 1, backgroundColor: Colors.background },
  loadHeader:     { backgroundColor: Colors.headerBg, paddingHorizontal: 22, paddingBottom: 32, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 8 },
  loadHeaderTitle:{ fontSize: 22, fontWeight: '800', color: '#fff' },
  loadHeaderSub:  { fontSize: 13, color: Colors.headerTextMuted },
  loadBody:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  loadTxt:        { fontSize: 14, color: Colors.textMuted },
  errTitle:       { fontSize: 20, fontWeight: '700', color: Colors.primaryDark, textAlign: 'center' },
  errTxt:         { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retryBtn:       { marginTop: 4, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  retryTxt:       { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Header
  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 22,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 18,
    marginBottom: 16,
  },
  headerTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hCommune:    { fontSize: 20, fontWeight: '800', color: '#fff' },
  hLabel:      { fontSize: 12, color: Colors.headerTextMuted, marginTop: 2 },
  hTempBlock:  { alignItems: 'flex-end' },
  hTempBig:    { fontSize: 44, fontWeight: '900', color: '#fff', lineHeight: 50 },
  hWeatherLabel:{ fontSize: 12, color: Colors.headerTextMuted, textAlign: 'right', marginTop: 2 },

  // Métriques header
  metricsRow:    { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 12 },
  metricBox:     { flex: 1, alignItems: 'center' },
  metricVal:     { fontSize: 14, fontWeight: '700', color: '#fff' },
  metricLbl:     { fontSize: 10, color: Colors.headerTextMuted, marginTop: 2 },
  metricDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', height: 24 },

  // Frost alert
  frostAlert:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF4FF', borderLeftWidth: 4, borderLeftColor: '#1565C0', marginHorizontal: 16, marginBottom: 14, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  frostIcon:    { fontSize: 16 },
  frostAlertTxt:{ fontSize: 13, color: '#0D47A1', lineHeight: 18, flex: 1 },

  // Carte
  mapContainer: { marginHorizontal: 16, marginBottom: 14, borderRadius: 16, overflow: 'hidden', height: 420, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },

  // Section
  sectionPad:   { paddingHorizontal: 16, marginBottom: 14 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },

  // Décision traitement
  dec:         { backgroundColor: Colors.white, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  decOk:       { borderLeftWidth: 4, borderLeftColor: Colors.success },
  decNok:      { borderLeftWidth: 4, borderLeftColor: Colors.error },
  decLeft:     { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  decIconBox:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  decIcon:     { fontSize: 18 },
  decTitle:    { fontSize: 15, fontWeight: '700' },
  decReason:   { fontSize: 12, color: Colors.textMuted, marginTop: 2, lineHeight: 17 },
  decRight:    { alignItems: 'center', minWidth: 52 },
  decWindVal:  { fontSize: 24, fontWeight: '900', color: Colors.primaryDark },
  decWindUnit: { fontSize: 11, color: Colors.textMuted, marginTop: -2 },

  // Chart
  chartCard:    { backgroundColor: Colors.white, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  chartToggles: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  ctBtn:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  ctBtnOn:      { backgroundColor: Colors.headerBg, borderColor: Colors.headerBg },
  ctTxt:        { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  ctTxtOn:      { color: '#fff', fontWeight: '700' },
  chartSum:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  csi:          { fontSize: 11, color: Colors.textMuted },
  csv:          { fontWeight: '700', color: Colors.primaryDark },

  // Tabs
  tabsScroll: { marginBottom: 12 },
  tabsCont:   { paddingHorizontal: 16, gap: 8 },
  tabBtn:     { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  tabBtnOn:   { backgroundColor: Colors.headerBg, borderColor: Colors.headerBg },
  tabTxt:     { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTxtOn:   { color: '#fff' },

  // Grid cards
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 14 },
  card:         { width: '47.5%', backgroundColor: Colors.white, borderRadius: 14, padding: 14, gap: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle:    { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  cardBadge:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cardBadgeTxt: { fontSize: 10, fontWeight: '700' },
  cardVal:      { fontSize: 22, fontWeight: '800', color: Colors.primaryDark },
  cardSub:      { fontSize: 11, color: Colors.textMuted, lineHeight: 15, marginTop: 2 },

  // Forecast rows
  fRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, gap: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  fFrost:  { backgroundColor: '#EEF4FF', borderLeftWidth: 3, borderLeftColor: '#1565C0' },
  fToday:  { backgroundColor: Colors.primaryBg, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  fDay:    { width: 36, fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  fDayOn:  { color: Colors.primaryDark },
  fEmoji:  { fontSize: 18 },
  fPrecip: { fontSize: 11, color: Colors.textMuted },
  fEtp:    { fontSize: 11, color: Colors.textMuted, width: 52, textAlign: 'right' },
  fTemps:  { flexDirection: 'row', alignItems: 'center', gap: 1 },
  fMin:    { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  fSep:    { fontSize: 13, color: Colors.textMuted },
  fMax:    { fontSize: 13, color: Colors.error, fontWeight: '600' },

  footer: { textAlign: 'center', fontSize: 10, color: Colors.textPlaceholder, marginTop: 12, paddingHorizontal: 16 },
});
