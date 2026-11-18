import { amount, FACT_ROWS, type Nutrition } from '../data/nutrition';

/** A Canadian-style Nutrition Facts table: per serving when the serving size is known, and per 100 g (or ml). */
export function NutritionFacts({ nutrition: n }: { nutrition: Nutrition }) {
  const rows = FACT_ROWS.filter((r) => n[r.key] !== undefined);
  const serving = n.servingSize ? n.serving || `${n.servingSize} ${n.per}` : undefined;
  return (
    <section class="facts" aria-label="Nutrition facts">
      <h3>Nutrition Facts</h3>
      <table>
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">Nutrient</span></th>
            {serving && <th scope="col">Per {serving}</th>}
            <th scope="col">Per 100 {n.per}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} class={r.key === 'kcal' ? 'cal' : r.indent ? 'sub' : undefined}>
              <td>{r.label}</td>
              {serving && <td>{amount(n, r, n.servingSize)}</td>}
              <td>{amount(n, r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="source">From the product databases. Check the package if it matters.</p>
    </section>
  );
}
