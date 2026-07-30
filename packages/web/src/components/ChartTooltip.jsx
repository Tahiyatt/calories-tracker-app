/** Shared tooltip so every chart speaks the same way. */
export default function ChartTooltip({ active, payload, label, unit = '', formatLabel }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tip">
      <div className="chart-tip-date">{formatLabel ? formatLabel(label) : label}</div>
      {payload
        .filter((row) => row.value !== null && row.value !== undefined)
        .map((row) => (
          <div className="chart-tip-row" key={row.name}>
            <span style={{ color: row.color ?? row.stroke }}>{row.name}</span>
            <span>
              {typeof row.value === 'number' ? Math.round(row.value * 10) / 10 : row.value}
              {unit}
            </span>
          </div>
        ))}
    </div>
  );
}
