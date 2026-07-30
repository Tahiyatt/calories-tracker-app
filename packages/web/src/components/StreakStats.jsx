const Stat = ({ label, value, unit }) => (
  <div className="stat">
    <span className="stat-label">{label}</span>
    <span className="stat-value">
      {value}
      {unit && <span className="stat-unit">{unit}</span>}
    </span>
  </div>
);

/**
 * The four numbers worth knowing at a glance.
 *
 * "On target" counts only days that had both entries and a goal — days you did
 * not log are not failures to hit a target, and neither are days before you set
 * one. Conflating the three would make the number meaningless.
 */
export default function StreakStats({ streaks, adherence, averages, rangeDays }) {
  return (
    <div className="stats">
      <Stat label="Current streak" value={streaks.current} unit={streaks.current === 1 ? 'day' : 'days'} />
      <Stat label="Longest streak" value={streaks.longest} unit="days" />
      <Stat label="Days logged" value={`${streaks.daysLogged}/${rangeDays}`} />
      <Stat
        label="On target"
        value={adherence.onTargetRate === null ? '—' : `${adherence.onTargetRate}%`}
      />
      <Stat label="Avg calories" value={Math.round(averages.kcal)} />
      <Stat label="Avg protein" value={Math.round(averages.protein)} unit="g" />
    </div>
  );
}
