import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { COLORS } from "../constants";

export interface TimeSeriesPoint {
  readonly t: number;
  readonly v: number;
}

interface TimeSeriesChartProps {
  readonly points: readonly TimeSeriesPoint[];
  readonly unit?: string;
  /**
   * Hueco máximo (en segundos) entre dos puntos consecutivos para unirlos
   * con línea. Si la distancia lo supera (hub apagado, corte de telemetría),
   * la línea se corta y el hueco queda visible en vez de inventar continuidad.
   * Sin definir, se une todo (comportamiento previo).
   */
  readonly maxGapSeconds?: number;
  /** Incluir dd/mm en las marcas del eje X (rangos que cruzan días). */
  readonly showDateInAxis?: boolean;
}

function formatAxisTime(epochSeconds: number, withDate: boolean): string {
  const d = new Date(epochSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withDate ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hhmm}` : hhmm;
}

function splitOnGaps(
  points: readonly TimeSeriesPoint[],
  maxGapSeconds: number | undefined
): readonly (readonly TimeSeriesPoint[])[] {
  if (maxGapSeconds === undefined || points.length === 0) {
    return [points];
  }
  const segments: TimeSeriesPoint[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    if (points[i].t - points[i - 1].t > maxGapSeconds) {
      segments.push([]);
    }
    segments[segments.length - 1].push(points[i]);
  }
  return segments;
}

const WIDTH = 320;
const HEIGHT = 170;
// Márgenes asimétricos: espacio a la izquierda para las etiquetas de valor
// del eje Y y abajo para los timestamps del eje X.
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

export function TimeSeriesChart({
  points,
  unit = "",
  maxGapSeconds,
  showDateInAxis = false,
}: TimeSeriesChartProps) {
  const finitePoints = points.filter(
    (p) => Number.isFinite(p.t) && Number.isFinite(p.v)
  );

  if (finitePoints.length < 2) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin datos históricos suficientes</Text>
      </View>
    );
  }

  const minT = Math.min(...finitePoints.map((p) => p.t));
  const maxT = Math.max(...finitePoints.map((p) => p.t));
  const minV = Math.min(...finitePoints.map((p) => p.v));
  const maxV = Math.max(...finitePoints.map((p) => p.v));
  const midV = (minV + maxV) / 2;
  const valueSpan = maxV - minV || 1;
  const timeSpan = maxT - minT || 1;

  const xFor = (t: number) =>
    PAD_LEFT + ((t - minT) / timeSpan) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const yFor = (v: number) =>
    HEIGHT - PAD_BOTTOM - ((v - minV) / valueSpan) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const segments = splitOnGaps(finitePoints, maxGapSeconds).map((segment) => ({
    points: segment,
    svg: segment.map((point) => `${xFor(point.t)},${yFor(point.v)}`).join(" "),
  }));

  const yTicks = [maxV, midV, minV];
  const xTicks = [minT, (minT + maxT) / 2, maxT];
  const xAnchor = (index: number) =>
    index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle";

  return (
    <View style={styles.wrap}>
      <Svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        accessibilityLabel="Gráfico histórico"
      >
        {/* Eje Y: valor máx/medio/mín con línea de guía horizontal */}
        {yTicks.map((v, index) => (
          <Line
            key={`grid-${index}`}
            x1={PAD_LEFT}
            y1={yFor(v)}
            x2={WIDTH - PAD_RIGHT}
            y2={yFor(v)}
            stroke={COLORS.border}
            strokeWidth={1}
            strokeDasharray={index === 1 ? "3,3" : undefined}
          />
        ))}
        {yTicks.map((v, index) => (
          <SvgText
            key={`ylab-${index}`}
            x={PAD_LEFT - 6}
            y={yFor(v) + 4}
            fontSize={10}
            fontWeight="600"
            fill={COLORS.textMuted}
            textAnchor="end"
          >
            {`${v.toFixed(1)}${unit}`}
          </SvgText>
        ))}
        {/* Eje X: timestamps inicio/medio/fin */}
        {xTicks.map((t, index) => (
          <SvgText
            key={`xlab-${index}`}
            x={xFor(t)}
            y={HEIGHT - 6}
            fontSize={10}
            fontWeight="600"
            fill={COLORS.textMuted}
            textAnchor={xAnchor(index)}
          >
            {formatAxisTime(t, showDateInAxis)}
          </SvgText>
        ))}
        <Line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={HEIGHT - PAD_BOTTOM}
          stroke={COLORS.border}
          strokeWidth={1}
        />
        {segments.map((segment, index) =>
          segment.points.length === 1 ? (
            // Punto aislado entre huecos: un círculo, o quedaría invisible.
            <Circle
              key={index}
              cx={xFor(segment.points[0].t)}
              cy={yFor(segment.points[0].v)}
              r={3}
              fill={COLORS.primary}
            />
          ) : (
            <Polyline
              key={index}
              points={segment.svg}
              fill="none"
              stroke={COLORS.primary}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: HEIGHT,
  },
  empty: {
    height: HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
});
