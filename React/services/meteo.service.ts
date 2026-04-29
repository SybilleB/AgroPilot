/**
 * services/meteo.service.ts — Service météo agricole
 *
 * Sources :
 *  - Géocodage  : api-adresse.data.gouv.fr (gratuit, sans clé)
 *  - Météo      : api.open-meteo.com       (gratuit, sans clé)
 *
 * Données agricoles clés :
 *  - ETP (évapotranspiration) — besoin en irrigation
 *  - Température du sol (6 cm et 18 cm) — conditions de semis
 *  - Gel (tempMin < 0°C) — alertes sur 7 jours
 *  - Vent / rafales — décision de traitement phytosanitaire
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lon: number;
  label: string; // ex : "Beauvais 60000"
}

export interface CurrentWeather {
  temp: number;           // °C
  apparent: number;       // °C ressentie
  humidity: number;       // %
  precipitation: number;  // mm (dernière heure)
  windSpeed: number;      // km/h
  windGusts: number;      // km/h
  windDirection: number;  // degrés (0–360)
  uvIndex: number;
  weatherCode: number;    // WMO Weather code
}

export interface DailyForecast {
  date: string;              // YYYY-MM-DD
  weatherCode: number;
  tempMax: number;           // °C
  tempMin: number;           // °C
  precipitationSum: number;  // mm
  precipProbability: number; // %
  windMax: number;           // km/h
  windGusts: number;         // km/h rafales max
  uvMax: number;
  etp: number;               // Evapotranspiration (mm/j) — FAO-56
  sunrise: string;           // ISO datetime
  sunset: string;            // ISO datetime
  isFrost: boolean;          // tempMin < 0°C
}

export interface HourlySlice {
  time: string[];
  temp: number[];           // °C à 2 m
  soilTemp6cm: number[];    // °C à 6 cm
  soilTemp18cm: number[];   // °C à 18 cm
  precipitation: number[];  // mm/h
}

export interface MeteoData {
  coordinates: Coordinates;
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlySlice;
}

// ─── Géocodage ────────────────────────────────────────────────────────────

/**
 * Convertit un nom de commune (+ code postal optionnel) en coordonnées GPS.
 * Utilise l'API gouvernementale française : api-adresse.data.gouv.fr
 */
export async function geocodeCommune(
  commune: string,
  codePostal?: string,
): Promise<Coordinates | null> {
  try {
    const q = codePostal ? `${commune} ${codePostal}` : commune;
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1&type=municipality`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.features?.length) return null;
    const feature = json.features[0];
    const [lon, lat] = feature.geometry.coordinates as [number, number];
    return { lat, lon, label: feature.properties.label as string };
  } catch {
    return null;
  }
}

// ─── Open-Meteo ───────────────────────────────────────────────────────────

/**
 * Charge la météo complète depuis Open-Meteo pour une position donnée.
 * Retourne null en cas d'erreur réseau ou de réponse invalide.
 */
export async function fetchMeteo(lat: number, lon: number): Promise<MeteoData | null> {
  try {
    const params = new URLSearchParams({
      latitude:  lat.toString(),
      longitude: lon.toString(),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'uv_index',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'uv_index_max',
        'et0_fao_evapotranspiration',
        'sunrise',
        'sunset',
      ].join(','),
      hourly:        'temperature_2m,precipitation,soil_temperature_6cm,soil_temperature_18cm',
      timezone:      'Europe/Paris',
      forecast_days: '7',
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) return null;
    const d = await res.json();

    const current: CurrentWeather = {
      temp:          Math.round(d.current.temperature_2m),
      apparent:      Math.round(d.current.apparent_temperature),
      humidity:      d.current.relative_humidity_2m,
      precipitation: d.current.precipitation,
      windSpeed:     Math.round(d.current.wind_speed_10m),
      windGusts:     Math.round(d.current.wind_gusts_10m),
      windDirection: d.current.wind_direction_10m,
      uvIndex:       Math.round(d.current.uv_index),
      weatherCode:   d.current.weather_code,
    };

    const daily: DailyForecast[] = (d.daily.time as string[]).map((date, i) => ({
      date,
      weatherCode:       d.daily.weather_code[i],
      tempMax:           Math.round(d.daily.temperature_2m_max[i]),
      tempMin:           Math.round(d.daily.temperature_2m_min[i]),
      precipitationSum:  Math.round(d.daily.precipitation_sum[i] * 10) / 10,
      precipProbability: d.daily.precipitation_probability_max[i] ?? 0,
      windMax:           Math.round(d.daily.wind_speed_10m_max[i]),
      windGusts:         Math.round(d.daily.wind_gusts_10m_max[i]),
      uvMax:             Math.round(d.daily.uv_index_max[i]),
      etp:               Math.round(d.daily.et0_fao_evapotranspiration[i] * 10) / 10,
      sunrise:           d.daily.sunrise[i],
      sunset:            d.daily.sunset[i],
      isFrost:           d.daily.temperature_2m_min[i] < 0,
    }));

    const hourly: HourlySlice = {
      time:          d.hourly.time,
      temp:          d.hourly.temperature_2m,
      soilTemp6cm:   d.hourly.soil_temperature_6cm,
      soilTemp18cm:  d.hourly.soil_temperature_18cm,
      precipitation: d.hourly.precipitation,
    };

    return { coordinates: { lat, lon, label: '' }, current, daily, hourly };
  } catch {
    return null;
  }
}

// ─── Utilitaires météo ────────────────────────────────────────────────────

/** WMO weather code → emoji */
export function weatherCodeToEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2)  return '⛅';
  if (code === 3) return '☁️';
  if (code <= 49) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '❄️';
  return '⛈️';
}

/** WMO weather code → libellé français */
export function weatherCodeToLabel(code: number): string {
  if (code === 0) return 'Ensoleillé';
  if (code <= 2)  return 'Partiellement nuageux';
  if (code === 3) return 'Couvert';
  if (code <= 49) return 'Brouillard';
  if (code <= 55) return 'Bruine';
  if (code <= 67) return 'Pluie';
  if (code <= 77) return 'Neige';
  if (code <= 82) return 'Averses';
  if (code <= 86) return 'Averses de neige';
  return 'Orage';
}

