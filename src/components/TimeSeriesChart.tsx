import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
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
const HEIGHT = 150;
const PAD_X = 12;
const PAD_Y = 14;

export function TimeSeriesChart({
  points,
  unit = "",
  maxGapSeconds,
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
  const valueSpan = maxV - minV || 1;
  const timeSpan = maxT - minT || 1;

  const xFor = (t: number) =>
    PAD_X + ((t - minT) / timeSpan) * (WIDTH - PAD_X * 2);
  const yFor = (v: number) =>
    HEIGHT - PAD_Y - ((v - minV) / valueSpan) * (HEIGHT - PAD_Y * 2);

  const segments = splitOnGaps(finitePoints, maxGapSeconds).map((segment) => ({
    points: segment,
    svg: segment.map((point) => `${xFor(point.t)},${yFor(point.v)}`).join(" "),
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.boundsRow}>
        <Text style={styles.boundText}>
          {maxV.toFixed(1)}
          {unit}
        </Text>
        <Text style={styles.boundText}>
          {minV.toFixed(1)}
          {unit}
        </Text>
      </View>
      <Svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        accessibilityLabel="Gráfico histórico"
      >
        <Line
          x1={PAD_X}
          y1={PAD_Y}
          x2={PAD_X}
          y2={HEIGHT - PAD_Y}
          stroke={COLORS.border}
          strokeWidth={1}
        />
        <Line
          x1={PAD_X}
          y1={HEIGHT - PAD_Y}
          x2={WIDTH - PAD_X}
          y2={HEIGHT - PAD_Y}
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
    minHeight: HEIGHT + 22,
  },
  boundsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  boundText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
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
