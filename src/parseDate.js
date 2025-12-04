import * as aq from "arquero";

export default function (dataset, minD, oxDimension) {
  const availableColumns = dataset.columnNames();
  const val =
    availableColumns.find((col) => col === minD + "___event") ||
    availableColumns.find((col) => col === minD + "___start");

  const result = aq
    .from(dataset)
    .derive({
      minDate: aq.escape((d) => d[val]),
      _rowNumber: aq.op.row_number(),
    })
    .derive(
      Object.fromEntries(
        aq
          .from(dataset)
          .columnNames()
          .filter(
            (col) =>
              col.endsWith("___start") ||
              col.endsWith("___end") ||
              col.endsWith("___event")
          )
          .map((col) => [
            col,
            aq.escape(
              (d) =>
                (aq.op.parse_date(d[col]) - aq.op.parse_date(d.minDate)) /
                oxDimension
            ),
          ])
      )
    );

  return result;
}
