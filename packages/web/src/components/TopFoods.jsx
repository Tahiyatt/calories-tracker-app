export default function TopFoods({ foods }) {
  if (foods.length === 0) return <p className="hint">Nothing logged in this range yet.</p>;

  return (
    <ul className="entry-list">
      {foods.map((food) => (
        <li key={food.name}>
          <span className="entry-name">{food.name}</span>
          <span className="entry-kcal">
            {food.timesLogged}× · {food.avgKcal} kcal avg
          </span>
        </li>
      ))}
    </ul>
  );
}
