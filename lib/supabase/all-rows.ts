/** PostgREST hands back at most this many rows a request (max_rows in the Supabase settings). */
const PAGE = 1000;

interface Page<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Every row of a query, for lists that can outgrow one page. Give the query a
 * unique order and `.range(from, to)`, or rows can repeat or go missing between
 * pages. Throws rather than return a short list, since totals are built on these.
 */
export async function allRows<T>(page: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}
