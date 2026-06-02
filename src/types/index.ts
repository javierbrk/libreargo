// --- Hub ---
export type ConnectionMode = "directo" | "online";
export type HubStatus = "conectado" | "desconectado";

export interface Hub {
  readonly hash: string;
  readonly name: string;
  readonly ip: string;
  readonly status: HubStatus;
  readonly addedAt: string; // ISO 8601
}

// --- Zona ---
export interface Zone {
  readonly id: string;
  readonly name: string;
}

// --- Sensor ---
export interface SensorConfig {
  readonly type: string;
  readonly enabled: boolean;
  readonly config: Record<string, unknown>;
  readonly zones?: readonly string[];
}

export interface SensorData {
  readonly a_temperature: string;
  readonly a_humidity: string;
  readonly a_co2: string;
  readonly a_pressure: string;
  readonly wifi_status: "connected" | "disconnected" | "unknown";
  readonly errors: Readonly<{
    temperature: readonly string[];
    humidity: readonly string[];
    sensors: readonly string[];
    wifi: readonly string[];
    rotation: readonly string[];
  }>;
}

export interface SensorReading {
  readonly timestamp: string; // ISO 8601
  readonly temperature: number;
  readonly humidity: number;
  readonly co2: number;
  readonly pressure: number;
}

export interface SensorRangeVisual {
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly current: number;
}

// --- Actuador (Relé) ---
export interface RelayState {
  readonly type: string;
  readonly address: number;
  readonly alias: string;
  readonly active: boolean;
  readonly state: readonly [boolean, boolean];
  readonly input_state: readonly [boolean, boolean];
  readonly zones?: readonly string[];
}

// --- Config del Hub ---
export interface HubConfig {
  readonly incubator_name: string;
  readonly hash: string;
  readonly min_temperature: number;
  readonly max_temperature: number;
  readonly min_hum: number;
  readonly max_hum: number;
  readonly sensors: readonly SensorConfig[];
  readonly relays: readonly {
    readonly type: string;
    readonly enabled: boolean;
    readonly config: Readonly<{
      address: number;
      alias: string;
    }>;
  }[];
}

// --- Alarma ---
export type AlarmDataType = "temperature" | "humidity" | "co2" | "pressure";
export type AlarmStatus = "active" | "acknowledged";

export interface Alarm {
  readonly id: string;
  readonly timestamp: string; // ISO 8601 si el hub lo provee; si no, timestamp opaco del hub
  readonly dataType: AlarmDataType;
  readonly alertValue: number;
  readonly currentValue: number;
  readonly zones: readonly string[];
  readonly status: AlarmStatus;
  readonly message?: string; // Texto crudo emitido por el hub en /actual.errors
}

// --- Cultivo ---
export interface Crop {
  readonly id: string;
  readonly name: string;
  readonly startDate: string; // ISO 8601
  readonly period: number; // días
  readonly harvestDate: string; // ISO 8601, calculado
  readonly zones: readonly string[];
}

// --- Recomendación ---
export interface Recommendation {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly date: string; // ISO 8601
}

// --- Dispositivo unificado (para listado en Home) ---
export type DeviceType = "sensor" | "actuator";

export interface Device {
  readonly id: string;
  readonly type: DeviceType;
  readonly name: string;
  readonly subtype: string; // tipo de sensor o "relay_2ch"
  readonly zones: readonly string[];
  readonly sensorType?: AlarmDataType;
  readonly relayAddress?: number; // solo para actuadores
}
