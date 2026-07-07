import type { ComponentType } from "react";
import type { AlarmDataType, Device } from "../../types";
import {
  IcoBomba,
  IcoBrote,
  IcoCalefactor,
  IcoCO2,
  IcoGota,
  IcoPower,
  IcoPresion,
  IcoSol,
  IcoTermometro,
  IcoVentilador,
  type IconProps,
} from "./index";

type IconComponent = ComponentType<IconProps>;

const SENSOR_ICONS: Record<AlarmDataType, IconComponent> = {
  temperature: IcoTermometro,
  humidity: IcoGota,
  co2: IcoCO2,
  pressure: IcoPresion,
};

const SENSOR_SUBTYPE_ICONS: Record<string, IconComponent> = {
  capacitive: IcoBrote, // soil moisture → sprout pictogram
  onewire: IcoTermometro,
  scd30: IcoCO2,
  bme280: IcoGota,
  modbus_th: IcoTermometro,
  modbus_soil_7in1: IcoSol,
  hd38: IcoBrote, // soil moisture → sprout pictogram
};

const ACTUATOR_ALIAS_ICONS: ReadonlyArray<readonly [RegExp, IconComponent]> = [
  [/(bomba|riego|pump|water)/i, IcoBomba],
  [/(vent|fan|extractor)/i, IcoVentilador],
  [/(calef|heat|estufa)/i, IcoCalefactor],
];

export function getDeviceIcon(device: Device): IconComponent {
  if (device.type === "sensor") {
    if (device.sensorType && SENSOR_ICONS[device.sensorType]) {
      return SENSOR_ICONS[device.sensorType];
    }
    if (device.subtype && SENSOR_SUBTYPE_ICONS[device.subtype]) {
      return SENSOR_SUBTYPE_ICONS[device.subtype];
    }
    return IcoTermometro;
  }

  // Actuator: try matching the alias to a meaningful pictogram.
  const haystack = `${device.name} ${device.subtype}`.toLowerCase();
  const match = ACTUATOR_ALIAS_ICONS.find(([pattern]) => pattern.test(haystack));
  return match ? match[1] : IcoPower;
}
